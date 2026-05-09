import Speech
import AVFoundation

final class KeywordDetector: ObservableObject {
    var keyword = "ok guardian"
    var onKeywordDetected: (() -> Void)?

    @Published var isListening = false
    @Published var authorizationDenied = false

    private let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
    private var recognitionTask: SFSpeechRecognitionTask?
    private var currentRequest: SFSpeechAudioBufferRecognitionRequest?
    private var restartTimer: Timer?
    private var lastTriggerDate: Date?

    // MARK: - Public

    func start() {
        SFSpeechRecognizer.requestAuthorization { [weak self] status in
            DispatchQueue.main.async {
                guard let self else { return }
                if status == .authorized {
                    self.startNewTask()
                } else {
                    self.authorizationDenied = true
                }
            }
        }
    }

    /// Feed raw audio from AVCaptureAudioDataOutput directly — no AVAudioEngine needed.
    func appendAudioBuffer(_ buffer: CMSampleBuffer) {
        currentRequest?.appendAudioSampleBuffer(buffer)
    }

    func stop() {
        restartTimer?.invalidate()
        restartTimer = nil
        stopCurrentTask()
        isListening = false
    }

    // MARK: - Private

    private func startNewTask() {
        stopCurrentTask()

        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        request.requiresOnDeviceRecognition = false
        currentRequest = request

        recognitionTask = recognizer?.recognitionTask(with: request) { [weak self] result, error in
            guard let self else { return }

            if let text = result?.bestTranscription.formattedString.lowercased(),
               text.contains(self.keyword) {
                let now = Date()
                if let last = self.lastTriggerDate, now.timeIntervalSince(last) < 3 { return }
                self.lastTriggerDate = now
                DispatchQueue.main.async { self.onKeywordDetected?() }
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { [weak self] in
                    self?.startNewTask()
                }
                return
            }

            if result?.isFinal == true || (error != nil && !self.isErrorCancelled(error)) {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
                    guard self?.isListening == true else { return }
                    self?.startNewTask()
                }
            }
        }

        isListening = true

        restartTimer?.invalidate()
        restartTimer = Timer.scheduledTimer(withTimeInterval: 50, repeats: false) { [weak self] _ in
            guard self?.isListening == true else { return }
            self?.startNewTask()
        }
    }

    private func stopCurrentTask() {
        currentRequest?.endAudio()
        recognitionTask?.cancel()
        currentRequest = nil
        recognitionTask = nil
    }

    private func isErrorCancelled(_ error: Error?) -> Bool {
        guard let err = error as NSError? else { return false }
        return err.code == 216 || err.domain == "kAFAssistantErrorDomain"
    }
}
