import AVFoundation
import Combine
import UIKit

/// Dual-camera capture using `AVCaptureMultiCamSession` (iPhone XS / A12 +).
/// Both back + front cameras stream simultaneously; `activeCamera` controls
/// which feed is forwarded to the ML loop and rolling recorder.
final class CameraManager: NSObject, ObservableObject {
    let session: AVCaptureSession
    let backPreviewLayer: AVCaptureVideoPreviewLayer
    let frontPreviewLayer: AVCaptureVideoPreviewLayer

    @Published var isRunning = false
    @Published var isConfiguring = false
    @Published var permissionDenied = false
    @Published var hasFrontCamera = false
    @Published var hasBackDepthSensor = false
    @Published var hasFrontDepthSensor = false
    @Published private(set) var latestDepthSignal: SceneDepthSignal?
    @Published var activeCamera: AVCaptureDevice.Position = .back

    var hasDepthSensorForActiveCamera: Bool {
        activeCamera == .back ? hasBackDepthSensor : hasFrontDepthSensor
    }

    private let sessionQueue = DispatchQueue(label: "camera.session", qos: .userInteractive)
    private let outputQueue = DispatchQueue(label: "camera.output", qos: .userInteractive)
    private let backOutput = AVCaptureVideoDataOutput()
    private let frontOutput = AVCaptureVideoDataOutput()
    private let backDepthOutput = AVCaptureDepthDataOutput()
    private let frontDepthOutput = AVCaptureDepthDataOutput()
    private let audioOutput = AVCaptureAudioDataOutput()

    private let frameSubject = PassthroughSubject<CMSampleBuffer, Never>()
    private let audioSubject = PassthroughSubject<CMSampleBuffer, Never>()

    var framePublisher: AnyPublisher<CMSampleBuffer, Never> { frameSubject.eraseToAnyPublisher() }
    var audioPublisher: AnyPublisher<CMSampleBuffer, Never> { audioSubject.eraseToAnyPublisher() }

    override init() {
        let s: AVCaptureSession = AVCaptureMultiCamSession.isMultiCamSupported
            ? AVCaptureMultiCamSession()
            : AVCaptureSession()
        self.session = s
        // Use `sessionWithNoConnection:` so each layer knows its session up front
        // (required for multicam), but doesn't auto-create a connection — we
        // wire connections explicitly so each preview is bound to one camera.
        self.backPreviewLayer = AVCaptureVideoPreviewLayer(sessionWithNoConnection: s)
        self.frontPreviewLayer = AVCaptureVideoPreviewLayer(sessionWithNoConnection: s)
        super.init()
        backPreviewLayer.videoGravity = .resizeAspectFill
        frontPreviewLayer.videoGravity = .resizeAspectFill

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

    // MARK: - Public API

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

    func stop() {
        sessionQueue.async { [weak self] in
            guard let self, self.session.isRunning else { return }
            self.session.stopRunning()
            DispatchQueue.main.async { self.isRunning = false }
        }
    }

    /// Switch which camera's frames are sent to the perception loop and recorder.
    func setActiveCamera(_ position: AVCaptureDevice.Position) {
        DispatchQueue.main.async {
            self.activeCamera = position
            self.latestDepthSignal = nil
        }
    }

    // MARK: - Setup

    private func setupSession() {
        try? AVAudioSession.sharedInstance().setCategory(
            .playAndRecord, mode: .default,
            options: [.mixWithOthers, .defaultToSpeaker]
        )
        try? AVAudioSession.sharedInstance().setActive(true)

        if let multi = session as? AVCaptureMultiCamSession {
            setupMultiCam(multi)
        } else {
            setupSingleCam()
        }

        session.startRunning()
        DispatchQueue.main.async { self.isRunning = true; self.isConfiguring = false }
    }

    private func setupMultiCam(_ session: AVCaptureMultiCamSession) {
        session.beginConfiguration()
        defer { session.commitConfiguration() }

        // ─── Back camera ───
        guard let backDevice = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back),
              let backInput = try? AVCaptureDeviceInput(device: backDevice),
              session.canAddInput(backInput) else { return }
        // Pick a multicam-compatible format up front — the device's default
        // 1080p/30 may exceed the multicam cost budget and silently refuse to
        // start, leaving both previews black.
        Self.applyMultiCamFormat(to: backDevice)
        session.addInputWithNoConnections(backInput)

        backOutput.setSampleBufferDelegate(self, queue: outputQueue)
        backOutput.alwaysDiscardsLateVideoFrames = true
        guard session.canAddOutput(backOutput) else { return }
        session.addOutputWithNoConnections(backOutput)

        guard let backVideoPort = backInput.ports(for: .video,
                                                  sourceDeviceType: backDevice.deviceType,
                                                  sourceDevicePosition: .back).first else { return }
        let backOutConn = AVCaptureConnection(inputPorts: [backVideoPort], output: backOutput)
        if session.canAddConnection(backOutConn) { session.addConnection(backOutConn) }

        configureDepthOutputIfAvailable(session: session,
                                        input: backInput,
                                        device: backDevice,
                                        output: backDepthOutput,
                                        position: .back)

        let backPreviewConn = AVCaptureConnection(inputPort: backVideoPort, videoPreviewLayer: backPreviewLayer)
        if session.canAddConnection(backPreviewConn) { session.addConnection(backPreviewConn) }

        // ─── Front camera ───
        if let frontDevice = Self.frontCameraDevice(),
           let frontInput = try? AVCaptureDeviceInput(device: frontDevice),
           session.canAddInput(frontInput) {
            Self.applyMultiCamFormat(to: frontDevice)
            session.addInputWithNoConnections(frontInput)

            frontOutput.setSampleBufferDelegate(self, queue: outputQueue)
            frontOutput.alwaysDiscardsLateVideoFrames = true
            if session.canAddOutput(frontOutput) {
                session.addOutputWithNoConnections(frontOutput)

                if let frontVideoPort = frontInput.ports(for: .video,
                                                         sourceDeviceType: frontDevice.deviceType,
                                                         sourceDevicePosition: .front).first {
                    let frontOutConn = AVCaptureConnection(inputPorts: [frontVideoPort], output: frontOutput)
                    if session.canAddConnection(frontOutConn) { session.addConnection(frontOutConn) }

                    configureDepthOutputIfAvailable(session: session,
                                                    input: frontInput,
                                                    device: frontDevice,
                                                    output: frontDepthOutput,
                                                    position: .front)

                    let frontPreviewConn = AVCaptureConnection(inputPort: frontVideoPort,
                                                                videoPreviewLayer: frontPreviewLayer)
                    if session.canAddConnection(frontPreviewConn) { session.addConnection(frontPreviewConn) }

                    DispatchQueue.main.async { self.hasFrontCamera = true }
                }
            }
        }

        // ─── Audio (single shared input) ───
        if let audioDevice = AVCaptureDevice.default(for: .audio),
           let audioInput = try? AVCaptureDeviceInput(device: audioDevice),
           session.canAddInput(audioInput) {
            session.addInputWithNoConnections(audioInput)
            audioOutput.setSampleBufferDelegate(self, queue: outputQueue)
            if session.canAddOutput(audioOutput) {
                session.addOutputWithNoConnections(audioOutput)
                if let audioPort = audioInput.ports(for: .audio,
                                                     sourceDeviceType: nil,
                                                     sourceDevicePosition: .unspecified).first {
                    let audioConn = AVCaptureConnection(inputPorts: [audioPort], output: audioOutput)
                    if session.canAddConnection(audioConn) { session.addConnection(audioConn) }
                }
            }
        }
    }

    private func configureDepthOutputIfAvailable(
        session: AVCaptureSession,
        input: AVCaptureDeviceInput,
        device: AVCaptureDevice,
        output: AVCaptureDepthDataOutput,
        position: AVCaptureDevice.Position
    ) {
        guard AppConfig.sceneDepthEnabled else { return }
        guard !device.activeFormat.supportedDepthDataFormats.isEmpty else { return }
        Self.applyDepthFormat(to: device)

        output.setDelegate(self, callbackQueue: outputQueue)
        output.isFilteringEnabled = true

        if let multi = session as? AVCaptureMultiCamSession {
            guard session.canAddOutput(output) else { return }
            session.addOutputWithNoConnections(output)
            guard let depthPort = input.ports(for: .depthData,
                                              sourceDeviceType: device.deviceType,
                                              sourceDevicePosition: position).first else { return }
            let depthConn = AVCaptureConnection(inputPorts: [depthPort], output: output)
            if multi.canAddConnection(depthConn) {
                multi.addConnection(depthConn)
                setDepthSensorAvailable(for: position)
            }
        } else if session.canAddOutput(output) {
            session.addOutput(output)
            setDepthSensorAvailable(for: position)
        }
    }

    private func setDepthSensorAvailable(for position: AVCaptureDevice.Position) {
        DispatchQueue.main.async {
            if position == .back { self.hasBackDepthSensor = true }
            if position == .front { self.hasFrontDepthSensor = true }
        }
    }

    private static func frontCameraDevice() -> AVCaptureDevice? {
        AVCaptureDevice.default(.builtInTrueDepthCamera, for: .video, position: .front)
            ?? AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .front)
    }

    /// Pick a multicam-supported format for `device`, preferring 720p (cheap,
    /// fits the multicam cost budget on every supported device) and falling
    /// back to the smallest multicam-supported format otherwise.
    private static func applyMultiCamFormat(to device: AVCaptureDevice) {
        let multiCamFormats = device.formats.filter { $0.isMultiCamSupported }
        guard !multiCamFormats.isEmpty else { return }
        let preferred = multiCamFormats.first(where: { format in
            let dim = CMVideoFormatDescriptionGetDimensions(format.formatDescription)
            return dim.width == 1280 && dim.height == 720
        }) ?? multiCamFormats.min(by: { lhs, rhs in
            let l = CMVideoFormatDescriptionGetDimensions(lhs.formatDescription)
            let r = CMVideoFormatDescriptionGetDimensions(rhs.formatDescription)
            return Int64(l.width) * Int64(l.height) < Int64(r.width) * Int64(r.height)
        })
        guard let chosen = preferred else { return }
        do {
            try device.lockForConfiguration()
            device.activeFormat = chosen
            device.unlockForConfiguration()
        } catch {
            // Best-effort; if locking fails the device keeps its default format.
        }
    }

    private static func applyDepthFormat(to device: AVCaptureDevice) {
        let formats = device.activeFormat.supportedDepthDataFormats
        guard let format = formats.first(where: { depthFormat in
            CMFormatDescriptionGetMediaSubType(depthFormat.formatDescription) == kCVPixelFormatType_DepthFloat32
        }) ?? formats.first else { return }
        do {
            try device.lockForConfiguration()
            device.activeDepthDataFormat = format
            device.unlockForConfiguration()
        } catch {
            // Best effort; the camera continues without LiDAR/depth assist.
        }
    }

    /// Fallback for devices without multicam support — back camera only.
    private func setupSingleCam() {
        session.beginConfiguration()
        session.sessionPreset = .hd1920x1080

        guard let backDevice = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back),
              let backInput = try? AVCaptureDeviceInput(device: backDevice),
              session.canAddInput(backInput) else {
            session.commitConfiguration()
            return
        }
        session.addInput(backInput)

        if let audioDevice = AVCaptureDevice.default(for: .audio),
           let audioInput = try? AVCaptureDeviceInput(device: audioDevice),
           session.canAddInput(audioInput) {
            session.addInput(audioInput)
        }

        backOutput.setSampleBufferDelegate(self, queue: outputQueue)
        backOutput.alwaysDiscardsLateVideoFrames = true
        if session.canAddOutput(backOutput) { session.addOutput(backOutput) }
        configureDepthOutputIfAvailable(session: session,
                                        input: backInput,
                                        device: backDevice,
                                        output: backDepthOutput,
                                        position: .back)

        audioOutput.setSampleBufferDelegate(self, queue: outputQueue)
        if session.canAddOutput(audioOutput) { session.addOutput(audioOutput) }

        backPreviewLayer.session = session
        session.commitConfiguration()
    }
}

// MARK: - Sample buffer routing

extension CameraManager: AVCaptureVideoDataOutputSampleBufferDelegate, AVCaptureAudioDataOutputSampleBufferDelegate, AVCaptureDepthDataOutputDelegate {
    func captureOutput(_ output: AVCaptureOutput,
                       didOutput sampleBuffer: CMSampleBuffer,
                       from connection: AVCaptureConnection) {
        if output === backOutput {
            if activeCamera == .back { frameSubject.send(sampleBuffer) }
        } else if output === frontOutput {
            if activeCamera == .front { frameSubject.send(sampleBuffer) }
        } else if output === audioOutput {
            audioSubject.send(sampleBuffer)
        }
    }

    func depthDataOutput(_ output: AVCaptureDepthDataOutput,
                         didOutput depthData: AVDepthData,
                         timestamp: CMTime,
                         connection: AVCaptureConnection) {
        let converted = depthData.depthDataType == kCVPixelFormatType_DepthFloat32
            ? depthData
            : depthData.converting(toDepthDataType: kCVPixelFormatType_DepthFloat32)
        guard let signal = SceneDepthSignal.make(from: converted.depthDataMap) else { return }
        let outputPosition: AVCaptureDevice.Position = output === frontDepthOutput ? .front : .back
        DispatchQueue.main.async { [weak self] in
            guard let self, self.activeCamera == outputPosition else { return }
            self.latestDepthSignal = signal
        }
    }
}
