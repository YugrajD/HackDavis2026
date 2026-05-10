"use client";

import { useEffect, useRef, useState } from "react";
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

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-6 py-8 text-slate-100 sm:px-10 lg:px-12">
      <header className="flex flex-col justify-between gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-end">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.32em] text-cyanline">Guardian Road capture</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Camera to hazard event</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
            This page captures one live frame, uploads the frame evidence, asks the AI endpoint for structured risk, stores an event, then triggers the voice alert endpoint.
          </p>
        </div>
        <div className={`rounded-full px-4 py-2 font-mono text-xs uppercase tracking-[0.18em] ${statusClass(status)}`}>{status}</div>
      </header>

      <section className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-panel shadow-2xl shadow-black/30">
          <video ref={videoRef} className="aspect-video w-full bg-black object-cover" playsInline muted />
          <canvas ref={canvasRef} className="hidden" />
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 p-4">
            <p className="text-sm text-slate-300">{message}</p>
            <div className="flex gap-3">
              <button className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold hover:border-cyanline/70" onClick={startCamera} type="button">
                Restart camera
              </button>
              <button
                className="rounded-full bg-cyanline px-5 py-2 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={status === "capturing" || rideBusy}
                onClick={captureAndIngest}
                type="button"
              >
                Capture hazard
              </button>
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-3xl border border-white/10 bg-panel/80 p-5">
            <h2 className="font-mono text-xs uppercase tracking-[0.22em] text-slate-400">sensor context</h2>
            <div className="mt-4 grid gap-3">
              <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-mono text-xs uppercase tracking-[0.18em] text-slate-500">active ride</p>
                    <p className="mt-1 font-mono text-xs text-cyanline">{resolveRideId(activeRideId, rideId)}</p>
                  </div>
                  <p className="font-mono text-xs text-slate-500">route points +{routePointCount}</p>
                </div>
                <p className="mt-2 text-xs text-slate-500">Uses {demoRideId} until a live ride starts.</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button className="rounded-full bg-cyanline px-3 py-2 text-xs font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50" disabled={!!activeRideId || rideBusy || status === "capturing"} onClick={startRide} type="button">
                    Start ride
                  </button>
                  <button className="rounded-full border border-white/15 px-3 py-2 text-xs font-semibold text-slate-200 disabled:cursor-not-allowed disabled:opacity-50" disabled={!activeRideId || rideBusy || status === "capturing"} onClick={endRide} type="button">
                    End ride
                  </button>
                </div>
              </div>
              <label className="grid gap-1 text-sm text-slate-300">
                Ride ID fallback
                <input className="rounded-2xl border border-white/10 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyanline" value={rideId} onChange={(event) => setRideId(event.target.value)} />
              </label>
              <label className="grid gap-1 text-sm text-slate-300">
                Ride mode
                <select
                  className="rounded-2xl border border-white/10 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyanline"
                  value={rideMode}
                  onChange={(event) => setRideMode(event.target.value as RideMode)}
                >
                  <option value="bike">bike</option>
                  <option value="scooter">scooter</option>
                  <option value="car">car</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm text-slate-300">
                Camera
                <select
                  className="rounded-2xl border border-white/10 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyanline"
                  value={camera}
                  onChange={(event) => setCamera(event.target.value as CameraRole)}
                >
                  <option value="front">front</option>
                  <option value="rear">rear</option>
                  <option value="dashcam">dashcam</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm text-slate-300">
                Worker perception seed
                <select
                  className="rounded-2xl border border-white/10 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyanline"
                  value={perceptionPreset}
                  onChange={(event) => setPerceptionPreset(event.target.value as PerceptionPreset)}
                >
                  <option value="rear_vehicle">rear vehicle closing</option>
                  <option value="close_pass">left close pass</option>
                  <option value="blocked_lane">blocked bike lane</option>
                  <option value="cross_traffic">cross traffic</option>
                  <option value="clear">clear path</option>
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <NumberField label="Speed m/s" value={speedMps} onChange={setSpeedMps} />
                <NumberField label="Heading" value={headingDeg} onChange={setHeadingDeg} />
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-3 font-mono text-xs text-slate-400">
                {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-panel/80 p-5">
            <h2 className="font-mono text-xs uppercase tracking-[0.22em] text-slate-400">last result</h2>
            {analysis ? (
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">{analysis.type.replaceAll("_", " ")}</span>
                  <span className="rounded-full bg-critical/15 px-3 py-1 font-mono text-red-200">{Math.round(analysis.severity)}</span>
                </div>
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-cyanline">provider {analysis.provider}</p>
                <p className="text-slate-300">{analysis.spokenAlert}</p>
                <p className="text-slate-400">{analysis.explanation}</p>
                {analysis.perception ? <p className="font-mono text-xs text-slate-500">worker risk {analysis.perception.risk.type} · {Math.round(analysis.perception.risk.severity)} · {analysis.perception.tracks.length} tracks</p> : null}
                <ObjectList objects={analysis.objects} />
                {lastEvent ? <p className="font-mono text-xs text-cyanline">event {lastEvent.id}</p> : null}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-400">No captured hazard yet.</p>
            )}
          </div>

          {lastFrame ? <img className="rounded-3xl border border-white/10" src={lastFrame} alt="Last captured road frame" /> : null}
        </aside>
      </section>
    </main>
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
    <label className="grid gap-1 text-sm text-slate-300">
      {label}
      <input
        className="rounded-2xl border border-white/10 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyanline"
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function ObjectList({ objects }: { objects: TrackedObject[] }) {
  if (!objects.length) return <p className="font-mono text-xs text-slate-500">no tracked objects</p>;
  return (
    <ul className="space-y-2">
      {objects.map((object) => (
        <li key={object.id} className="rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-slate-300">
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
      return "bg-cyanline/15 text-cyanline";
    case "capturing":
      return "bg-warning/15 text-amber-200";
    case "error":
      return "bg-critical/15 text-red-200";
    case "camera-ready":
      return "bg-white/10 text-slate-200";
    default:
      return "bg-slate-800 text-slate-400";
  }
}
