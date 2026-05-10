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

    private(set) var route: MKRoute?
    private var lastLocation: CLLocation?
    private var routingTask: Task<Void, Never>?

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
    }

    /// Called by DashcamViewModel whenever its location manager fires.
    func updateLocation(_ location: CLLocation) {
        lastLocation = location
        advanceStepIfNeeded(at: location)
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
        // Maps URL-scheme destination, not as a MKDirections request source.
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
}
