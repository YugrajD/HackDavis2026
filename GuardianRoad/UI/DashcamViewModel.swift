import Foundation
import Combine
import CoreLocation

@MainActor
final class DashcamViewModel: NSObject, ObservableObject {
    let camera = CameraManager()
    let recorder = RollingRecorder()
    let navigation = NavigationManager()
    let perception = PerceptionManager()

    @Published var saveStatus: String = ""
    @Published var currentLocation: CLLocation?

    private var cancellables = Set<AnyCancellable>()
    private let locationManager = CLLocationManager()

    override init() {
        super.init()
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyBestForNavigation

        camera.framePublisher
            .sink { [weak self] buffer in self?.recorder.appendFrame(buffer) }
            .store(in: &cancellables)

        camera.audioPublisher
            .sink { [weak self] buffer in self?.recorder.appendAudioFrame(buffer) }
            .store(in: &cancellables)

        perception.locationProvider = { [weak self] in self?.currentLocation }
        perception.headingProvider = { [weak self] in self?.navigation.userHeading ?? 0 }
        perception.attach(framePublisher: camera.framePublisher)
    }

    func start() {
        locationManager.requestWhenInUseAuthorization()
        locationManager.startUpdatingLocation()
        camera.requestPermissionsAndSetup()
    }

    func stop() {
        camera.stop()
        locationManager.stopUpdatingLocation()
    }

    private let uploader = MediaUploadClient()

    /// Called by the UI button or partner's ML hazard detection.
    /// Finalises the rolling segment, uploads the .mp4 to the backend, and creates a
    /// hazard event in MongoDB so the in-app gallery picks it up.
    func triggerSave(reason: String) {
        recorder.triggerSave(location: currentLocation, triggerType: reason) { [weak self] result in
            Task { @MainActor [weak self] in
                guard let self else { return }
                switch result {
                case .success(let url):
                    self.showStatus("Uploading clip…")
                    await self.uploadAndPersist(localURL: url)
                case .failure(let error):
                    self.showStatus("Save failed: \(error)")
                }
            }
        }
    }

    private func uploadAndPersist(localURL: URL) async {
        let loc = currentLocation
        let heading = navigation.userHeading
        let speed = max(0, loc?.speed ?? 0)
        do {
            _ = try await uploader.uploadAndPersist(
                clipURL: localURL,
                rideId: "demo-ride-1",
                location: loc.map { ($0.coordinate.latitude, $0.coordinate.longitude) },
                headingDeg: heading,
                speedMps: speed
            )
            showStatus("Clip saved to gallery")
            try? FileManager.default.removeItem(at: localURL)
        } catch {
            showStatus("Upload failed: \(error.localizedDescription)")
        }
    }

    private func showStatus(_ message: String) {
        saveStatus = message
        Task {
            try? await Task.sleep(for: .seconds(3))
            if saveStatus == message { saveStatus = "" }
        }
    }
}

extension DashcamViewModel: CLLocationManagerDelegate {
    nonisolated func locationManager(_ manager: CLLocationManager,
                                     didUpdateLocations locations: [CLLocation]) {
        guard let loc = locations.last else { return }
        Task { @MainActor [weak self] in
            self?.currentLocation = loc
            self?.navigation.updateLocation(loc)
        }
    }
}
