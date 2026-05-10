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
    @Published var distanceToStep: CLLocationDistance = 0
    @Published var arrowAngle: Double = 0       // accumulated, short-arc normalized
    @Published var userHeading: Double = 0
    @Published var userCoordinate: CLLocationCoordinate2D?

    private(set) var route: MKRoute?
    private var lastLocation: CLLocation?
    private var lastRawAngle: Double = 0
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
        distanceToStep = 0
        arrowAngle = 0
        lastRawAngle = 0
    }

    func updateLocation(_ location: CLLocation) {
        lastLocation = location
        userCoordinate = location.coordinate
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
        } catch {
            guard !Task.isCancelled else { return }
            navState = .failed(error.localizedDescription)
        }
    }

    private func firstMeaningfulStep(in route: MKRoute) -> Int {
        route.steps.indices.first(where: { !route.steps[$0].instructions.isEmpty }) ?? 0
    }

    // MARK: - Step advancement

    private func advanceStepIfNeeded(at location: CLLocation) {
        guard case .active(let idx) = navState, let route else { return }
        let step = route.steps[idx]
        let count = step.polyline.pointCount
        guard count > 0 else { return }

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
        guard count > 0 else { return }

        let targetCoord = step.polyline.points()[count - 1].coordinate
        let rawBearing = bearing(from: loc.coordinate, to: targetCoord)
        let targetRaw = (rawBearing - userHeading + 360).truncatingRemainder(dividingBy: 360)

        // Accumulate with short-arc delta so SwiftUI never animates through 360°.
        var delta = targetRaw - lastRawAngle
        if delta > 180  { delta -= 360 }
        if delta < -180 { delta += 360 }
        lastRawAngle = targetRaw
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

// MARK: - Heading delegate

extension NavigationManager: CLLocationManagerDelegate {
    nonisolated func locationManager(_ manager: CLLocationManager,
                                     didUpdateHeading newHeading: CLHeading) {
        let degrees = newHeading.trueHeading >= 0 ? newHeading.trueHeading : newHeading.magneticHeading
        Task { @MainActor [weak self] in
            self?.userHeading = degrees
            self?.refreshArrowAngle()
        }
    }

    nonisolated func locationManagerShouldDisplayHeadingCalibration(_ manager: CLLocationManager) -> Bool {
        true
    }
}
