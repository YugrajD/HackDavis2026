"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { AnalyzeAndSaveMediaResponse, AppendRideRouteResponse, CameraRole, FrameDetection, FrameObservation, HazardEvent, MediaUploadResponse, PerceptionResult, Ride, RideMode, RoutePoint, TrackedObject } from "@/lib/contracts";
import { analyzeFrameObservation } from "@/lib/perception/frame-pipeline";
import { analyzeFrameInWorker, createPerceptionWorker } from "@/lib/perception/worker-client";

type AnalysisResponse = Pick<HazardEvent, "type" | "severity" | "confidence" | "spokenAlert" | "explanation" | "objects"> & {
  provider: string;
  perception?: PerceptionResult;
};

type VoiceResponse = {
  text: string;
  audioUrl: string | null;
  provider: string;
};

type RideResponse = {
  ride: Ride;
  persisted?: "memory" | "mongodb";
};

type CaptureLocation = {
  lat: number;
  lng: number;
};

type CaptureStatus = "idle" | "camera-ready" | "capturing" | "saved" | "error";
type PerceptionPreset = "rear_vehicle" | "close_pass" | "blocked_lane" | "cross_traffic" | "clear";
type BrowserFacingMode = "environment" | "user";

const demoRideId = "demo-ride-1";
const fallbackLocation: CaptureLocation = { lat: 38.5449, lng: -121.7405 };
const cameraFacingModes = {
  front: "environment",
  rear: "user",
  dashcam: "environment",
} as const satisfies Record<CameraRole, BrowserFacingMode>;

export default function CapturePage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const previousFrameRef = useRef<FrameObservation | undefined>(undefined);
  const startedAtRef = useRef<number>(Date.now());
  const cameraRequestRef = useRef(0);

  const [camera, setCamera] = useState<CameraRole>("front");
  const [rideMode, setRideMode] = useState<RideMode>("bike");
  const [rideId, setRideId] = useState(demoRideId);
  const [activeRideId, setActiveRideId] = useState<string | null>(null);
  const [rideBusy, setRideBusy] = useState(false);
  const [routePointCount, setRoutePointCount] = useState(0);
  const [speedMps, setSpeedMps] = useState(4.6);
  const [headingDeg, setHeadingDeg] = useState(90);
  const [perceptionPreset, setPerceptionPreset] = useState<PerceptionPreset>("rear_vehicle");
  const [location, setLocation] = useState<CaptureLocation>(fallbackLocation);
  const [status, setStatus] = useState<CaptureStatus>("idle");
  const [message, setMessage] = useState("Open camera, capture one frame, save it as a hazard event.");
  const [lastFrame, setLastFrame] = useState<string | null>(null);
  const [lastEvent, setLastEvent] = useState<HazardEvent | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;

    const watcher = navigator.geolocation.watchPosition(
      (position) => {
        setLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        if (Number.isFinite(position.coords.speed)) setSpeedMps(position.coords.speed ?? speedMps);
        if (Number.isFinite(position.coords.heading)) setHeadingDeg(position.coords.heading ?? headingDeg);
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 8000 },
    );

    return () => navigator.geolocation.clearWatch(watcher);
  }, [headingDeg, speedMps]);

  useEffect(() => {
    workerRef.current = createPerceptionWorker();
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    void startCamera();
    return () => stopCamera();
  }, [camera]);

  async function startCamera() {
    stopCamera();
    const requestId = cameraRequestRef.current;
    const selectedCamera = camera;

    try {
      const stream = await getCameraStream(selectedCamera);
      if (requestId !== cameraRequestRef.current) {
        stopStream(stream);
        return;
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStatus("camera-ready");
      setMessage(`Camera ready on ${selectedCamera}. Capture frame when a hazard is visible.`);
    } catch (error) {
      if (requestId !== cameraRequestRef.current) return;
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Camera permission failed.");
    }
  }

  function stopCamera() {
    cameraRequestRef.current += 1;
    stopStream(streamRef.current);
    streamRef.current = null;
  }

  async function runPerception(frame: FrameObservation) {
    const worker = workerRef.current;
    if (!worker) return analyzeFrameObservation(frame, previousFrameRef.current);

    try {
      return await analyzeFrameInWorker(worker, frame, previousFrameRef.current);
    } catch {
      return analyzeFrameObservation(frame, previousFrameRef.current);
    }
  }

  async function startRide() {
    if (activeRideId) return;

    setRideBusy(true);
    setMessage("Starting live ride.");

    try {
      const response = await postJson<RideResponse>("/api/rides", { mode: rideMode, startLat: location.lat, startLng: location.lng });
      startedAtRef.current = Date.now();
      previousFrameRef.current = undefined;
      setActiveRideId(response.ride.id);
      setRideId(response.ride.id);
      setRoutePointCount(0);
      setStatus("camera-ready");
      setMessage(`Started ${response.ride.mode} ride ${response.ride.id}. Captures now write to this ride.`);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Start ride failed.");
    } finally {
      setRideBusy(false);
    }
  }

  async function endRide() {
    if (!activeRideId) return;

    const endedRideId = activeRideId;
    setRideBusy(true);
    setMessage(`Ending ride ${endedRideId}.`);

    try {
      const response = await requestJson<RideResponse>(`/api/rides/${endedRideId}/end`, "PATCH");
      setActiveRideId(null);
      setRideId(demoRideId);
      startedAtRef.current = Date.now();
      setRoutePointCount(0);
      setStatus("camera-ready");
      setMessage(`Ended ride ${response.ride.id}. Capture falls back to ${demoRideId}.`);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "End ride failed.");
    } finally {
      setRideBusy(false);
    }
  }

  async function captureAndIngest() {
    if (!videoRef.current || !canvasRef.current) return;

    const captureRideId = resolveRideId(activeRideId, rideId);
    const selectedCamera = camera;
    const captureT = Math.round((Date.now() - startedAtRef.current) / 1000);
    const routePoint = buildRoutePoint({ t: captureT, location, speedMps, headingDeg });

    setStatus("capturing");
    setMessage(`Analyzing frame, saving event, and appending route point to ${captureRideId}.`);

    try {
      const imageBase64 = captureFrame(videoRef.current, canvasRef.current);
      setLastFrame(imageBase64);

      const frameObservation = buildFrameObservation(videoRef.current, { camera: selectedCamera, location, speedMps, headingDeg, preset: perceptionPreset });
      const [mediaUpload, perception] = await Promise.all([
        postJson<MediaUploadResponse>("/api/media/upload", { imageBase64, imageMimeType: "image/jpeg" }),
        runPerception(frameObservation),
      ]);
      previousFrameRef.current = frameObservation;

      const saved = await postJson<AnalyzeAndSaveMediaResponse>("/api/media/analyze-and-save", {
        imageBase64,
        rideId: captureRideId,
        t: captureT,
        lat: location.lat,
        lng: location.lng,
        speedMps,
        headingDeg,
        camera: selectedCamera,
        clipUrl: mediaUpload.clipUrl,
        thumbnailUrl: mediaUpload.thumbnailUrl,
        perception,
      });
      await postJson<AppendRideRouteResponse>(`/api/rides/${captureRideId}/route`, { point: routePoint });
      setRoutePointCount((count) => count + 1);

      const frameAnalysis: AnalysisResponse = { ...saved.event, provider: saved.provider, perception: saved.perception };
      setAnalysis(frameAnalysis);
      setLastEvent(saved.event);
      setStatus("saved");
      setMessage(`Saved ${saved.event.type.replaceAll("_", " ")} at severity ${Math.round(saved.event.severity)} on ${captureRideId}.`);

      const voice = await postJson<VoiceResponse>("/api/voice/alert", { text: saved.event.spokenAlert });
      playVoiceAlert(voice);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Capture ingestion failed.");
    }
  }

  const resolvedRideId = resolveRideId(activeRideId, rideId);
  const lastProvider = analysis?.provider ?? "pending";
  const workerStatus = analysis?.perception ? `${analysis.perception.tracks.length} tracks` : "seed ready";
  const lastSeverity = analysis ? Math.round(analysis.severity).toString() : "—";
  const lastHazard = analysis?.type.replaceAll("_", " ") ?? "none";
  const lastEventId = lastEvent?.id ?? "—";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-5 py-6 sm:px-8 lg:px-12">
      <header className="flex flex-col justify-between gap-4 border-b border-line pb-5 sm:flex-row sm:items-end">
        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-amber">guardian road · capture</p>
          <h1 className="text-2xl font-semibold tracking-tight text-roadText sm:text-3xl">Sensor console</h1>
          <p className="max-w-2xl text-sm leading-6 text-roadText-muted">
            Captures one live frame, uploads evidence, classifies risk, persists a hazard event, appends route point, and dispatches a voice alert.
          </p>
        </div>
        <div className={`border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.3em] ${statusClass(status)}`}>{status}</div>
      </header>

      <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="border border-line bg-surface">
          <div className="grid gap-2 border-b border-line px-4 py-2 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-[0.3em]">
              <RailReadout label="camera" value={camera} />
              <RailReadout label="ride" value={resolvedRideId} />
              <RailReadout label="provider" value={lastProvider} />
              <RailReadout label="worker" value={workerStatus} />
            </div>
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-roadText-dim">operations viewport · 16:9</span>
          </div>
          <div className="relative">
            <video ref={videoRef} className="aspect-video w-full bg-void object-cover" playsInline muted />
            <canvas ref={canvasRef} className="hidden" />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.05)_1px,transparent_1px)] bg-[length:24px_24px]" aria-hidden="true" />
            <div className="pointer-events-none absolute inset-0 border border-line" aria-hidden="true" />
          </div>
          <div className="border-t border-line bg-void/55 px-4 py-3" aria-live="polite" role="status">
            <p className="font-mono text-[11px] leading-snug text-roadText-muted"><span className="text-amber">status</span> / {message}</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line px-4 py-3">
            <button
              className="inline-flex min-h-[44px] items-center border border-line-strong px-4 py-2 font-mono text-[11px] uppercase tracking-[0.22em] text-roadText transition-colors duration-150 ease-out hover:border-amber/60 hover:text-amber"
              onClick={startCamera}
              type="button"
            >
              Restart camera
            </button>
            <button
              className="inline-flex min-h-[44px] items-center border border-amber bg-amber px-5 py-2 font-mono text-[11px] uppercase tracking-[0.22em] text-void transition-colors duration-150 ease-out hover:bg-orange disabled:cursor-not-allowed disabled:opacity-50"
              disabled={status === "capturing" || rideBusy}
              onClick={captureAndIngest}
              type="button"
            >
              Capture hazard
            </button>
          </div>
        </div>

        <aside className="flex flex-col gap-4">
          <div className="border border-line bg-surface">
            <div className="border-b border-line px-4 py-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-roadText-muted">ride lifecycle</p>
            </div>
            <div className="space-y-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-roadText-dim">active ride</p>
                  <p className="mt-1 font-mono text-xs text-telemetry">{resolvedRideId}</p>
                </div>
                <p className="font-mono text-[11px] tabular-nums text-roadText-muted">route +{routePointCount}</p>
              </div>
              <p className="font-mono text-[11px] text-roadText-dim">falls back to {demoRideId} until ride starts</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  className="inline-flex min-h-[44px] items-center justify-center border border-amber bg-amber px-3 py-2 font-mono text-[11px] uppercase tracking-[0.22em] text-void transition-colors duration-150 ease-out hover:bg-orange disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!!activeRideId || rideBusy || status === "capturing"}
                  onClick={startRide}
                  type="button"
                >
                  Start ride
                </button>
                <button
                  className="inline-flex min-h-[44px] items-center justify-center border border-line-strong px-3 py-2 font-mono text-[11px] uppercase tracking-[0.22em] text-roadText transition-colors duration-150 ease-out hover:border-amber/60 hover:text-amber disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!activeRideId || rideBusy || status === "capturing"}
                  onClick={endRide}
                  type="button"
                >
                  End ride
                </button>
              </div>
            </div>
          </div>

          <div className="border border-line bg-surface">
            <div className="border-b border-line px-4 py-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-roadText-muted">sensor parameters</p>
            </div>
            <div className="grid gap-3 p-4">
              <Field label="Ride ID fallback">
                <input
                  className="w-full border border-line bg-void px-3 py-2 font-mono text-xs text-roadText outline-none focus-visible:border-amber"
                  value={rideId}
                  onChange={(event) => setRideId(event.target.value)}
                />
              </Field>
              <Field label="Ride mode">
                <select
                  className="w-full border border-line bg-void px-3 py-2 font-mono text-xs text-roadText outline-none focus-visible:border-amber"
                  value={rideMode}
                  onChange={(event) => setRideMode(event.target.value as RideMode)}
                >
                  <option value="bike">bike</option>
                  <option value="scooter">scooter</option>
                  <option value="car">car</option>
                </select>
              </Field>
              <Field label="Camera role">
                <select
                  className="w-full border border-line bg-void px-3 py-2 font-mono text-xs text-roadText outline-none focus-visible:border-amber"
                  value={camera}
                  onChange={(event) => setCamera(event.target.value as CameraRole)}
                >
                  <option value="front">front</option>
                  <option value="rear">rear</option>
                  <option value="dashcam">dashcam</option>
                </select>
              </Field>
              <Field label="Worker perception seed">
                <select
                  className="w-full border border-line bg-void px-3 py-2 font-mono text-xs text-roadText outline-none focus-visible:border-amber"
                  value={perceptionPreset}
                  onChange={(event) => setPerceptionPreset(event.target.value as PerceptionPreset)}
                >
                  <option value="rear_vehicle">rear vehicle closing</option>
                  <option value="close_pass">left close pass</option>
                  <option value="blocked_lane">blocked bike lane</option>
                  <option value="cross_traffic">cross traffic</option>
                  <option value="clear">clear path</option>
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <NumberField label="Speed m/s" value={speedMps} onChange={setSpeedMps} />
                <NumberField label="Heading" value={headingDeg} onChange={setHeadingDeg} />
              </div>
              <div className="border border-line bg-void px-3 py-2 font-mono text-[11px] tabular-nums text-telemetry">
                {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
              </div>
            </div>
          </div>

          <div className="border border-line bg-surface">
            <div className="border-b border-line px-4 py-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-roadText-muted">telemetry</p>
            </div>
            <div className="grid grid-cols-2 border-b border-line sm:grid-cols-3">
              <TelemetryCell label="ride id" value={resolvedRideId} tone="cyan" />
              <TelemetryCell label="route pts" value={routePointCount.toString()} tone="cyan" />
              <TelemetryCell label="provider" value={lastProvider} tone="cyan" />
              <TelemetryCell label="severity" value={lastSeverity} tone={analysis ? "amber" : "muted"} />
              <TelemetryCell label="hazard" value={lastHazard} tone={analysis ? "amber" : "muted"} />
              <TelemetryCell label="event" value={lastEventId} tone={lastEvent ? "cyan" : "muted"} />
            </div>
          </div>

          <div className="border border-line bg-surface">
            <div className="border-b border-line px-4 py-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-roadText-muted">last result</p>
            </div>
            <div className="p-4">
              {analysis ? (
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs uppercase tracking-[0.18em] text-roadText">{analysis.type.replaceAll("_", " ")}</span>
                    <span className="border border-critical/60 px-2 py-1 font-mono text-[11px] tabular-nums text-critical">sev {Math.round(analysis.severity)}</span>
                  </div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-telemetry">provider {analysis.provider}</p>
                  <p className="text-roadText">{analysis.spokenAlert}</p>
                  <p className="text-roadText-muted">{analysis.explanation}</p>
                  {analysis.perception ? (
                    <p className="font-mono text-[11px] text-roadText-dim">
                      worker {analysis.perception.risk.type} · {Math.round(analysis.perception.risk.severity)} · {analysis.perception.tracks.length} tracks
                    </p>
                  ) : null}
                  <ObjectList objects={analysis.objects} />
                  {lastEvent ? <p className="font-mono text-[11px] text-telemetry">event {lastEvent.id}</p> : null}
                </div>
              ) : (
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-roadText-dim">no hazard captured</p>
              )}
            </div>
          </div>

          {lastFrame ? <img className="border border-line" src={lastFrame} alt="Last captured road frame" /> : null}
        </aside>
      </section>
    </main>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1">
      <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-roadText-dim">{label}</span>
      {children}
    </label>
  );
}

function RailReadout({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-roadText-dim">{label}</span>
      <span className="text-telemetry">{value}</span>
    </span>
  );
}

function TelemetryCell({ label, value, tone }: { label: string; value: string; tone: "amber" | "cyan" | "muted" }) {
  const toneClass = tone === "amber" ? "text-amber" : tone === "cyan" ? "text-telemetry" : "text-roadText-dim";

  return (
    <div className="border-r border-line px-3 py-2 last:border-r-0 sm:[&:nth-child(3n)]:border-r-0">
      <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-roadText-dim">{label}</p>
      <p className={`mt-1 truncate font-mono text-[11px] tabular-nums ${toneClass}`}>{value}</p>
    </div>
  );
}

async function getCameraStream(camera: CameraRole) {
  const facingMode = cameraFacingModes[camera];

  try {
    return await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { exact: facingMode } },
      audio: false,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "OverconstrainedError") {
      return navigator.mediaDevices.getUserMedia({ video: { facingMode }, audio: false });
    }
    throw error;
  }
}

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

function resolveRideId(activeRideId: string | null, fallbackRideId: string) {
  return activeRideId ?? (fallbackRideId.trim() || demoRideId);
}

function buildRoutePoint(context: { t: number; location: CaptureLocation; speedMps: number; headingDeg: number }): RoutePoint {
  const headingDeg = finiteNumber(context.headingDeg, 0);

  return {
    t: Math.max(0, finiteNumber(context.t, 0)),
    lat: context.location.lat,
    lng: context.location.lng,
    speedMps: Math.max(0, finiteNumber(context.speedMps, 0)),
    headingDeg: ((headingDeg % 360) + 360) % 360,
  };
}

function finiteNumber(value: number, fallback: number) {
  return Number.isFinite(value) ? value : fallback;
}

function buildFrameObservation(
  video: HTMLVideoElement,
  context: { camera: CameraRole; location: CaptureLocation; speedMps: number; headingDeg: number; preset: PerceptionPreset },
): FrameObservation {
  const capturedAt = new Date().toISOString();
  return {
    frameId: `capture-${Date.now()}`,
    capturedAt,
    camera: context.camera,
    lat: context.location.lat,
    lng: context.location.lng,
    speedMps: context.speedMps,
    headingDeg: context.headingDeg,
    width: video.videoWidth || 1280,
    height: video.videoHeight || 720,
    detections: seededDetections(context.preset),
  };
}

function seededDetections(preset: PerceptionPreset): FrameDetection[] {
  switch (preset) {
    case "rear_vehicle":
      return [{ id: "rear-car-1", label: "car", description: "Vehicle closing in rear camera lane", confidence: 0.88, bbox: [0.18, 0.24, 0.54, 0.75], depthM: 5.4, relativeLocation: "behind" }];
    case "close_pass":
      return [{ id: "left-pass-1", label: "sedan", description: "Vehicle offset inside rider clearance buffer", confidence: 0.84, bbox: [0.02, 0.18, 0.35, 0.82], depthM: 3.8, relativeLocation: "left" }];
    case "blocked_lane":
      return [{ id: "cone-lane-1", label: "traffic cone", description: "Cone or obstacle in bike lane", confidence: 0.79, bbox: [0.44, 0.48, 0.58, 0.9], depthM: 4.2, relativeLocation: "ahead" }];
    case "cross_traffic":
      return [{ id: "ped-cross-1", label: "pedestrian", description: "Pedestrian or cyclist entering path", confidence: 0.81, bbox: [0.5, 0.22, 0.68, 0.82], depthM: 6.1, relativeLocation: "right" }];
    case "clear":
      return [];
  }
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="grid gap-1">
      <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-roadText-dim">{label}</span>
      <input
        className="w-full border border-line bg-void px-3 py-2 font-mono text-xs tabular-nums text-roadText outline-none focus-visible:border-amber"
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function ObjectList({ objects }: { objects: TrackedObject[] }) {
  if (!objects.length) return <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-roadText-dim">no tracked objects</p>;
  return (
    <ul className="divide-y divide-line border border-line">
      {objects.map((object) => (
        <li key={object.id} className="px-3 py-2 font-mono text-[11px] text-roadText">
          {object.type} · {(object.confidence * 100).toFixed(0)}%{object.distanceM ? ` · ${object.distanceM.toFixed(1)}m` : ""}
        </li>
      ))}
    </ul>
  );
}

function captureFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement) {
  const width = video.videoWidth || 1280;
  const height = video.videoHeight || 720;
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not capture frame canvas.");
  context.drawImage(video, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  return requestJson(url, "POST", body);
}

async function requestJson<T>(url: string, method: "POST" | "PATCH", body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? `${url} returned ${response.status}`);
  return payload;
}

function playVoiceAlert(response: VoiceResponse) {
  if (response.audioUrl) {
    void new Audio(response.audioUrl).play();
    return;
  }

  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(response.text));
  }
}

function statusClass(status: CaptureStatus) {
  switch (status) {
    case "saved":
      return "border-telemetry/60 text-telemetry";
    case "capturing":
      return "border-amber/60 text-amber";
    case "error":
      return "border-critical/60 text-critical";
    case "camera-ready":
      return "border-line-strong text-roadText";
    default:
      return "border-line text-roadText-dim";
  }
}
