import SwiftUI
import AVKit

// MARK: - Stryds palette
private extension Color {
    static let neonGreen    = Color(red: 0.000, green: 0.478, blue: 1.000)   // #007AFF Apple blue
    static let cardSurface  = Color(red: 0.090, green: 0.090, blue: 0.090)   // #171717
    static let graphite     = Color(red: 0.239, green: 0.239, blue: 0.239)   // #3d3d3d
    static let brightText   = Color(red: 0.992, green: 0.992, blue: 0.992)   // #fdfdfd
    static let mutedAsh     = Color(red: 0.435, green: 0.435, blue: 0.435)   // #6f6f6f
    static let deepSpace    = Color(red: 0.016, green: 0.004, blue: 0.149)   // #040126
    static let componentDark = Color(red: 0.063, green: 0.063, blue: 0.063)  // #101010
}

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
        HStack(alignment: .center) {
            VStack(alignment: .leading, spacing: 2) {
                Text("CLIP GALLERY")
                    .font(.system(size: 28, weight: .bold))
                    .foregroundStyle(Color.brightText)
                    .tracking(-0.8)
                Text("\(clips.count) saved")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(Color.mutedAsh)
            }
            Spacer()
            HStack(spacing: 10) {
                Button {
                    Task { await load() }
                } label: {
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Color.brightText)
                        .padding(12)
                        .background(Color.neonGreen, in: Circle())
                }
                Button("Done") { dismiss() }
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.brightText)
                    .padding(.horizontal, 18)
                    .padding(.vertical, 10)
                    .background(Color.componentDark, in: Capsule())
                    .overlay(Capsule().stroke(Color.graphite, lineWidth: 1))
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 20)
        .padding(.bottom, 16)
    }

    // MARK: - Content

    @ViewBuilder
    private var content: some View {
        if loading {
            Spacer()
            ProgressView()
                .tint(Color.neonGreen)
                .scaleEffect(1.4)
            Spacer()
        } else if let errorMessage {
            emptyState(
                icon: "exclamationmark.triangle.fill",
                iconColor: .yellow,
                title: "Could not load clips",
                subtitle: errorMessage
            )
        } else if clips.isEmpty {
            emptyState(
                icon: "film.stack",
                iconColor: Color.neonGreen,
                title: "No clips yet",
                subtitle: "Hazard saves with a video clip will appear here."
            )
        } else {
            ScrollView {
                LazyVStack(spacing: 16) {
                    ForEach(clips) { clip in
                        ClipCard(
                            clip: clip,
                            mediaURL: client.resolveMediaURL(clip.clipUrl ?? ""),
                            thumbnailURL: client.resolveMediaURL(clip.thumbnailUrl ?? "")
                        )
                    }
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 16)
            }
        }
    }

    @ViewBuilder
    private func emptyState(icon: String, iconColor: Color, title: String, subtitle: String) -> some View {
        Spacer()
        VStack(spacing: 16) {
            Image(systemName: icon)
                .font(.system(size: 44, weight: .bold))
                .foregroundStyle(iconColor)
            Text(title)
                .font(.system(size: 21, weight: .bold))
                .foregroundStyle(Color.brightText)
                .tracking(-0.57)
            Text(subtitle)
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(Color.mutedAsh)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
        }
        Spacer()
    }

    // MARK: - Load

    private func load() async {
        await MainActor.run { loading = true; errorMessage = nil }
        do {
            let all = try await client.listEvents()
            let withMedia = all.filter { event in
                let hasClip = event.clipUrl?.trimmingCharacters(in: .whitespaces).isEmpty == false
                let hasThumb = event.thumbnailUrl?.trimmingCharacters(in: .whitespaces).isEmpty == false
                return hasClip || hasThumb
            }
            await MainActor.run { self.clips = withMedia; self.loading = false }
        } catch {
            await MainActor.run { self.errorMessage = (error as NSError).localizedDescription; self.loading = false }
        }
    }
}

// MARK: - Clip Card

private struct ClipCard: View {
    let clip: HazardEventItem
    let mediaURL: URL?
    let thumbnailURL: URL?
    @State private var fullScreen = false

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            ZStack(alignment: .topTrailing) {
                videoLayer
                if mediaURL != nil {
                    Button { fullScreen = true } label: {
                        Image(systemName: "arrow.up.left.and.arrow.down.right")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(.white)
                            .padding(8)
                            .background(.black.opacity(0.55), in: RoundedRectangle(cornerRadius: 8))
                    }
                    .padding(8)
                }
            }
            .fullScreenCover(isPresented: $fullScreen) {
                if let url = mediaURL {
                    ZStack(alignment: .topTrailing) {
                        Color.black.ignoresSafeArea()
                        VideoPlayer(player: AVPlayer(url: url))
                            .ignoresSafeArea()
                        Button { fullScreen = false } label: {
                            Image(systemName: "xmark.circle.fill")
                                .font(.system(size: 28))
                                .foregroundStyle(.white.opacity(0.9))
                                .padding(20)
                        }
                    }
                }
            }

            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 6) {
                    // Hazard type pill
                    Text(clip.type.replacingOccurrences(of: "_", with: " ").uppercased())
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(Color.brightText)
                        .tracking(0.5)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 5)
                        .background(Color.neonGreen, in: Capsule())

                    if !clip.spokenAlert.isEmpty {
                        Text(clip.spokenAlert)
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(Color.brightText)
                            .tracking(-0.3)
                            .lineLimit(2)
                    }

                    Text(formattedTimestamp)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(Color.mutedAsh)
                }

            }
        }
        .padding(18)
        .background(Color.cardSurface, in: RoundedRectangle(cornerRadius: 40))
        .overlay(
            RoundedRectangle(cornerRadius: 40)
                .stroke(Color.graphite, lineWidth: 1)
        )
    }

    @ViewBuilder
    private var videoLayer: some View {
        if let mediaURL {
            VideoPlayer(player: AVPlayer(url: mediaURL))
                .aspectRatio(16 / 9, contentMode: .fit)
                .clipShape(RoundedRectangle(cornerRadius: 24))
        } else if let thumbnailURL {
            AsyncImage(url: thumbnailURL) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().scaledToFill()
                case .failure:
                    placeholder(icon: "photo.badge.exclamationmark", label: "Thumbnail unavailable")
                case .empty:
                    placeholder(icon: "photo", label: "Loading…")
                @unknown default:
                    placeholder(icon: "photo", label: "")
                }
            }
            .aspectRatio(16 / 9, contentMode: .fit)
            .clipShape(RoundedRectangle(cornerRadius: 24))
        } else {
            placeholder(icon: "video.slash.fill", label: "No clip recorded")
        }
    }

    @ViewBuilder
    private func placeholder(icon: String, label: String) -> some View {
        RoundedRectangle(cornerRadius: 24)
            .fill(Color.componentDark)
            .aspectRatio(16 / 9, contentMode: .fit)
            .overlay(
                VStack(spacing: 8) {
                    Image(systemName: icon)
                        .font(.system(size: 24))
                        .foregroundStyle(Color.mutedAsh)
                    if !label.isEmpty {
                        Text(label)
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(Color.mutedAsh)
                    }
                }
            )
    }

    private var severityColor: Color {
        let s = clip.severity
        if s >= 85 { return Color(red: 1.0, green: 0.31, blue: 0.27) }
        if s >= 70 { return Color(red: 1.0, green: 0.70, blue: 0.22) }
        return Color.neonGreen
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
