import AVFoundation
import Combine
import CoreImage
import CoreLocation
import UIKit

/// Subscribes to the camera's frame stream, throttles to one in-flight request,
/// JPEG-encodes the frame, POSTs to the YOLO route, and publishes detections + score.
@MainActor
final class PerceptionManager: ObservableObject {
    @Published var detections: [FrameDetection] = []
    @Published var hudScore: Int = 0
    @Published var note: String?

    private let client: PerceptionClient
    private let ciContext = CIContext(options: [.cacheIntermediates: false])
    private var cancellables = Set<AnyCancellable>()

    private var inFlight = false
    private var lastSentAt: Date = .distantPast

    private var lastAutoPersistAt: Date = .distantPast
    private var lastSpeechHintAt: Date = .distantPast

    /// External sources read these to enrich the analyze-and-save payload.
    var locationProvider: () -> CLLocation? = { nil }
    var headingProvider: () -> Double = { 0 }

    init(client: PerceptionClient = PerceptionClient()) {
        self.client = client
    }

    func attach(framePublisher: AnyPublisher<CMSampleBuffer, Never>) {
        framePublisher
            .receive(on: DispatchQueue.global(qos: .userInitiated))
            .sink { [weak self] buffer in self?.handleFrame(buffer) }
            .store(in: &cancellables)
    }

    func detach() {
        cancellables.removeAll()
        Task { @MainActor in
            self.detections = []
            self.hudScore = 0
            self.note = nil
        }
    }

    // MARK: - Frame pipeline

    private nonisolated func handleFrame(_ buffer: CMSampleBuffer) {
        // Throttle: skip if a request is in flight or we sent one too recently.
        let now = Date()
        let minInterval = TimeInterval(AppConfig.perceptionMinIntervalMs) / 1000
        Task { @MainActor [weak self] in
            guard let self else { return }
            if self.inFlight { return }
            if now.timeIntervalSince(self.lastSentAt) < minInterval { return }
            guard let jpeg = self.encodeJPEG(from: buffer) else { return }
            self.inFlight = true
            self.lastSentAt = now
            await self.send(jpeg: jpeg)
            self.inFlight = false
        }
    }

    private func send(jpeg: Data) async {
        do {
            let response = try await client.detect(jpegData: jpeg)
            self.detections = response.detections
            self.note = response.note
            let score = Self.score(detections: response.detections)
            self.hudScore = score

            let now = Date()
            if score >= AppConfig.speechHintMinScore,
               now.timeIntervalSince(lastSpeechHintAt) >= AppConfig.speechHintCooldownSec {
                lastSpeechHintAt = now
                Self.speak(hint: Self.spokenHint(for: response.detections))
            }
            if score >= AppConfig.autoPersistMinScore,
               now.timeIntervalSince(lastAutoPersistAt) >= AppConfig.autoPersistCooldownSec {
                lastAutoPersistAt = now
                let loc = locationProvider()
                let heading = headingProvider()
                Task.detached { [client] in
                    await client.analyzeAndSave(
                        jpegData: jpeg,
                        rideId: "demo-ride-1",
                        latitude: loc?.coordinate.latitude ?? 0,
                        longitude: loc?.coordinate.longitude ?? 0,
                        speedMps: max(0, loc?.speed ?? 0),
                        headingDeg: heading
                    )
                }
            }
        } catch {
            self.note = "Live frame failed (camera or network)."
        }
    }

    // MARK: - JPEG encode

    private func encodeJPEG(from buffer: CMSampleBuffer) -> Data? {
        guard let pixelBuffer = CMSampleBufferGetImageBuffer(buffer) else { return nil }
        // Back-camera buffers arrive landscape-right. Physically rotate the pixel data so YOLO
        // sees an upright frame — UIImage.jpegData honors orientation metadata via EXIF, but
        // OpenCV on the server ignores EXIF and reads raw bytes, so we must rotate here.
        let raw = CIImage(cvPixelBuffer: pixelBuffer)
        let upright = raw.oriented(.right)
        // Downscale to ~720p long edge for a faster network round-trip.
        let target: CGFloat = 720
        let scale = min(1, target / max(upright.extent.width, upright.extent.height))
        let scaled = scale < 1
            ? upright.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
            : upright
        guard let cgImage = ciContext.createCGImage(scaled, from: scaled.extent) else { return nil }
        return UIImage(cgImage: cgImage).jpegData(compressionQuality: AppConfig.perceptionJpegQuality)
    }

    // MARK: - Score + spoken hint (mirrors live-perception.ts)

    private static let vehicleLabels: Set<String> = ["car", "truck", "bus", "bike", "scooter"]

    static func score(detections: [FrameDetection]) -> Int {
        var maxScore = 0
        for d in detections {
            guard let bbox = d.bbox, bbox.count >= 4 else { continue }
            let label = d.label.lowercased()
            let conf = d.confidence
            let cx = (bbox[0] + bbox[2]) / 2
            let nearCenter = abs(cx - 0.5) < 0.38
            let height = max(0, bbox[3] - bbox[1])
            let prominent = height > 0.07
            var s = conf * 42
            if vehicleLabels.contains(label) { s += 28 }
            if label == "pedestrian" { s += 22 }
            if label == "obstacle" { s += 12 }
            if nearCenter { s += 18 }
            if prominent { s += 14 }
            maxScore = max(maxScore, Int(min(100, max(0, s.rounded()))))
        }
        return maxScore
    }

    static func spokenHint(for detections: [FrameDetection]) -> String {
        guard !detections.isEmpty else { return "Path looks clear." }
        let top = detections.max(by: { $0.confidence < $1.confidence })!
        let label = top.label.lowercased()
        if vehicleLabels.contains(label) { return "Vehicle in view." }
        if label == "pedestrian" { return "Pedestrian ahead." }
        if label == "obstacle" { return "Obstacle ahead." }
        return "Check path."
    }

    private static let synthesizer = AVSpeechSynthesizer()
    private static func speak(hint: String) {
        let utterance = AVSpeechUtterance(string: hint)
        utterance.rate = 0.55
        synthesizer.speak(utterance)
    }
}
