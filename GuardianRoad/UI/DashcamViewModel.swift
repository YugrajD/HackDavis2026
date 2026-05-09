import Foundation
import Combine
import CoreLocation

@MainActor
final class DashcamViewModel: NSObject, ObservableObject {
    let camera = CameraManager()
    let recorder = RollingRecorder()
    let keyword = KeywordDetector()

    @Published var saveStatus: String = ""
    @Published var currentLocation: CLLocation?

    private var cancellables = Set<AnyCancellable>()
    private let locationManager = CLLocationManager()

    override init() {
        super.init()
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyBest

        camera.framePublisher
            .sink { [weak self] buffer in self?.recorder.appendFrame(buffer) }
            .store(in: &cancellables)

        // Single audio stream feeds both recorder (for sound in clips) and
        // keyword detector (so no AVAudioEngine conflict with the camera session).
        camera.audioPublisher
            .sink { [weak self] buffer in
                self?.recorder.appendAudioFrame(buffer)
                self?.keyword.appendAudioBuffer(buffer)
            }
            .store(in: &cancellables)

        keyword.onKeywordDetected = { [weak self] in
            Task { @MainActor [weak self] in self?.triggerSave(reason: "voice") }
        }
    }

    func start() {
        locationManager.requestWhenInUseAuthorization()
        locationManager.startUpdatingLocation()
        camera.requestPermissionsAndSetup()
        keyword.start()
    }

    func stop() {
        camera.stop()
        keyword.stop()
        locationManager.stopUpdatingLocation()
    }

    /// Called by the UI button, voice trigger, or partner's ML hazard detection.
    func triggerSave(reason: String) {
        recorder.triggerSave(location: currentLocation, triggerType: reason) { [weak self] result in
            Task { @MainActor [weak self] in
                switch result {
                case .success:
                    self?.showStatus("Clip saved to Photos")
                case .failure(let error):
                    self?.showStatus("Save failed: \(error)")
                }
            }
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
    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let loc = locations.last else { return }
        Task { @MainActor [weak self] in self?.currentLocation = loc }
    }
}
