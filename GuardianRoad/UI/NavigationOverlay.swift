import SwiftUI
import MapKit

// MARK: - Camera overlay

struct NavigationOverlay: View {
    @ObservedObject var nav: NavigationManager

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            // Turn-by-turn card + large maneuver icon
            VStack(spacing: 0) {
                switch nav.navState {
                case .active:
                    maneuverCard
                        .transition(.move(edge: .top).combined(with: .opacity))
                case .arrived:
                    arrivedCard
                        .transition(.move(edge: .top).combined(with: .opacity))
                case .failed(let msg):
                    errorCard(msg)
                        .transition(.move(edge: .top).combined(with: .opacity))
                case .routing:
                    routingCard
                        .transition(.opacity)
                default:
                    EmptyView()
                }

                Spacer()

                if case .active = nav.navState {
                    largeTurnIcon
                        .transition(.scale.combined(with: .opacity))
                }

                Spacer()
                Spacer()
            }
            .animation(.spring(duration: 0.35), value: cardID)
            .allowsHitTesting(false)

            // Minimap — visible whenever navigation is active
            if case .active = nav.navState {
                MinimapView(route: nav.route)
                    .padding(.leading, 12)
                    .padding(.bottom, 80)   // sit above the bottom HUD bar
                    .transition(.opacity)
                    .allowsHitTesting(false)
            }
        }
    }

    // MARK: - Cards

    private var maneuverCard: some View {
        HStack(spacing: 14) {
            // Maneuver icon changes based on the instruction — no rotation needed
            Image(systemName: maneuverIcon(for: nav.currentStep?.instructions ?? ""))
                .font(.system(size: 28, weight: .bold))
                .foregroundStyle(.white)
                .frame(width: 36, height: 36)

            VStack(alignment: .leading, spacing: 2) {
                Text(distanceLabel(nav.distanceToStep))
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
            Image(systemName: "mappin.circle.fill").foregroundStyle(.green).font(.title2)
            Text("You have arrived").font(.system(size: 17, weight: .semibold)).foregroundStyle(.white)
            Spacer()
        }
        .padding(.horizontal, 16).padding(.vertical, 14)
        .background(.black.opacity(0.72), in: RoundedRectangle(cornerRadius: 14))
        .padding(.horizontal, 12).padding(.top, 8)
    }

    private func errorCard(_ message: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(.yellow).font(.title2)
            Text(message).font(.system(size: 14, weight: .medium)).foregroundStyle(.white)
            Spacer()
        }
        .padding(.horizontal, 16).padding(.vertical, 12)
        .background(.black.opacity(0.72), in: RoundedRectangle(cornerRadius: 14))
        .padding(.horizontal, 12).padding(.top, 8)
    }

    private var routingCard: some View {
        HStack(spacing: 12) {
            ProgressView().tint(.white)
            Text("Calculating route…").font(.system(size: 15, weight: .medium)).foregroundStyle(.white)
            Spacer()
        }
        .padding(.horizontal, 16).padding(.vertical, 12)
        .background(.black.opacity(0.72), in: RoundedRectangle(cornerRadius: 14))
        .padding(.horizontal, 12).padding(.top, 8)
    }

    // MARK: - Large center maneuver icon

    private var largeTurnIcon: some View {
        let icon = maneuverIcon(for: nav.currentStep?.instructions ?? "")
        return ZStack {
            Circle()
                .fill(.black.opacity(0.4))
                .frame(width: 120, height: 120)
            Circle()
                .stroke(.white.opacity(0.25), lineWidth: 1.5)
                .frame(width: 120, height: 120)
            Image(systemName: icon)
                .font(.system(size: 56, weight: .bold))
                .foregroundStyle(.white)
                .shadow(color: .black.opacity(0.5), radius: 4)
        }
        .id(icon)   // re-render with animation when the maneuver changes
        .transition(.scale(scale: 0.8).combined(with: .opacity))
        .animation(.spring(duration: 0.4), value: icon)
    }

    // MARK: - Helpers

    private func maneuverIcon(for instruction: String) -> String {
        let t = instruction.lowercased()
        if t.contains("u-turn") || t.contains("uturn")              { return "arrow.uturn.left" }
        if t.contains("sharp left")                                  { return "arrow.turn.up.left" }
        if t.contains("sharp right")                                 { return "arrow.turn.up.right" }
        if t.contains("slight left") || t.contains("bear left")     { return "arrow.up.left" }
        if t.contains("slight right") || t.contains("bear right")   { return "arrow.up.right" }
        if t.contains("turn left") || (t.contains("left") && t.contains("turn")) { return "arrow.turn.up.left" }
        if t.contains("turn right") || (t.contains("right") && t.contains("turn")) { return "arrow.turn.up.right" }
        if t.contains("left")                                        { return "arrow.turn.up.left" }
        if t.contains("right")                                       { return "arrow.turn.up.right" }
        if t.contains("merge")                                       { return "arrow.merge" }
        if t.contains("exit") || t.contains("ramp")                 { return "arrow.turn.down.right" }
        if t.contains("roundabout") || t.contains("traffic circle") { return "arrow.clockwise" }
        if t.contains("arrive") || t.contains("destination")        { return "mappin.circle.fill" }
        return "arrow.up"
    }

    private func distanceLabel(_ meters: CLLocationDistance) -> String {
        if meters < 100  { return "\(Int(meters)) m" }
        if meters < 1000 { return "\(Int((meters / 10).rounded()) * 10) m" }
        return String(format: "%.1f km", meters / 1000)
    }

    private var cardID: String {
        switch nav.navState {
        case .active(let i): return "step-\(i)"
        case .arrived:       return "arrived"
        case .routing:       return "routing"
        case .failed(let e): return "err-\(e)"
        case .idle:          return "idle"
        }
    }
}

// MARK: - Minimap

struct MinimapView: View {
    var route: MKRoute?

    // .userLocation automatically follows GPS without manual coordinate binding.
    @State private var position: MapCameraPosition =
        .userLocation(followsHeading: false, fallback: .automatic)

    var body: some View {
        Map(position: $position) {
            UserAnnotation()
            if let polyline = route?.polyline {
                MapPolyline(polyline)
                    .stroke(.blue, style: StrokeStyle(lineWidth: 3, lineCap: .round, lineJoin: .round))
            }
        }
        .mapStyle(.standard(emphasis: .muted))
        .mapControls { }
        .frame(width: 140, height: 140)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(.white.opacity(0.3), lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.4), radius: 6)
    }
}

// MARK: - Destination search sheet

struct DestinationSearchView: View {
    @ObservedObject var nav: NavigationManager
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @State private var results: [MKMapItem] = []
    @State private var isSearching = false

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
            .searchable(text: $query,
                        placement: .navigationBarDrawer(displayMode: .always),
                        prompt: "Where to?")
            .navigationTitle("Navigate To")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
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
        // MKLocalSearch.start() has a native async overload on iOS 15+.
        Task {
            do {
                let request = MKLocalSearch.Request()
                request.naturalLanguageQuery = query
                results = try await MKLocalSearch(request: request).start().mapItems
            } catch {
                results = []
            }
            isSearching = false
        }
    }
}
