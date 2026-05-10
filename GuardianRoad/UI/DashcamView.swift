import SwiftUI
import AVFoundation

struct DashcamView: View {
    @StateObject private var vm = DashcamViewModel()
    @State private var pulse = false
    @State private var showNavSearch = false
    @State private var showGallery = false
    @State private var previewSize: CGSize = .zero
    @State private var pipHidden = false
    @State private var pipScale: CGFloat = 1
    @Namespace private var camNamespace

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            if vm.camera.permissionDenied {
                permissionDeniedView
            } else {
                GeometryReader { geo in
                    ZStack(alignment: .topTrailing) {
                        CameraPreview(layer: mainPreviewLayer)
                            .ignoresSafeArea()
                            .matchedGeometryEffect(id: "main-\(vm.camera.activeCamera == .back ? "back" : "front")",
                                                   in: camNamespace)
                        detectionOverlay(in: geo.size)
                        if vm.camera.hasFrontCamera && !pipHidden {
                            pipView
                                .padding(.top, 60)
                                .padding(.trailing, 14)
                        } else if vm.camera.hasFrontCamera && pipHidden {
                            restorePipChip
                                .padding(.top, 60)
                                .padding(.trailing, 14)
                                .transition(.scale.combined(with: .opacity))
                        }
                    }
                    .onAppear { previewSize = geo.size }
                    .onChange(of: geo.size) { _, newSize in previewSize = newSize }
                }
                .ignoresSafeArea()
                NavigationOverlay(nav: vm.navigation)
                    .zIndex(5)
                overlay
                    .zIndex(10)
            }
        }
        .onAppear { vm.start() }
        .onDisappear { vm.stop() }
        .sheet(isPresented: $showNavSearch) {
            DestinationSearchView(nav: vm.navigation)
        }
        .fullScreenCover(isPresented: $showGallery) {
            GalleryView()
        }
    }

    // MARK: - Camera feeds (multicam)

    private var mainPreviewLayer: AVFoundation.AVCaptureVideoPreviewLayer {
        vm.camera.activeCamera == .back ? vm.camera.backPreviewLayer : vm.camera.frontPreviewLayer
    }

    private var pipPreviewLayer: AVFoundation.AVCaptureVideoPreviewLayer {
        vm.camera.activeCamera == .back ? vm.camera.frontPreviewLayer : vm.camera.backPreviewLayer
    }

    private var restorePipChip: some View {
        Button {
            withAnimation(.spring(duration: 0.45, bounce: 0.2)) { pipHidden = false }
        } label: {
            Image(systemName: vm.camera.activeCamera == .back ? "person.crop.rectangle" : "car.rear")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 38, height: 38)
                .background(.ultraThinMaterial, in: Circle())
                .overlay(Circle().stroke(Color.white.opacity(0.25), lineWidth: 1))
        }
    }

    private var pipView: some View {
        CameraPreview(layer: pipPreviewLayer)
            .frame(width: 116, height: 156)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(Color.white.opacity(0.35), lineWidth: 1.2)
            )
            .overlay(alignment: .topLeading) {
                Image(systemName: "arrow.left.arrow.right")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(.white)
                    .padding(5)
                    .background(.black.opacity(0.55), in: Circle())
                    .padding(6)
            }
            .shadow(color: .black.opacity(0.4), radius: 8, x: 0, y: 3)
            .scaleEffect(pipScale)
            .matchedGeometryEffect(id: "pip-\(vm.camera.activeCamera == .back ? "front" : "back")",
                                   in: camNamespace)
            .transition(.scale.combined(with: .opacity))
            .onTapGesture {
                withAnimation(.spring(duration: 0.45, bounce: 0.25)) {
                    let next: AVCaptureDevice.Position = (vm.camera.activeCamera == .back) ? .front : .back
                    vm.camera.setActiveCamera(next)
                }
            }
            .onLongPressGesture(minimumDuration: 0.4) {
                withAnimation(.spring(duration: 0.4)) { pipHidden = true }
                let haptic = UIImpactFeedbackGenerator(style: .medium)
                haptic.impactOccurred()
            } onPressingChanged: { pressing in
                withAnimation(.easeInOut(duration: 0.18)) {
                    pipScale = pressing ? 0.92 : 1
                }
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
        HStack(alignment: .top, spacing: 10) {
            VStack(alignment: .leading, spacing: 8) {
                depthModeButton
                recordingIndicator
            }
            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
    }

    private var depthModeButton: some View {
        Button {
            vm.toggleSceneDepth()
        } label: {
            Text(depthModeLabel)
                .font(.system(size: 12, weight: .bold, design: .monospaced))
                .foregroundStyle(depthModeColor)
                .frame(minWidth: 104, minHeight: 44)
                .padding(.horizontal, 10)
                .background(.black.opacity(0.48), in: Capsule())
                .overlay(Capsule().stroke(depthModeColor.opacity(0.65), lineWidth: 1.2))
                .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .zIndex(30)
    }

    private var depthModeName: String {
        vm.camera.activeCamera == .back ? "LiDAR" : "Depth"
    }

    private var depthModeLabel: String {
        if let signal = vm.camera.latestDepthSignal, signal.isFresh(maxAgeSec: AppConfig.sceneDepthMaxAgeSec), vm.isSceneDepthRequested {
            return "\(depthModeName) \(signal.displayDistance)"
        }
        if vm.isSceneDepthRequested {
            return vm.camera.hasDepthSensorForActiveCamera ? "\(depthModeName) on" : "\(depthModeName) wait"
        }
        return "\(depthModeName) off"
    }

    private var depthModeColor: Color {
        if let signal = vm.camera.latestDepthSignal, signal.isLowLight, vm.isSceneDepthRequested { return .yellow }
        if vm.isSceneDepthRequested && !vm.camera.hasDepthSensorForActiveCamera { return .orange }
        return vm.isSceneDepthRequested ? .yellow : Color(red: 0.65, green: 0.95, blue: 1.0)
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
        HStack {
            Spacer()
            HStack(spacing: 28) {
                galleryButton
                navButton
                saveButton
            }
            .padding(.horizontal, 22)
            .padding(.vertical, 10)
            .background(.ultraThinMaterial, in: Capsule())
            .overlay(Capsule().stroke(Color.white.opacity(0.18), lineWidth: 1))
            .shadow(color: .black.opacity(0.35), radius: 10, x: 0, y: 4)
            Spacer()
        }
        .padding(.bottom, 8)
    }

    private var galleryButton: some View {
        Button { showGallery = true } label: {
            Image(systemName: "film.stack")
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 36, height: 36)
                .background(Color.white.opacity(0.2), in: Circle())
        }
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
            Image(systemName: "square.and.arrow.down.fill")
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 36, height: 36)
                .background(vm.recorder.isSaving ? Color.gray : Color.red, in: Circle())
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
