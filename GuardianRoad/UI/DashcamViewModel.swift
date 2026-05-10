import Foundation
import Combine
import CoreLocation

@MainActor
final class DashcamViewModel: NSObject, ObservableObject {
    let camera = CameraManager()
    let recorder = RollingRecorder()
    let navigation = NavigationManager()
    let perception = PerceptionManager()
    let sceneDepth = SceneDepthManager()

    @Published var saveStatus: String = ""
    @Published var currentLocation: CLLocation?
    @Published var isSceneDepthRequested = false

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
        perception.depthProvider = { [weak self] in self?.sceneDepth.latestFreshSignal }
        perception.attach(framePublisher: camera.framePublisher)

        sceneDepth.objectWillChange
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in self?.objectWillChange.send() }
            .store(in: &cancellables)

        Publishers.CombineLatest3(camera.$isRunning, camera.$activeCamera, $isSceneDepthRequested)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] isRunning, activeCamera, wantsDepth in
                guard let self else { return }
                if wantsDepth && isRunning && activeCamera == .back {
                    self.sceneDepth.start()
                } else {
                    self.sceneDepth.stop()
                }
            }
            .store(in: &cancellables)
    }

    func start() {
        locationManager.requestWhenInUseAuthorization()
        locationManager.startUpdatingLocation()
        camera.requestPermissionsAndSetup()
    }

    func stop() {
        isSceneDepthRequested = false
        sceneDepth.stop()
        camera.stop()
        locationManager.stopUpdatingLocation()
    }

    func toggleSceneDepth() {
        guard sceneDepth.isSupported else {
            showStatus("LiDAR depth unavailable on this iPhone")
            return
        }
        if camera.activeCamera != .back {
            showStatus("LiDAR depth uses the rear camera")
            return
        }
        isSceneDepthRequested.toggle()
        showStatus(isSceneDepthRequested ? "LiDAR depth enabled" : "LiDAR depth paused")
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
