"use client";

import { useEffect, useRef, useState } from "react";

export type SplatViewerProps = {
  fileData: Uint8Array | null;
  fileName: string | null;
  className?: string;
};

/**
 * Adapted from Mirage's MIT-licensed Spark/Three Gaussian splat viewer.
 * It accepts raw PLY or splat bytes and keeps the heavy renderer out of the
 * main bundle until the component mounts in the browser.
 */
export default function SplatViewer({ fileData, fileName, className }: SplatViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<{
    scene: any;
    camera: any;
    renderer: any;
    controls: any;
    splatMesh: any;
  } | null>(null);
  const initPromise = useRef<Promise<boolean> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [splatCount, setSplatCount] = useState<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;

    initPromise.current = (async () => {
      try {
        const THREE = await import("three");
        const spark = await import("@sparkjsdev/spark");
        const SparkControls = (spark as any).SparkControls;
        if (disposed) return false;

        const canvas = document.createElement("canvas");
        canvas.style.display = "block";
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        container.appendChild(canvas);

        const width = Math.max(container.clientWidth, 1);
        const height = Math.max(container.clientHeight, 1);
        const camera = new THREE.PerspectiveCamera(75, width / height, 0.01, 1000);
        camera.position.set(0, 0, 1);

        const scene = new THREE.Scene();
        const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
        renderer.setSize(width, height, false);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        const controls = new SparkControls({ canvas });
        const resize = () => {
          const nextWidth = container.clientWidth;
          const nextHeight = container.clientHeight;
          if (nextWidth === 0 || nextHeight === 0) return;
          if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
            renderer.setSize(nextWidth, nextHeight, false);
            camera.aspect = nextWidth / nextHeight;
            camera.updateProjectionMatrix();
          }
        };

        window.addEventListener("resize", resize);
        renderer.setAnimationLoop(() => {
          resize();
          controls.update(camera);
          renderer.render(scene, camera);
        });

        stateRef.current = { scene, camera, renderer, controls, splatMesh: null };
        return true;
      } catch (cause) {
        console.error("[SplatViewer] init failed", cause);
        setError("Gaussian splat renderer could not start in this browser.");
        return false;
      }
    })();

    return () => {
      disposed = true;
      const state = stateRef.current;
      state?.renderer?.setAnimationLoop(null);
      state?.renderer?.dispose?.();
      state?.renderer?.domElement?.remove?.();
      stateRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!fileData) {
      const state = stateRef.current;
      if (state?.splatMesh && state.scene) {
        state.scene.remove(state.splatMesh);
        state.splatMesh.dispose?.();
        state.splatMesh = null;
      }
      setSplatCount(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    (async () => {
      const initialized = await initPromise.current;
      const state = stateRef.current;
      if (cancelled || !initialized || !state) return;

      setIsLoading(true);
      setError(null);

      try {
        const spark = await import("@sparkjsdev/spark");
        const SplatMesh = (spark as any).SplatMesh;
        if (cancelled) return;

        if (state.splatMesh) {
          state.scene.remove(state.splatMesh);
          state.splatMesh.dispose?.();
          state.splatMesh = null;
        }

        const options: Record<string, unknown> = { fileBytes: fileData.slice(0) };
        if (fileName) options.fileName = fileName;

        const splatMesh = new SplatMesh(options);
        splatMesh.quaternion?.set?.(1, 0, 0, 0);
        state.scene.add(splatMesh);
        state.splatMesh = splatMesh;
        state.camera.position.set(0, 0, 1);

        await splatMesh.initialized;
        if (!cancelled) setSplatCount(typeof splatMesh.numSplats === "number" ? splatMesh.numSplats : null);
      } catch (cause) {
        console.error("[SplatViewer] splat load failed", cause);
        if (!cancelled) setError("Could not load this splat file.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fileData, fileName]);

  return (
    <div className={className ?? "splat-viewer-wrapper"}>
      <div ref={containerRef} className="splat-viewer-canvas" aria-label="Gaussian splat viewer" />

      {isLoading && (
        <div className="splat-viewer-loading" role="status">
          <span>Loading splat...</span>
        </div>
      )}

      {error && <div className="splat-viewer-error">{error}</div>}

      {!isLoading && fileData && fileName && (
        <div className="splat-viewer-hud">
          <span>{fileName}</span>
          {splatCount !== null && <span>{splatCount.toLocaleString()} splats</span>}
        </div>
      )}

      {!isLoading && fileData && (
        <div className="splat-viewer-controls-hint">Click and drag to look. WASD moves. Scroll zooms.</div>
      )}
    </div>
  );
}
