import CoreLocation
import MapKit
import Combine

enum NavState: Equatable {
    case idle
    case routing
    case active(stepIndex: Int)
    case arrived
    case failed(String)
}

@MainActor
final class NavigationManager: NSObject, ObservableObject {
    @Published var navState: NavState = .idle
    @Published var arrowAngle: Double = 0
    @Published var distanceToStep: CLLocationDistance = 0

    private(set) var route: MKRoute?
    private var currentHeading: Double = 0
    private var lastLocation: CLLocation?
    private var routingTask: Task<Void, Never>?

    private let headingManager = CLLocationManager()

    override init() {
        super.init()
        headingManager.delegate = self
        headingManager.headingFilter = 2.0
        headingManager.startUpdatingHeading()
    }

    // MARK: - Public

    func startNavigation(to item: MKMapItem) {
        routingTask?.cancel()
        navState = .routing
        routingTask = Task { await calculateRoute(to: item) }
    }

    func stopNavigation() {
        routingTask?.cancel()
        routingTask = nil
        route = nil
        navState = .idle
        arrowAngle = 0
        distanceToStep = 0
    }

    /// Called by DashcamViewModel whenever its location manager fires.
    func updateLocation(_ location: CLLocation) {
        lastLocation = location
        advanceStepIfNeeded(at: location)
        refreshArrowAngle()
    }

    var currentStep: MKRoute.Step? {
        guard case .active(let idx) = navState, let route else { return nil }
        return route.steps[idx]
    }

    // MARK: - Routing

    private func calculateRoute(to destination: MKMapItem) async {
        guard let userLoc = lastLocation else {
            navState = .failed("Waiting for location…")
            return
        }

        // MKDirections.calculate() has no async overload on iOS — wrap in continuation.
        // Build source from real coordinate; forCurrentLocation() only works as a
        // Maps URL-scheme destination, NOT as a MKDirections request source.
        let source = MKMapItem(placemark: MKPlacemark(coordinate: userLoc.coordinate))
        let request = MKDirections.Request()
        request.source = source
        request.destination = destination
        request.transportType = .automobile
        request.requestsAlternateRoutes = false

        do {
            let response: MKDirections.Response = try await withCheckedThrowingContinuation { cont in
                MKDirections(request: request).calculate { response, error in
                    if let response { cont.resume(returning: response) }
                    else { cont.resume(throwing: error ?? URLError(.unknown)) }
                }
            }

            guard !Task.isCancelled else { return }
            guard let bestRoute = response.routes.first else {
                navState = .failed("No route found")
                return
            }

            route = bestRoute
            navState = .active(stepIndex: firstMeaningfulStep(in: bestRoute))
            if let loc = lastLocation { advanceStepIfNeeded(at: loc) }
            refreshArrowAngle()
        } catch {
            guard !Task.isCancelled else { return }
            navState = .failed(error.localizedDescription)
        }
    }

    // MKRoute usually has an empty-instruction first step ("Start at ...") — skip it.
    private func firstMeaningfulStep(in route: MKRoute) -> Int {
        route.steps.indices.first(where: { !route.steps[$0].instructions.isEmpty }) ?? 0
    }

    // MARK: - Step advancement

    private func advanceStepIfNeeded(at location: CLLocation) {
        guard case .active(let idx) = navState, let route else { return }
        let step = route.steps[idx]
        let count = step.polyline.pointCount
        guard count > 0 else { return }

        // Dereference UnsafeMutablePointer<MKMapPoint> immediately — never store it.
        let endCoord = step.polyline.points()[count - 1].coordinate
        distanceToStep = location.distance(from: CLLocation(latitude: endCoord.latitude,
                                                             longitude: endCoord.longitude))

        if distanceToStep < 25 {
            let next = idx + 1
            if next < route.steps.count {
                navState = .active(stepIndex: next)
            } else {
                navState = .arrived
            }
        }
    }

    // MARK: - Arrow angle

    private func refreshArrowAngle() {
        guard case .active(let idx) = navState,
              let route,
              let loc = lastLocation else { return }

        let step = route.steps[idx]
        let count = step.polyline.pointCount
        guard count >= 2 else { return }

        // Use the step-end coordinate as the bearing target.
        let pts = step.polyline.points()   // valid only within this scope
        let targetCoord = pts[count - 1].coordinate
        let rawBearing = bearing(from: loc.coordinate, to: targetCoord)

        // Accumulate delta normalized to [-180, 180] so SwiftUI always animates
        // the short arc and never spins through 360°.
        var delta = rawBearing - (arrowAngle.truncatingRemainder(dividingBy: 360) + 360)
            .truncatingRemainder(dividingBy: 360) - currentHeading
        delta = delta.truncatingRemainder(dividingBy: 360)
        if delta > 180  { delta -= 360 }
        if delta < -180 { delta += 360 }
        arrowAngle += delta
    }

    private func bearing(from: CLLocationCoordinate2D, to: CLLocationCoordinate2D) -> Double {
        let φ1 = from.latitude  * .pi / 180
        let φ2 = to.latitude    * .pi / 180
        let Δλ = (to.longitude - from.longitude) * .pi / 180
        let y = sin(Δλ) * cos(φ2)
        let x = cos(φ1) * sin(φ2) - sin(φ1) * cos(φ2) * cos(Δλ)
        return (atan2(y, x) * 180 / .pi + 360).truncatingRemainder(dividingBy: 360)
    }
}

// MARK: - CLLocationManagerDelegate (heading only)

extension NavigationManager: CLLocationManagerDelegate {
    nonisolated func locationManager(_ manager: CLLocationManager,
                                     didUpdateHeading newHeading: CLHeading) {
        // trueHeading requires an active GPS fix; fall back to magnetic when unavailable.
        let degrees = newHeading.trueHeading >= 0 ? newHeading.trueHeading : newHeading.magneticHeading
        Task { @MainActor [weak self] in
            self?.currentHeading = degrees
            self?.refreshArrowAngle()
        }
    }

    nonisolated func locationManagerShouldDisplayHeadingCalibration(_ manager: CLLocationManager) -> Bool {
        true
    }
}
