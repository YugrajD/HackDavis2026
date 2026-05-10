import Foundation
import CoreGraphics

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
}
