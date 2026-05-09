import AVFoundation
import Combine
import UIKit

final class CameraManager: NSObject, ObservableObject {
    let session = AVCaptureSession()

    private let sessionQueue = DispatchQueue(label: "camera.session", qos: .userInteractive)
    private let outputQueue = DispatchQueue(label: "camera.output", qos: .userInteractive)
    private let videoOutput = AVCaptureVideoDataOutput()
    private let audioOutput = AVCaptureAudioDataOutput()

    private let frameSubject = PassthroughSubject<CMSampleBuffer, Never>()
    private let audioSubject = PassthroughSubject<CMSampleBuffer, Never>()

    var framePublisher: AnyPublisher<CMSampleBuffer, Never> { frameSubject.eraseToAnyPublisher() }
    var audioPublisher: AnyPublisher<CMSampleBuffer, Never> { audioSubject.eraseToAnyPublisher() }

    @Published var isRunning = false
    @Published var isConfiguring = false
    @Published var permissionDenied = false

    override init() {
        super.init()
        NotificationCenter.default.addObserver(
            forName: .AVCaptureSessionWasInterrupted, object: session, queue: .main
        ) { [weak self] _ in self?.isRunning = false }
        NotificationCenter.default.addObserver(
            forName: .AVCaptureSessionInterruptionEnded, object: session, queue: .main
        ) { [weak self] _ in
            self?.sessionQueue.async {
                if self?.session.isRunning == false { self?.session.startRunning() }
            }
            DispatchQueue.main.async { self?.isRunning = true }
        }
        NotificationCenter.default.addObserver(
            forName: UIApplication.willEnterForegroundNotification, object: nil, queue: .main
        ) { [weak self] _ in
            self?.sessionQueue.async {
                if self?.session.isRunning == false { self?.session.startRunning() }
                DispatchQueue.main.async { self?.isRunning = true }
            }
        }
    }

    func requestPermissionsAndSetup() {
        DispatchQueue.main.async { self.isConfiguring = true }
        AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
            guard let self else { return }
            guard granted else {
                DispatchQueue.main.async { self.permissionDenied = true; self.isConfiguring = false }
                return
            }
            AVCaptureDevice.requestAccess(for: .audio) { [weak self] _ in
                self?.sessionQueue.async { self?.setupSession() }
            }
        }
    }

    private func setupSession() {
        try? AVAudioSession.sharedInstance().setCategory(
            .playAndRecord, mode: .default,
            options: [.mixWithOthers, .defaultToSpeaker]
        )
        try? AVAudioSession.sharedInstance().setActive(true)

        session.beginConfiguration()
        session.sessionPreset = .hd1920x1080

        guard
            let videoDevice = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back),
            let videoInput = try? AVCaptureDeviceInput(device: videoDevice),
            session.canAddInput(videoInput)
        else {
            session.commitConfiguration()
            return
        }
        session.addInput(videoInput)

        if let audioDevice = AVCaptureDevice.default(for: .audio),
           let audioInput = try? AVCaptureDeviceInput(device: audioDevice),
           session.canAddInput(audioInput) {
            session.addInput(audioInput)
        }

        videoOutput.setSampleBufferDelegate(self, queue: outputQueue)
        videoOutput.alwaysDiscardsLateVideoFrames = true
        if session.canAddOutput(videoOutput) { session.addOutput(videoOutput) }

        audioOutput.setSampleBufferDelegate(self, queue: outputQueue)
        if session.canAddOutput(audioOutput) { session.addOutput(audioOutput) }

        session.commitConfiguration()
        session.startRunning()
        DispatchQueue.main.async { self.isRunning = true; self.isConfiguring = false }
    }

    func stop() {
        sessionQueue.async { [weak self] in
            guard let self, self.session.isRunning else { return }
            self.session.stopRunning()
            DispatchQueue.main.async { self.isRunning = false }
        }
    }
}

extension CameraManager: AVCaptureVideoDataOutputSampleBufferDelegate, AVCaptureAudioDataOutputSampleBufferDelegate {
    func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        if output === videoOutput {
            frameSubject.send(sampleBuffer)
        } else {
            audioSubject.send(sampleBuffer)
        }
    }
}
