import Foundation

/// Minimal mirror of the server's HazardEvent — only the fields the gallery actually shows.
struct HazardEventItem: Decodable, Identifiable {
    let id: String
    let rideId: String
    let timestamp: String
    let type: String
    let severity: Double
    let spokenAlert: String
    let clipUrl: String?
    let thumbnailUrl: String?
}

private struct EventsResponse: Decodable {
    let events: [HazardEventItem]
}

/// Fetches saved hazard events with their MongoDB-backed clip URLs.
struct EventsClient {
    let baseURL: URL
    let session: URLSession

    init(baseURL: URL = AppConfig.apiBaseURL, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
    }

    /// GET /api/events?rideId=<rideId> — omit rideId to fetch across all rides.
    func listEvents(rideId: String? = nil) async throws -> [HazardEventItem] {
        var components = URLComponents(
            url: baseURL.appendingPathComponent("/api/events"),
            resolvingAgainstBaseURL: false
        )!
        if let rideId, !rideId.isEmpty {
            components.queryItems = [URLQueryItem(name: "rideId", value: rideId)]
        }
        var req = URLRequest(url: components.url!)
        req.setValue("any", forHTTPHeaderField: "ngrok-skip-browser-warning")
        let (data, _) = try await session.data(for: req)
        return try JSONDecoder().decode(EventsResponse.self, from: data).events
    }

    /// Resolve a relative `/clips/foo.mp4` to an absolute URL against the API host.
    /// HTTP(S) URLs are returned as-is.
    func resolveMediaURL(_ pathOrUrl: String) -> URL? {
        let trimmed = pathOrUrl.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        if trimmed.hasPrefix("http://") || trimmed.hasPrefix("https://") {
            return URL(string: trimmed)
        }
        let prefix = trimmed.hasPrefix("/") ? "" : "/"
        return URL(string: baseURL.absoluteString + prefix + trimmed)
    }
}
