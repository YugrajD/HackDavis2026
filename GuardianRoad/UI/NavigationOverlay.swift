import SwiftUI
import MapKit

// MARK: - Camera overlay

struct NavigationOverlay: View {
    @ObservedObject var nav: NavigationManager
    @State private var minimapExpanded = false

    var body: some View {
        ZStack(alignment: .bottomLeading) {

            // Non-interactive turn-by-turn layer
            VStack(spacing: 0) {
                // Spacer tall enough to clear the "GUARDIAN ROAD" top bar (~36pt).
                Color.clear.frame(height: 44)

                switch nav.navState {
                case .active:
                    maneuverCard.transition(.move(edge: .top).combined(with: .opacity))
                        .frame(maxWidth: .infinity, alignment: .center)
                case .arrived:
                    arrivedCard.transition(.move(edge: .top).combined(with: .opacity))
                case .failed(let msg):
                    errorCard(msg).transition(.move(edge: .top).combined(with: .opacity))
                case .routing:
                    routingCard.transition(.opacity)
                default:
                    EmptyView()
                }

                Spacer()

                if case .active = nav.navState, !minimapExpanded {
                    compassArrow.transition(.scale.combined(with: .opacity))
                }

                Spacer()
                Spacer()
            }
            .animation(.spring(duration: 0.35), value: cardID)
            .allowsHitTesting(false)

            // Minimap — interactive so it can be tapped to expand
            if case .active = nav.navState {
                minimapLayer
                    .transition(.opacity.combined(with: .scale(scale: 0.85)))
            }
        }
        .animation(.spring(duration: 0.4), value: minimapExpanded)
    }

    // MARK: - Minimap layer

    @ViewBuilder
    private var minimapLayer: some View {
        MinimapView(
            route: nav.route,
            userCoordinate: nav.userCoordinate,
            userHeading: nav.userHeading,
            isExpanded: minimapExpanded
        )
        .padding(.leading, 12)
        .padding(.bottom, 80)
        .onTapGesture {
            withAnimation(.spring(duration: 0.35)) { minimapExpanded.toggle() }
        }
    }

    // MARK: - Maneuver card (top)

    private var maneuverCard: some View {
        HStack(spacing: 12) {
            Image(systemName: maneuverIcon(for: nav.currentStep?.instructions ?? ""))
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(.white)
                .frame(width: 30, height: 30)

            VStack(alignment: .leading, spacing: 1) {
                Text(distanceLabel(nav.distanceToStep))
                    .font(.system(size: 22, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                Text(nav.currentStep?.instructions ?? "Continue")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(.white.opacity(0.85))
                    .lineLimit(1)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(.black.opacity(0.72), in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(.white.opacity(0.12), lineWidth: 1))
        .frame(maxWidth: 260)
        .padding(.top, 8)
    }

    // MARK: - Compass arrow (center)

    private var compassArrow: some View {
        ZStack {
            Circle()
                .fill(.black.opacity(0.35))
                .frame(width: 120, height: 120)
            Circle()
                .stroke(.white.opacity(0.2), lineWidth: 1.5)
                .frame(width: 120, height: 120)
            Image(systemName: "arrow.up")
                .font(.system(size: 56, weight: .bold))
                .foregroundStyle(.white)
                .shadow(color: .black.opacity(0.5), radius: 4)
                .rotationEffect(.degrees(nav.arrowAngle))
                .animation(.interpolatingSpring(stiffness: 60, damping: 10), value: nav.arrowAngle)
        }
    }

    // MARK: - Status cards

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

    // MARK: - Helpers

    private func maneuverIcon(for instruction: String) -> String {
        let t = instruction.lowercased()
        if t.contains("u-turn") || t.contains("uturn")               { return "arrow.uturn.left" }
        if t.contains("sharp left")                                   { return "arrow.turn.up.left" }
        if t.contains("sharp right")                                  { return "arrow.turn.up.right" }
        if t.contains("slight left") || t.contains("bear left")      { return "arrow.up.left" }
        if t.contains("slight right") || t.contains("bear right")    { return "arrow.up.right" }
        if t.contains("turn left") || (t.contains("left") && t.contains("turn")) { return "arrow.turn.up.left" }
        if t.contains("turn right") || (t.contains("right") && t.contains("turn")) { return "arrow.turn.up.right" }
        if t.contains("left")                                         { return "arrow.turn.up.left" }
        if t.contains("right")                                        { return "arrow.turn.up.right" }
        if t.contains("merge")                                        { return "arrow.merge" }
        if t.contains("exit") || t.contains("ramp")                  { return "arrow.turn.down.right" }
        if t.contains("roundabout") || t.contains("traffic circle")  { return "arrow.clockwise" }
        if t.contains("arrive") || t.contains("destination")         { return "mappin.circle.fill" }
        return "arrow.up"
    }

    private func distanceLabel(_ meters: CLLocationDistance) -> String {
        let feet = meters * 3.28084
        if feet < 1000 { return "\(Int((feet / 10).rounded()) * 10) ft" }
        let miles = meters / 1609.34
        if miles < 10  { return String(format: "%.1f mi", miles) }
        return "\(Int(miles.rounded())) mi"
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
    var userCoordinate: CLLocationCoordinate2D?
    var userHeading: Double
    var isExpanded: Bool

    @State private var position: MapCameraPosition = .automatic

    var body: some View {
        Map(position: $position) {
            // Custom heading arrow instead of the default blue dot
            if let coord = userCoordinate {
                Annotation("", coordinate: coord, anchor: .center) {
                    ZStack {
                        Circle()
                            .fill(.blue.opacity(0.2))
                            .frame(width: isExpanded ? 36 : 24, height: isExpanded ? 36 : 24)
                        Image(systemName: "location.north.fill")
                            .font(.system(size: isExpanded ? 20 : 14, weight: .semibold))
                            .foregroundStyle(.blue)
                            .shadow(color: .white, radius: 2)
                            .rotationEffect(.degrees(userHeading))
                    }
                }
            }
            if let polyline = route?.polyline {
                MapPolyline(polyline)
                    .stroke(.blue, style: StrokeStyle(
                        lineWidth: isExpanded ? 4 : 3,
                        lineCap: .round,
                        lineJoin: .round
                    ))
            }
        }
        .mapStyle(.standard(emphasis: .muted))
        .mapControls { }
        .frame(width: isExpanded ? 260 : 140, height: isExpanded ? 300 : 140)
        .clipShape(RoundedRectangle(cornerRadius: isExpanded ? 20 : 14))
        .overlay(
            RoundedRectangle(cornerRadius: isExpanded ? 20 : 14)
                .stroke(.white.opacity(0.3), lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.4), radius: 8)
        .onChange(of: userCoordinate?.latitude) { _, _ in
            guard let coord = userCoordinate else { return }
            withAnimation(.easeInOut(duration: 0.8)) {
                position = .camera(MapCamera(
                    centerCoordinate: coord,
                    distance: isExpanded ? 1200 : 400
                ))
            }
        }
        .onChange(of: isExpanded) { _, expanded in
            guard let coord = userCoordinate else { return }
            withAnimation(.spring(duration: 0.4)) {
                position = .camera(MapCamera(
                    centerCoordinate: coord,
                    distance: expanded ? 1200 : 400
                ))
            }
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
                                Text(subtitle).font(.caption).foregroundStyle(.secondary)
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
        Task {
            do {
                let request = MKLocalSearch.Request()
                request.naturalLanguageQuery = query
                results = try await MKLocalSearch(request: request).start().mapItems
            } catch { results = [] }
            isSearching = false
        }
    }
}
