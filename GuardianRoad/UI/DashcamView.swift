import SwiftUI

struct DashcamView: View {
    @StateObject private var vm = DashcamViewModel()
    @State private var pulse = false
    @State private var showNavSearch = false
    @State private var previewSize: CGSize = .zero

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            if vm.camera.permissionDenied {
                permissionDeniedView
            } else {
                GeometryReader { geo in
                    ZStack {
                        CameraPreview(session: vm.camera.session)
                            .ignoresSafeArea()
                        detectionOverlay(in: geo.size)
                    }
                    .onAppear { previewSize = geo.size }
                    .onChange(of: geo.size) { _, newSize in previewSize = newSize }
                }
                .ignoresSafeArea()
                overlay
                NavigationOverlay(nav: vm.navigation)
            }
        }
        .onAppear { vm.start() }
        .onDisappear { vm.stop() }
        .sheet(isPresented: $showNavSearch) {
            DestinationSearchView(nav: vm.navigation)
        }
    }

    // MARK: - Overlay HUD

    private var overlay: some View {
        VStack(spacing: 0) {
            topBar
            perceptionNote
            Spacer()
            if !vm.saveStatus.isEmpty { statusToast }
            bottomBar
        }
    }

    private var topBar: some View {
        HStack(spacing: 10) {
            Text("GUARDIAN ROAD")
                .font(.system(size: 13, weight: .bold, design: .monospaced))
                .foregroundStyle(.white.opacity(0.85))
            Spacer()
            hudChip
            recordingIndicator
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(.black.opacity(0.5))
    }

    private var hudChip: some View {
        HStack(spacing: 4) {
            Text("HUD")
                .font(.system(size: 10, weight: .semibold, design: .monospaced))
                .foregroundStyle(Color(red: 0.65, green: 0.95, blue: 1.0))
            Text("\(vm.perception.hudScore)")
                .font(.system(size: 11, weight: .bold, design: .monospaced))
                .foregroundStyle(.white)
            Text("· \(vm.perception.detections.count)")
                .font(.system(size: 11, weight: .medium, design: .monospaced))
                .foregroundStyle(.white.opacity(0.6))
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(Color.cyan.opacity(0.18))
        .overlay(Capsule().stroke(Color.cyan.opacity(0.5), lineWidth: 1))
        .clipShape(Capsule())
    }

    @ViewBuilder
    private var perceptionNote: some View {
        if let note = vm.perception.note, !note.isEmpty {
            Text(note)
                .font(.system(size: 11, weight: .medium, design: .monospaced))
                .foregroundStyle(.yellow)
                .lineLimit(2)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(.black.opacity(0.65), in: Capsule())
                .padding(.top, 6)
        }
    }

    @ViewBuilder
    private func detectionOverlay(in size: CGSize) -> some View {
        ForEach(vm.perception.detections) { d in
            if let r = d.rect(in: size) {
                ZStack(alignment: .topLeading) {
                    Rectangle()
                        .stroke(Color(red: 0.29, green: 0.87, blue: 0.5), lineWidth: 2)
                        .background(Color.green.opacity(0.14))
                    Text(d.label)
                        .font(.system(size: 9, weight: .semibold, design: .monospaced))
                        .foregroundStyle(Color(red: 0.02, green: 0.18, blue: 0.09))
                        .padding(.horizontal, 4)
                        .padding(.vertical, 1)
                        .background(Color(red: 0.29, green: 0.87, blue: 0.5).opacity(0.92))
                }
                .frame(width: r.width, height: r.height)
                .position(x: r.midX, y: r.midY)
                .allowsHitTesting(false)
            }
        }
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
            navButton
            Spacer()
            saveButton
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .background(.black.opacity(0.6))
    }

    private var navButton: some View {
        Button {
            switch vm.navigation.navState {
            case .idle, .failed:
                showNavSearch = true
            default:
                vm.navigation.stopNavigation()
            }
        } label: {
            Image(systemName: navButtonIcon)
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 36, height: 36)
                .background(navButtonTint, in: Circle())
        }
        .animation(.easeInOut(duration: 0.2), value: navButtonTint)
    }

    private var navButtonIcon: String {
        switch vm.navigation.navState {
        case .active, .arrived: return "xmark"
        case .routing:          return "ellipsis"
        default:                return "location.fill"
        }
    }

    private var navButtonTint: Color {
        switch vm.navigation.navState {
        case .routing:          return .orange
        case .active:           return .blue
        case .arrived:          return .green
        default:                return .white.opacity(0.2)
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
