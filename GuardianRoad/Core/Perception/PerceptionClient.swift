import Foundation

/// Thin URLSession wrapper around the Next.js perception + persistence endpoints.
struct PerceptionClient {
    let baseURL: URL
    let session: URLSession

    init(baseURL: URL = AppConfig.apiBaseURL,
         session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
    }

    /// POST /api/perception/detect — returns YOLO detections for a single frame.
    /// Body matches what the Expo client sends: `{ imageBase64, imageMimeType }`.
    func detect(jpegData: Data) async throws -> PerceptionResponse {
        let url = baseURL.appendingPathComponent("/api/perception/detect")
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        // Bypass the ngrok free-tier "are you sure?" interstitial for non-browser clients.
        req.setValue("any", forHTTPHeaderField: "ngrok-skip-browser-warning")
        // Server expects a data-URI prefix — same shape used by the mobile client.
        let dataURI = "data:image/jpeg;base64,\(jpegData.base64EncodedString())"
        let body: [String: Any] = [
            "imageBase64": dataURI,
            "imageMimeType": "image/jpeg"
        ]
        req.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await session.data(for: req)
        // The route returns 503 with a JSON body when YOLO is down — decode either way.
        let decoded = try JSONDecoder().decode(PerceptionResponse.self, from: data)
        if let http = response as? HTTPURLResponse, http.statusCode >= 500 {
            // Surface note but still return the empty payload so the HUD can show the warning.
            return decoded
        }
        return decoded
    }

    /// POST /api/media/analyze-and-save — best-effort persistence on high-risk frames.
    func analyzeAndSave(jpegData: Data,
                        rideId: String,
                        latitude: Double,
                        longitude: Double,
                        speedMps: Double,
                        headingDeg: Double) async {
        let url = baseURL.appendingPathComponent("/api/media/analyze-and-save")
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("any", forHTTPHeaderField: "ngrok-skip-browser-warning")
        let dataURI = "data:image/jpeg;base64,\(jpegData.base64EncodedString())"
        let body: [String: Any] = [
            "imageBase64": dataURI,
            "rideId": rideId,
            "t": 0,
            "lat": latitude,
            "lng": longitude,
            "speedMps": speedMps,
            "headingDeg": headingDeg,
            "camera": "rear",
            "useYolo": true
        ]
        req.httpBody = try? JSONSerialization.data(withJSONObject: body)
        _ = try? await session.data(for: req)
    }
}
