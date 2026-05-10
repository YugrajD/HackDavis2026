import Foundation

/// Public ngrok tunnel into the friend's PC running Next.js + YOLO sidecar.
/// Free ngrok URLs change every restart — paste the new one here when it rotates.
enum AppConfig {
    static let apiBaseURL = URL(string: "https://multivoltine-keyla-firmly.ngrok-free.dev")!

    /// 0.0–1.0 JPEG quality for the live perception loop. Lower = faster wire transfer.
    static let perceptionJpegQuality: CGFloat = 0.4

    /// Minimum delay between perception requests, in milliseconds.
    /// Throttles the loop so we don't flood Wi-Fi or the YOLO service.
    static let perceptionMinIntervalMs: Int = 250

    /// HUD score thresholds (mirrors the Expo client tuning).
    static let autoPersistMinScore: Int = 56
    static let autoPersistCooldownSec: TimeInterval = 42
    static let speechHintMinScore: Int = 62
    static let speechHintCooldownSec: TimeInterval = 12
}
