import SwiftUI
import AVKit

struct GalleryView: View {
    @Environment(\.dismiss) private var dismiss
    private let client = EventsClient()

    @State private var clips: [HazardEventItem] = []
    @State private var loading = true
    @State private var errorMessage: String?

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            VStack(spacing: 0) {
                header
                content
            }
        }
        .task { await load() }
        .preferredColorScheme(.dark)
    }

    // MARK: - Header

    private var header: some View {
        HStack {
            Text("CLIP GALLERY")
                .font(.system(size: 13, weight: .bold, design: .monospaced))
                .foregroundStyle(.white.opacity(0.85))
                .tracking(2)
            Spacer()
            Button {
                Task { await load() }
            } label: {
                Image(systemName: "arrow.clockwise")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.cyan)
            }
            .padding(.trailing, 14)

            Button("Close") { dismiss() }
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(.cyan)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(Color.black)
        .overlay(
            Rectangle()
                .fill(Color.white.opacity(0.08))
                .frame(height: 1),
            alignment: .bottom
        )
    }

    // MARK: - Content

    @ViewBuilder
    private var content: some View {
        if loading {
            VStack { Spacer(); ProgressView().tint(.cyan); Spacer() }
        } else if let errorMessage {
            VStack(spacing: 8) {
                Spacer()
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.system(size: 32))
                    .foregroundStyle(.yellow)
                Text("Could not load clips")
                    .font(.headline)
                    .foregroundStyle(.white)
                Text(errorMessage)
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.6))
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)
                Spacer()
            }
        } else if clips.isEmpty {
            VStack(spacing: 8) {
                Spacer()
                Image(systemName: "film.stack")
                    .font(.system(size: 36))
                    .foregroundStyle(.gray)
                Text("No clips yet")
                    .font(.headline)
                    .foregroundStyle(.white)
                Text("Hazard saves with a video clip will show up here.")
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.6))
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)
                Spacer()
            }
        } else {
            ScrollView {
                LazyVStack(spacing: 18) {
                    ForEach(clips) { clip in
                        ClipCard(clip: clip, mediaURL: client.resolveMediaURL(clip.clipUrl ?? ""))
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 18)
            }
        }
    }

    // MARK: - Loading

    private func load() async {
        await MainActor.run {
            loading = true
            errorMessage = nil
        }
        do {
            let all = try await client.listEvents()
            let withClips = all.filter { ($0.clipUrl?.trimmingCharacters(in: CharacterSet.whitespaces).isEmpty == false) }
            await MainActor.run {
                self.clips = withClips
                self.loading = false
            }
        } catch {
            await MainActor.run {
                self.errorMessage = (error as NSError).localizedDescription
                self.loading = false
            }
        }
    }
}

// MARK: - Card

private struct ClipCard: View {
    let clip: HazardEventItem
    let mediaURL: URL?

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            videoLayer
            Text(formattedTimestamp)
                .font(.system(size: 11, weight: .medium, design: .monospaced))
                .foregroundStyle(.white.opacity(0.7))
            Text("\(clip.type.replacingOccurrences(of: "_", with: " ")) · sev \(Int(clip.severity.rounded()))")
                .font(.system(size: 12))
                .foregroundStyle(.white.opacity(0.55))
            if !clip.spokenAlert.isEmpty {
                Text(clip.spokenAlert)
                    .font(.system(size: 14))
                    .foregroundStyle(.white)
                    .lineLimit(3)
            }
        }
        .padding(14)
        .background(Color.white.opacity(0.05), in: RoundedRectangle(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(Color.white.opacity(0.08), lineWidth: 1)
        )
    }

    @ViewBuilder
    private var videoLayer: some View {
        if let mediaURL {
            VideoPlayer(player: AVPlayer(url: mediaURL))
                .aspectRatio(16 / 9, contentMode: .fit)
                .clipShape(RoundedRectangle(cornerRadius: 12))
        } else {
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.black)
                .aspectRatio(16 / 9, contentMode: .fit)
                .overlay(
                    Text("No clip URL")
                        .font(.caption)
                        .foregroundStyle(.gray)
                )
        }
    }

    private var formattedTimestamp: String {
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = iso.date(from: clip.timestamp)
            ?? ISO8601DateFormatter().date(from: clip.timestamp)
            ?? Date()
        let f = DateFormatter()
        f.dateStyle = .medium
        f.timeStyle = .short
        return f.string(from: date)
    }
}
