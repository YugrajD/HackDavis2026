"use client";

import { useEffect, useRef, useState } from "react";
import type { CameraRole, HazardEvent, MediaUploadResponse, TrackedObject } from "@/lib/contracts";

type AnalysisResponse = Pick<HazardEvent, "type" | "severity" | "confidence" | "spokenAlert" | "explanation" | "objects"> & {
  provider: string;
};

type VoiceResponse = {
  text: string;
  audioUrl: string | null;
  provider: string;
};

type CaptureLocation = {
  lat: number;
  lng: number;
};

type CaptureStatus = "idle" | "camera-ready" | "capturing" | "saved" | "error";

const fallbackLocation: CaptureLocation = { lat: 38.5449, lng: -121.7405 };

export default function CapturePage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef<number>(Date.now());

  const [camera, setCamera] = useState<CameraRole>("front");
  const [rideId, setRideId] = useState("demo-ride-1");
  const [speedMps, setSpeedMps] = useState(4.6);
  const [headingDeg, setHeadingDeg] = useState(90);
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
    void startCamera();
    return () => stopCamera();
  }, []);

  async function startCamera() {
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: camera === "rear" ? "user" : "environment" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStatus("camera-ready");
      setMessage("Camera ready. Capture frame when a hazard is visible.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Camera permission failed.");
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  async function captureAndIngest() {
    if (!videoRef.current || !canvasRef.current) return;

    setStatus("capturing");
    setMessage("Analyzing frame, uploading evidence, and saving event.");

    try {
      const imageBase64 = captureFrame(videoRef.current, canvasRef.current);
      setLastFrame(imageBase64);

      const [mediaUpload, frameAnalysis] = await Promise.all([
        postJson<MediaUploadResponse>("/api/media/upload", { imageBase64, imageMimeType: "image/jpeg" }),
        postJson<AnalysisResponse>("/api/ai/analyze-frame", {
          imageBase64,
          lat: location.lat,
          lng: location.lng,
          speedMps,
          headingDeg,
          camera,
        }),
      ]);

      setAnalysis(frameAnalysis);

      const eventResponse = await postJson<{ event: HazardEvent }>("/api/events", {
        rideId: rideId.trim() || "demo-ride-1",
        t: Math.round((Date.now() - startedAtRef.current) / 1000),
        timestamp: new Date().toISOString(),
        type: frameAnalysis.type,
        severity: frameAnalysis.severity,
        confidence: frameAnalysis.confidence,
        lat: location.lat,
        lng: location.lng,
        headingDeg,
        speedMps,
        camera,
        spokenAlert: frameAnalysis.spokenAlert,
        explanation: frameAnalysis.explanation,
        clipUrl: mediaUpload.clipUrl,
        thumbnailUrl: mediaUpload.thumbnailUrl,
        objects: frameAnalysis.objects,
      } satisfies Partial<HazardEvent>);

      setLastEvent(eventResponse.event);
      setStatus("saved");
      setMessage(`Saved ${frameAnalysis.type.replaceAll("_", " ")} at severity ${Math.round(frameAnalysis.severity)}.`);

      const voice = await postJson<VoiceResponse>("/api/voice/alert", { text: frameAnalysis.spokenAlert });
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
                disabled={status === "capturing"}
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
              <label className="grid gap-1 text-sm text-slate-300">
                Ride ID
                <input className="rounded-2xl border border-white/10 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyanline" value={rideId} onChange={(event) => setRideId(event.target.value)} />
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
                <p className="text-slate-300">{analysis.spokenAlert}</p>
                <p className="text-slate-400">{analysis.explanation}</p>
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
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload = (await response.json()) as T & { error?: string };
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
