import SwiftUI
import AVFoundation

/// Renders an externally-owned `AVCaptureVideoPreviewLayer` (so the same layer
/// can move between containers without being torn down — required for multicam
/// PIP swaps where each camera owns one preview layer for the lifetime of the
/// session).
struct CameraPreview: UIViewRepresentable {
    let layer: AVCaptureVideoPreviewLayer

    func makeUIView(context: Context) -> PreviewView {
        let view = PreviewView()
        view.attach(layer)
        return view
    }

    func updateUIView(_ view: PreviewView, context: Context) {
        view.attach(layer)
    }

    final class PreviewView: UIView {
        private weak var attached: AVCaptureVideoPreviewLayer?

        func attach(_ newLayer: AVCaptureVideoPreviewLayer) {
            if attached === newLayer { return }
            // Only detach the previously-attached layer if it's still hosted
            // here. During a multicam swap, SwiftUI updates both PreviewViews
            // back-to-back; the layer we used to host has already been claimed
            // by the other view, and yanking it on this update is what was
            // turning the screen black.
            if let prev = attached, prev.superlayer === self.layer {
                prev.removeFromSuperlayer()
            }
            // CALayer auto-removes from its previous superlayer when added
            // somewhere new — that's what makes the swap seamless.
            layer.addSublayer(newLayer)
            attached = newLayer
            setNeedsLayout()
        }

        override func layoutSubviews() {
            super.layoutSubviews()
            attached?.frame = bounds
        }
    }
}
