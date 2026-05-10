import ARKit
import Combine
import CoreVideo
import Foundation

/// Optional LiDAR sidecar. It samples ARKit scene depth into a tiny signal that can
/// boost hazard scoring in low light without taking over the working AVFoundation camera path.
final class SceneDepthManager: NSObject, ObservableObject, ARSessionDelegate {
    @Published private(set) var latestSignal: SceneDepthSignal?
    @Published private(set) var status: String

    private let session = ARSession()
    private var isRunning = false
    private var disabledAfterFailure = false

    override init() {
        self.status = Self.supportsSceneDepth ? "DEPTH ready" : "DEPTH unavailable"
        super.init()
        session.delegate = self
    }

    static var supportsSceneDepth: Bool {
        ARWorldTrackingConfiguration.supportsFrameSemantics(.smoothedSceneDepth)
            || ARWorldTrackingConfiguration.supportsFrameSemantics(.sceneDepth)
    }

    var isSupported: Bool { Self.supportsSceneDepth }

    var latestFreshSignal: SceneDepthSignal? {
        guard let latestSignal, latestSignal.isFresh(maxAgeSec: AppConfig.sceneDepthMaxAgeSec) else { return nil }
        return latestSignal
    }

    func start() {
        guard AppConfig.sceneDepthEnabled else {
            publish(status: "DEPTH off", signal: nil)
            return
        }
        guard Self.supportsSceneDepth else {
            publish(status: "DEPTH unavailable", signal: nil)
            return
        }
        guard !disabledAfterFailure else { return }
        guard !isRunning else { return }

        let configuration = ARWorldTrackingConfiguration()
        if ARWorldTrackingConfiguration.supportsFrameSemantics(.smoothedSceneDepth) {
            configuration.frameSemantics.insert(.smoothedSceneDepth)
        } else {
            configuration.frameSemantics.insert(.sceneDepth)
        }
        configuration.worldAlignment = .gravity
        configuration.isLightEstimationEnabled = true

        isRunning = true
        publish(status: "DEPTH starting", signal: latestSignal)
        session.run(configuration, options: [.resetTracking, .removeExistingAnchors])
    }

    func stop() {
        guard isRunning else { return }
        isRunning = false
        session.pause()
        publish(status: Self.supportsSceneDepth ? "DEPTH paused" : "DEPTH unavailable", signal: nil)
    }

    func session(_ session: ARSession, didUpdate frame: ARFrame) {
        guard isRunning else { return }
        guard let signal = Self.makeSignal(from: frame) else { return }
        publish(status: signal.statusText, signal: signal)
    }

    func session(_ session: ARSession, didFailWithError error: Error) {
        disabledAfterFailure = true
        isRunning = false
        publish(status: "DEPTH failed", signal: nil)
    }

    func sessionWasInterrupted(_ session: ARSession) {
        isRunning = false
        publish(status: "DEPTH interrupted", signal: nil)
    }

    func sessionInterruptionEnded(_ session: ARSession) {
        publish(status: Self.supportsSceneDepth ? "DEPTH ready" : "DEPTH unavailable", signal: nil)
    }

    private func publish(status: String, signal: SceneDepthSignal?) {
        DispatchQueue.main.async { [weak self] in
            self?.status = status
            self?.latestSignal = signal
        }
    }

    private static func makeSignal(from frame: ARFrame) -> SceneDepthSignal? {
        let depthData = frame.smoothedSceneDepth ?? frame.sceneDepth
        guard let depthMap = depthData?.depthMap else { return nil }
        guard CVPixelBufferGetPixelFormatType(depthMap) == kCVPixelFormatType_DepthFloat32 else { return nil }

        let confidenceMap = depthData?.confidenceMap
        let hasConfidence = confidenceMap != nil
            && CVPixelBufferGetWidth(confidenceMap!) == CVPixelBufferGetWidth(depthMap)
            && CVPixelBufferGetHeight(confidenceMap!) == CVPixelBufferGetHeight(depthMap)

        CVPixelBufferLockBaseAddress(depthMap, .readOnly)
        if let confidenceMap { CVPixelBufferLockBaseAddress(confidenceMap, .readOnly) }
        defer {
            CVPixelBufferUnlockBaseAddress(depthMap, .readOnly)
            if let confidenceMap { CVPixelBufferUnlockBaseAddress(confidenceMap, .readOnly) }
        }

        guard let depthBase = CVPixelBufferGetBaseAddress(depthMap) else { return nil }
        let depthPointer = depthBase.bindMemory(to: Float32.self, capacity: CVPixelBufferGetDataSize(depthMap) / MemoryLayout<Float32>.stride)
        let confidencePointer = confidenceMap.flatMap { CVPixelBufferGetBaseAddress($0)?.bindMemory(to: UInt8.self, capacity: CVPixelBufferGetDataSize($0)) }

        let width = CVPixelBufferGetWidth(depthMap)
        let height = CVPixelBufferGetHeight(depthMap)
        guard width > 8, height > 8 else { return nil }

        let depthStride = CVPixelBufferGetBytesPerRow(depthMap) / MemoryLayout<Float32>.stride
        let confidenceStride = confidenceMap.map { CVPixelBufferGetBytesPerRow($0) } ?? 0
        let x0 = max(0, Int(Double(width) * 0.30))
        let x1 = min(width - 1, Int(Double(width) * 0.70))
        let y0 = max(0, Int(Double(height) * 0.28))
        let y1 = min(height - 1, Int(Double(height) * 0.78))
        let step = max(1, min(width, height) / 72)

        var depths: [Double] = []
        depths.reserveCapacity(((x1 - x0) / step + 1) * ((y1 - y0) / step + 1))
        var nearCount = 0
        var sampleCount = 0

        for y in stride(from: y0, through: y1, by: step) {
            for x in stride(from: x0, through: x1, by: step) {
                if hasConfidence,
                   let confidencePointer,
                   confidencePointer[y * confidenceStride + x] == 0 {
                    continue
                }
                let value = Double(depthPointer[y * depthStride + x])
                guard value.isFinite, value >= 0.12, value <= 15 else { continue }
                sampleCount += 1
                depths.append(value)
                if value <= AppConfig.sceneDepthNearMeters { nearCount += 1 }
            }
        }

        guard sampleCount >= 12, !depths.isEmpty else { return nil }
        depths.sort()
        let minMeters = depths.first ?? 0
        let p10Index = min(depths.count - 1, max(0, Int(Double(depths.count - 1) * 0.10)))
        let p10Meters = depths[p10Index]
        let nearPixelRatio = Double(nearCount) / Double(sampleCount)
        let ambient = frame.lightEstimate.map { Double($0.ambientIntensity) }
        let isLowLight = ambient.map { $0 < AppConfig.sceneDepthLowLightLux } ?? false

        return SceneDepthSignal(
            timestamp: Date(),
            centerMinMeters: minMeters,
            centerP10Meters: p10Meters,
            nearPixelRatio: nearPixelRatio,
            ambientIntensity: ambient,
            isLowLight: isLowLight
        )
    }
}
