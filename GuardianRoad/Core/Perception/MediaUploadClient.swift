import Foundation
import AVFoundation
import UIKit

/// Two-step media upload that mirrors the Expo client:
///   1. POST `/api/media/upload` with the .mp4 → server stores it and returns a `clipUrl`
///   2. POST `/api/media/analyze-and-save` with that `clipUrl` + a thumbnail → server creates
///      a HazardEvent in MongoDB and the gallery picks it up.
struct MediaUploadClient {
    let baseURL: URL
    let session: URLSession

    init(baseURL: URL = AppConfig.apiBaseURL) {
        self.baseURL = baseURL
        // Long-running uploads need generous timeouts.
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 60
        config.timeoutIntervalForResource = 180
        self.session = URLSession(configuration: config)
    }

    enum UploadError: Error, LocalizedError {
        case fileTooLarge(bytes: Int)
        case fileMissing
        case uploadFailed(status: Int, body: String?)
        case decodeFailed
        var errorDescription: String? {
            switch self {
            case .fileTooLarge(let b): return "Clip is \(b / (1024 * 1024)) MB — server limit is 12 MB."
            case .fileMissing: return "Local clip file is missing."
            case .uploadFailed(let s, let b): return "Upload failed (\(s)): \(b ?? "no body")"
            case .decodeFailed: return "Server returned an unexpected response."
            }
        }
    }

    /// Upload the .mp4 clip + push a HazardEvent into MongoDB.
    func uploadAndPersist(clipURL: URL,
                          rideId: String,
                          location: (lat: Double, lng: Double)?,
                          headingDeg: Double,
                          speedMps: Double) async throws -> String {
        let clipUrl = try await uploadClip(clipURL: clipURL)
        let thumbBase64 = thumbnailBase64(from: clipURL)
        try await analyzeAndSave(
            imageBase64: thumbBase64,
            clipUrl: clipUrl,
            thumbnailUrl: nil,
            rideId: rideId,
            location: location,
            headingDeg: headingDeg,
            speedMps: speedMps
        )
        return clipUrl
    }

    // MARK: - Step 1: upload

    private func uploadClip(clipURL: URL) async throws -> String {
        let data = try Data(contentsOf: clipURL)
        if data.count > 12 * 1024 * 1024 {
            throw UploadError.fileTooLarge(bytes: data.count)
        }
        let url = baseURL.appendingPathComponent("/api/media/upload")
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("any", forHTTPHeaderField: "ngrok-skip-browser-warning")
        let body: [String: Any] = [
            "clipBase64": "data:video/mp4;base64,\(data.base64EncodedString())",
            "clipMimeType": "video/mp4"
        ]
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (responseData, response) = try await session.data(for: req)
        guard let http = response as? HTTPURLResponse else { throw UploadError.decodeFailed }
        guard (200..<300).contains(http.statusCode) else {
            throw UploadError.uploadFailed(
                status: http.statusCode,
                body: String(data: responseData, encoding: .utf8)
            )
        }
        struct UploadResponse: Decodable { let clipUrl: String? }
        let parsed = try JSONDecoder().decode(UploadResponse.self, from: responseData)
        guard let clipUrl = parsed.clipUrl else { throw UploadError.decodeFailed }
        return clipUrl
    }

    // MARK: - Step 2: persist event

    private func analyzeAndSave(imageBase64: String?,
                                clipUrl: String,
                                thumbnailUrl: String?,
                                rideId: String,
                                location: (lat: Double, lng: Double)?,
                                headingDeg: Double,
                                speedMps: Double) async throws {
        let url = baseURL.appendingPathComponent("/api/media/analyze-and-save")
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("any", forHTTPHeaderField: "ngrok-skip-browser-warning")
        var body: [String: Any] = [
            "rideId": rideId,
            "t": 0,
            "lat": location?.lat ?? 0,
            "lng": location?.lng ?? 0,
            "speedMps": speedMps,
            "headingDeg": headingDeg,
            "camera": "rear",
            "useYolo": true,
            "clipUrl": clipUrl
        ]
        if let imageBase64 { body["imageBase64"] = imageBase64 }
        if let thumbnailUrl { body["thumbnailUrl"] = thumbnailUrl }
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await session.data(for: req)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            let status = (response as? HTTPURLResponse)?.statusCode ?? -1
            throw UploadError.uploadFailed(status: status, body: String(data: data, encoding: .utf8))
        }
    }

    // MARK: - Thumbnail extraction

    private func thumbnailBase64(from clipURL: URL) -> String? {
        let asset = AVURLAsset(url: clipURL)
        let generator = AVAssetImageGenerator(asset: asset)
        generator.appliesPreferredTrackTransform = true
        generator.maximumSize = CGSize(width: 720, height: 720)
        let time = CMTime(seconds: 0.5, preferredTimescale: 600)
        guard let cg = try? generator.copyCGImage(at: time, actualTime: nil) else { return nil }
        let uiImage = UIImage(cgImage: cg)
        guard let jpeg = uiImage.jpegData(compressionQuality: 0.7) else { return nil }
        return "data:image/jpeg;base64,\(jpeg.base64EncodedString())"
    }
}
