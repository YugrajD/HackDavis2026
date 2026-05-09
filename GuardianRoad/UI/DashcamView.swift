import SwiftUI

struct DashcamView: View {
    @StateObject private var vm = DashcamViewModel()
    @State private var pulse = false

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            if vm.camera.permissionDenied {
                permissionDeniedView
            } else {
                CameraPreview(session: vm.camera.session)
                    .ignoresSafeArea()
                overlay
            }
        }
        .onAppear { vm.start() }
        .onDisappear { vm.stop() }
    }

    // MARK: - Overlay HUD

    private var overlay: some View {
        VStack(spacing: 0) {
            topBar
            Spacer()
            if !vm.saveStatus.isEmpty { statusToast }
            bottomBar
        }
    }

    private var topBar: some View {
        HStack {
            Text("GUARDIAN ROAD")
                .font(.system(size: 13, weight: .bold, design: .monospaced))
                .foregroundStyle(.white.opacity(0.85))
            Spacer()
            recordingIndicator
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(.black.opacity(0.5))
    }

    private var recordingIndicator: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(indicatorColor)
                .frame(width: 10, height: 10)
                .scaleEffect(pulse ? 1.3 : 1.0)
                .animation(.easeInOut(duration: 0.7).repeatForever(autoreverses: true), value: pulse)
                .onAppear { pulse = true }
            Text(indicatorLabel)
                .font(.system(size: 12, weight: .bold, design: .monospaced))
                .foregroundStyle(indicatorColor)
        }
    }

    private var indicatorLabel: String {
        if vm.camera.isRunning { return "REC" }
        if vm.camera.isConfiguring { return "STARTING" }
        return "PAUSED"
    }

    private var indicatorColor: Color {
        if vm.camera.isRunning { return .red }
        if vm.camera.isConfiguring { return .yellow }
        return .orange
    }

    private var bottomBar: some View {
        HStack(alignment: .center, spacing: 16) {
            Spacer()
            locationBadge
            saveButton
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .background(.black.opacity(0.6))
    }

    private var locationBadge: some View {
        Group {
            if let loc = vm.currentLocation {
                Text(String(format: "%.4f, %.4f", loc.coordinate.latitude, loc.coordinate.longitude))
                    .font(.system(size: 10, design: .monospaced))
                    .foregroundStyle(.white.opacity(0.5))
            }
        }
    }

    private var saveButton: some View {
        Button {
            vm.triggerSave(reason: "manual")
        } label: {
            HStack(spacing: 6) {
                Image(systemName: "square.and.arrow.down.fill")
                Text("SAVE CLIP")
                    .font(.system(size: 13, weight: .bold))
            }
            .foregroundStyle(.white)
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(vm.recorder.isSaving ? Color.gray : Color.red)
            .clipShape(Capsule())
        }
        .disabled(vm.recorder.isSaving)
    }

    private var statusToast: some View {
        Text(vm.saveStatus)
            .font(.system(size: 14, weight: .medium))
            .foregroundStyle(.white)
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            .background(.black.opacity(0.75))
            .clipShape(Capsule())
            .padding(.bottom, 8)
            .transition(.opacity)
            .animation(.easeInOut(duration: 0.3), value: vm.saveStatus)
    }

    // MARK: - Permission Denied

    private var permissionDeniedView: some View {
        VStack(spacing: 16) {
            Image(systemName: "video.slash")
                .font(.system(size: 48))
                .foregroundStyle(.gray)
            Text("Camera access required")
                .font(.title3.bold())
                .foregroundStyle(.white)
            Text("Enable camera access in Settings → Guardian Road")
                .font(.subheadline)
                .foregroundStyle(.gray)
                .multilineTextAlignment(.center)
            Button("Open Settings") {
                if let url = URL(string: UIApplication.openSettingsURLString) {
                    UIApplication.shared.open(url)
                }
            }
            .buttonStyle(.borderedProminent)
            .tint(.red)
        }
        .padding()
    }
}
