import Foundation
import CoreGraphics
import CoreVideo

/// Mirrors the Expo client's FrameDetection (server-side TypeScript shape).
struct FrameDetection: Decodable, Identifiable {
    let id: String
    let label: String
    let confidence: Double
    /// Normalized [x1, y1, x2, y2] in image space (0…1).
    let bbox: [Double]?

    /// Convert normalized bbox to a CGRect inside a preview of size `size`.
    func rect(in size: CGSize) -> CGRect? {
        guard let bbox, bbox.count >= 4 else { return nil }
        let x1 = bbox[0] * Double(size.width)
        let y1 = bbox[1] * Double(size.height)
        let x2 = bbox[2] * Double(size.width)
        let y2 = bbox[3] * Double(size.height)
        return CGRect(x: x1, y: y1, width: max(0, x2 - x1), height: max(0, y2 - y1))
    }

    private enum CodingKeys: String, CodingKey { case id, label, confidence, bbox }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        // Server may omit `id`; fall back to a uuid so SwiftUI can key the list.
        self.id = (try? c.decode(String.self, forKey: .id)) ?? UUID().uuidString
        self.label = (try? c.decode(String.self, forKey: .label)) ?? "object"
        self.confidence = (try? c.decode(Double.self, forKey: .confidence)) ?? 0
        self.bbox = try? c.decode([Double].self, forKey: .bbox)
    }
}

struct PerceptionResponse: Decodable {
    let detections: [FrameDetection]
    let width: Int?
    let height: Int?
    let note: String?
}

/// Lightweight LiDAR depth summary derived from ARKit scene depth.
/// Distances are meters from the rear camera plane over the central road-facing ROI.
struct SceneDepthSignal: Equatable {
    let timestamp: Date
    let centerMinMeters: Double
    let centerP10Meters: Double
    let nearPixelRatio: Double
    let ambientIntensity: Double?
    let isLowLight: Bool

    func isFresh(maxAgeSec: TimeInterval) -> Bool {
        Date().timeIntervalSince(timestamp) <= maxAgeSec
    }

    var displayDistance: String {
        String(format: "%.1fm", centerP10Meters)
    }

    var statusText: String {
        if isLowLight {
            return "DEPTH low light · \(displayDistance)"
        }
        return "DEPTH \(displayDistance)"
    }

    static func make(from depthMap: CVPixelBuffer, ambientIntensity: Double? = nil) -> SceneDepthSignal? {
        guard CVPixelBufferGetPixelFormatType(depthMap) == kCVPixelFormatType_DepthFloat32 else { return nil }

        CVPixelBufferLockBaseAddress(depthMap, .readOnly)
        defer { CVPixelBufferUnlockBaseAddress(depthMap, .readOnly) }

        guard let base = CVPixelBufferGetBaseAddress(depthMap) else { return nil }
        let pointer = base.bindMemory(to: Float32.self, capacity: CVPixelBufferGetDataSize(depthMap) / MemoryLayout<Float32>.stride)
        let width = CVPixelBufferGetWidth(depthMap)
        let height = CVPixelBufferGetHeight(depthMap)
        guard width > 8, height > 8 else { return nil }

        let stride = CVPixelBufferGetBytesPerRow(depthMap) / MemoryLayout<Float32>.stride
        let x0 = max(0, Int(Double(width) * 0.30))
        let x1 = min(width - 1, Int(Double(width) * 0.70))
        let y0 = max(0, Int(Double(height) * 0.28))
        let y1 = min(height - 1, Int(Double(height) * 0.78))
        let step = max(1, min(width, height) / 72)

        var depths: [Double] = []
        var nearCount = 0
        var sampleCount = 0
        for y in Swift.stride(from: y0, through: y1, by: step) {
            for x in Swift.stride(from: x0, through: x1, by: step) {
                let value = Double(pointer[y * stride + x])
                guard value.isFinite, value >= 0.12, value <= 15 else { continue }
                sampleCount += 1
                depths.append(value)
                if value <= AppConfig.sceneDepthNearMeters { nearCount += 1 }
            }
        }

        guard sampleCount >= 12, !depths.isEmpty else { return nil }
        depths.sort()
        let p10Index = min(depths.count - 1, max(0, Int(Double(depths.count - 1) * 0.10)))
        let ambient = ambientIntensity
        return SceneDepthSignal(
            timestamp: Date(),
            centerMinMeters: depths.first ?? 0,
            centerP10Meters: depths[p10Index],
            nearPixelRatio: Double(nearCount) / Double(sampleCount),
            ambientIntensity: ambient,
            isLowLight: ambient.map { $0 < AppConfig.sceneDepthLowLightLux } ?? false
        )
    }
}
