import AVFoundation
import Photos
import CoreLocation

final class RollingRecorder: ObservableObject {
    @Published var isSaving = false
    @Published var lastSaveResult: String?

    private let segmentDuration: TimeInterval = 60
    private let writeQueue = DispatchQueue(label: "recorder.write", qos: .userInteractive)

    private var writer: AVAssetWriter?
    private var videoInput: AVAssetWriterInput?
    private var audioInput: AVAssetWriterInput?
    private var segmentStartDate: Date?
    private var currentURL: URL?
    private var previousURL: URL?

    private var videoFormatDescription: CMFormatDescription?
    private var audioFormatDescription: CMFormatDescription?
    // Timestamp of first video frame — fallback to start video-only if audio never arrives.
    private var firstVideoReceivedAt: Date?

    // MARK: - Public

    func appendFrame(_ buffer: CMSampleBuffer) {
        writeQueue.async { [weak self] in self?._appendVideo(buffer) }
    }

    func appendAudioFrame(_ buffer: CMSampleBuffer) {
        writeQueue.async { [weak self] in self?._appendAudio(buffer) }
    }

    func triggerSave(location: CLLocation?, triggerType: String, completion: ((Result<URL, RecorderError>) -> Void)? = nil) {
        DispatchQueue.main.async { self.isSaving = true }
        writeQueue.async { [weak self] in self?._triggerSave(location: location, triggerType: triggerType, completion: completion) }
    }

    // MARK: - Private write-queue methods

    private func _appendVideo(_ buffer: CMSampleBuffer) {
        let pts = CMSampleBufferGetPresentationTimeStamp(buffer)
        guard pts.isValid else { return }

        if videoFormatDescription == nil {
            videoFormatDescription = CMSampleBufferGetFormatDescription(buffer)
            firstVideoReceivedAt = Date()
        }

        if let start = segmentStartDate, Date().timeIntervalSince(start) >= segmentDuration {
            _rotateSegment()
        }

        // Delay starting a segment until we have the audio format description so the
        // encoder is configured with the real device sample rate and channel count.
        // Fall back to video-only after 1 second in case audio permission is denied.
        if writer == nil, videoFormatDescription != nil {
            let audioReady = audioFormatDescription != nil
            let audioTimedOut = firstVideoReceivedAt.map { Date().timeIntervalSince($0) > 1.0 } ?? false
            if audioReady || audioTimedOut {
                _startNewSegment(at: pts)
            }
        }

        guard let input = videoInput, writer?.status == .writing, input.isReadyForMoreMediaData else { return }
        input.append(buffer)
    }

    private func _appendAudio(_ buffer: CMSampleBuffer) {
        if audioFormatDescription == nil {
            audioFormatDescription = CMSampleBufferGetFormatDescription(buffer)
        }
        guard let input = audioInput, writer?.status == .writing, input.isReadyForMoreMediaData else { return }
        input.append(buffer)
    }

    private func _startNewSegment(at pts: CMTime) {
        let url = tempURL()
        currentURL = url
        segmentStartDate = Date()

        guard let w = try? AVAssetWriter(outputURL: url, fileType: .mp4) else { return }

        let vInput = AVAssetWriterInput(mediaType: .video, outputSettings: videoSettings())
        vInput.expectsMediaDataInRealTime = true
        vInput.transform = CGAffineTransform(rotationAngle: .pi / 2)
        w.add(vInput)

        // Only add audio track when we have the real device format — using the
        // actual sample rate and channel count avoids encoder init failures.
        if let fmtDesc = audioFormatDescription {
            let aInput = AVAssetWriterInput(
                mediaType: .audio,
                outputSettings: audioSettings(from: fmtDesc),
                sourceFormatHint: fmtDesc
            )
            aInput.expectsMediaDataInRealTime = true
            w.add(aInput)
            audioInput = aInput
        }

        w.startWriting()
        w.startSession(atSourceTime: pts)

        writer = w
        videoInput = vInput
    }

    private func _rotateSegment() {
        let capturedWriter = writer
        let capturedVideoInput = videoInput
        let capturedAudioInput = audioInput
        let finishedURL = currentURL

        writer = nil
        videoInput = nil
        audioInput = nil
        currentURL = nil
        segmentStartDate = nil

        capturedVideoInput?.markAsFinished()
        capturedAudioInput?.markAsFinished()
        capturedWriter?.finishWriting {
            if let old = self.previousURL { try? FileManager.default.removeItem(at: old) }
            self.writeQueue.async { self.previousURL = finishedURL }
        }
    }

    private func _triggerSave(location: CLLocation?, triggerType: String, completion: ((Result<URL, RecorderError>) -> Void)?) {
        let currentAge = segmentStartDate.map { Date().timeIntervalSince($0) } ?? 0

        if currentAge >= 5, let url = currentURL {
            finalizeCurrent(url: url, completion: completion)
            return
        }

        if let completeURL = previousURL {
            previousURL = nil
            saveToPhotos(url: completeURL) { [weak self] result in
                DispatchQueue.main.async {
                    self?.isSaving = false
                    self?.lastSaveResult = (try? result.get()) != nil ? "Saved!" : "Save failed"
                }
                completion?(result)
            }
            return
        }

        if let url = currentURL {
            finalizeCurrent(url: url, completion: completion)
            return
        }

        DispatchQueue.main.async { self.isSaving = false }
        completion?(.failure(.noSegment))
    }

    private func finalizeCurrent(url: URL, completion: ((Result<URL, RecorderError>) -> Void)?) {
        let capturedWriter = writer
        let capturedVideoInput = videoInput
        let capturedAudioInput = audioInput

        writer = nil
        videoInput = nil
        audioInput = nil
        currentURL = nil
        segmentStartDate = nil

        guard let w = capturedWriter else {
            DispatchQueue.main.async { self.isSaving = false }
            completion?(.failure(.noSegment))
            return
        }

        capturedVideoInput?.markAsFinished()
        capturedAudioInput?.markAsFinished()
        w.finishWriting { [weak self] in
            guard w.status == .completed else {
                DispatchQueue.main.async { self?.isSaving = false }
                completion?(.failure(.photosSaveFailed))
                return
            }
            self?.saveToPhotos(url: url) { result in
                DispatchQueue.main.async {
                    self?.isSaving = false
                    self?.lastSaveResult = (try? result.get()) != nil ? "Saved!" : "Save failed"
                }
                completion?(result)
            }
        }
    }

    // MARK: - Photos

    private func saveToPhotos(url: URL, completion: @escaping (Result<URL, RecorderError>) -> Void) {
        PHPhotoLibrary.requestAuthorization(for: .addOnly) { status in
            guard status == .authorized || status == .limited else {
                completion(.failure(.photosDenied))
                return
            }
            PHPhotoLibrary.shared().performChanges({
                PHAssetChangeRequest.creationRequestForAssetFromVideo(atFileURL: url)
            }) { success, _ in
                completion(success ? .success(url) : .failure(.photosSaveFailed))
            }
        }
    }

    // MARK: - Helpers

    private func videoSettings() -> [String: Any] {
        var width = 1920
        var height = 1080
        if let fmt = videoFormatDescription {
            let dim = CMVideoFormatDescriptionGetDimensions(fmt)
            width = Int(dim.width)
            height = Int(dim.height)
        }
        return [
            AVVideoCodecKey: AVVideoCodecType.h264,
            AVVideoWidthKey: width,
            AVVideoHeightKey: height,
            AVVideoCompressionPropertiesKey: [AVVideoAverageBitRateKey: 4_000_000]
        ]
    }

    private func audioSettings(from fmtDesc: CMFormatDescription) -> [String: Any] {
        let asbd = CMAudioFormatDescriptionGetStreamBasicDescription(fmtDesc)
        let sampleRate = asbd?.pointee.mSampleRate ?? 44100.0
        let channels = Int(asbd?.pointee.mChannelsPerFrame ?? 1)
        return [
            AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
            AVSampleRateKey: sampleRate,
            AVNumberOfChannelsKey: channels,
            AVEncoderBitRateKey: 96_000
        ]
    }

    private func tempURL() -> URL {
        FileManager.default.temporaryDirectory
            .appendingPathComponent("gr_\(UUID().uuidString)")
            .appendingPathExtension("mp4")
    }

    enum RecorderError: Error {
        case noSegment, photosDenied, photosSaveFailed
    }
}
