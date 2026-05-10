import SwiftUI
import MapKit

// MARK: - Camera overlay

struct NavigationOverlay: View {
    @ObservedObject var nav: NavigationManager

    var body: some View {
        VStack(spacing: 0) {
            if case .active = nav.navState { maneuverCard.transition(.move(edge: .top).combined(with: .opacity)) }
            if case .arrived = nav.navState { arrivedCard.transition(.move(edge: .top).combined(with: .opacity)) }
            if case .failed(let msg) = nav.navState { errorCard(msg).transition(.move(edge: .top).combined(with: .opacity)) }
            Spacer()
            if case .active = nav.navState { arrowView }
            Spacer()
            Spacer()
        }
        .animation(.spring(duration: 0.35), value: cardID)
        .allowsHitTesting(false)        // let taps pass through to the camera view
    }

    // MARK: Cards

    private var maneuverCard: some View {
        HStack(spacing: 14) {
            Image(systemName: "arrow.up")
                .font(.system(size: 26, weight: .bold))
                .foregroundStyle(.white)
                .rotationEffect(.degrees(nav.arrowAngle))
                .animation(.interpolatingSpring(stiffness: 60, damping: 10), value: nav.arrowAngle)
                .frame(width: 36)

            VStack(alignment: .leading, spacing: 2) {
                Text(distanceLabel)
                    .font(.system(size: 26, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                Text(nav.currentStep?.instructions ?? "Continue")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(.white.opacity(0.85))
                    .lineLimit(2)
            }
            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(.black.opacity(0.72), in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(.white.opacity(0.12), lineWidth: 1))
        .padding(.horizontal, 12)
        .padding(.top, 8)
    }

    private var arrivedCard: some View {
        HStack(spacing: 12) {
            Image(systemName: "checkmark.circle.fill").foregroundStyle(.green)
            Text("You have arrived")
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(.white)
            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .background(.black.opacity(0.72), in: RoundedRectangle(cornerRadius: 14))
        .padding(.horizontal, 12)
        .padding(.top, 8)
    }

    private func errorCard(_ message: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(.yellow)
            Text(message)
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(.white)
            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(.black.opacity(0.72), in: RoundedRectangle(cornerRadius: 14))
        .padding(.horizontal, 12)
        .padding(.top, 8)
    }

    // MARK: Arrow

    private var arrowView: some View {
        ZStack {
            Circle()
                .fill(.black.opacity(0.35))
                .frame(width: 130, height: 130)
            Circle()
                .stroke(.white.opacity(0.2), lineWidth: 1.5)
                .frame(width: 130, height: 130)
            Image(systemName: "arrow.up")
                .font(.system(size: 64, weight: .bold))
                .foregroundStyle(.white)
                .shadow(color: .black.opacity(0.5), radius: 4)
                .rotationEffect(.degrees(nav.arrowAngle))
                .animation(.interpolatingSpring(stiffness: 60, damping: 10), value: nav.arrowAngle)
        }
    }

    // MARK: Helpers

    private var distanceLabel: String {
        let m = nav.distanceToStep
        if m < 100  { return "\(Int(m)) m" }
        if m < 1000 { return "\(Int((m / 10).rounded()) * 10) m" }
        return String(format: "%.1f km", m / 1000)
    }

    private var cardID: String {
        switch nav.navState {
        case .active(let i): return "step-\(i)"
        case .arrived:       return "arrived"
        case .failed(let e): return "err-\(e)"
        default:             return "idle"
        }
    }
}

// MARK: - Destination search sheet

struct DestinationSearchView: View {
    @ObservedObject var nav: NavigationManager
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @State private var results: [MKMapItem] = []
    @State private var isSearching = false
    @FocusState private var focused: Bool

    var body: some View {
        NavigationStack {
            List {
                if isSearching {
                    HStack { Spacer(); ProgressView(); Spacer() }
                        .listRowBackground(Color.clear)
                }
                ForEach(results, id: \.self) { item in
                    Button {
                        nav.startNavigation(to: item)
                        dismiss()
                    } label: {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(item.name ?? "Unknown")
                                .foregroundStyle(.primary)
                                .font(.system(size: 15, weight: .medium))
                            if let subtitle = item.placemark.title, !subtitle.isEmpty {
                                Text(subtitle)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .padding(.vertical, 2)
                    }
                }
            }
            .listStyle(.plain)
            .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always),
                        prompt: "Where to?")
            .navigationTitle("Navigate To")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
            .onAppear { focused = true }
        }
        .onChange(of: query) { _, newQuery in
            guard !newQuery.trimmingCharacters(in: .whitespaces).isEmpty else {
                results = []
                return
            }
            search(query: newQuery)
        }
    }

    private func search(query: String) {
        isSearching = true
        let request = MKLocalSearch.Request()
        request.naturalLanguageQuery = query
        // MKLocalSearch.start() has a native async overload on iOS 15+.
        Task {
            do {
                let response = try await MKLocalSearch(request: request).start()
                results = response.mapItems
            } catch {
                results = []
            }
            isSearching = false
        }
    }
}
