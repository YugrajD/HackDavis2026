import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, LayoutChangeEvent } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Location from "expo-location";
import Constants from "expo-constants";
import { Audio } from "expo-av";
import * as Speech from "expo-speech";
import type { AppendRideRouteResponse, CreateRideResponse, EndRideResponse, MediaUploadResponse, ProviderStatusResponse, Ride } from "./types";
import { scoreDetectionsForHud, spokenHintForTopDetection, type FrameDetection } from "./live-perception";

type AnalyzeResponse = {
  event: {
    id: string;
    type: string;
    severity: number;
    spokenAlert: string;
    explanation: string;
  };
  provider: string;
  message?: string;
  yoloNote?: string;
};

type VoiceResponse = {
  text: string;
  audioUrl: string | null;
  provider: string;
};

type PerceptionDetectResponse = {
  detections: FrameDetection[];
  width: number;
  height: number;
  note?: string;
};

type Telemetry = {
  lat: number;
  lng: number;
  speedMps: number;
  headingDeg: number;
};

type ActiveRide = Pick<Ride, "id" | "startedAt"> & { fallback: boolean };

type RideStart = {
  ride: ActiveRide;
  note?: string;
};

type PreflightState = {
  loading: boolean;
  checkedAt?: string;
  payload?: ProviderStatusResponse;
  error?: string;
};

type PreviewSize = { w: number; h: number };

const DEMO_RIDE_ID = "demo-ride-1";
const DEMO_ORIGIN = { lat: 38.5449, lng: -121.7405 };
const LIVE_MONITOR_JPEG_QUALITY = 0.38;
/** When the camera or network fails, wait briefly before retrying (live loop otherwise runs back-to-back). */
const LIVE_MONITOR_ERROR_BACKOFF_MS = 120;
const AUTO_PERSIST_MIN_SCORE = 56;
const AUTO_PERSIST_COOLDOWN_MS = 42_000;
const SPEECH_HINT_MIN_SCORE = 62;
const SPEECH_HINT_COOLDOWN_MS = 12_000;

function apiBase(): string {
  const fromExtra = Constants.expoConfig?.extra?.apiBaseUrl as string | undefined;
  return (fromExtra ?? "http://127.0.0.1:3000").replace(/\/$/, "");
}

async function getJson<T>(path: string): Promise<T> {
  const url = `${apiBase()}${path}`;
  const response = await fetch(url);
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? `${path} ${response.status}`);
  return payload;
}

async function requestJson<T>(path: string, init: { method: "POST" | "PATCH"; body?: unknown }): Promise<T> {
  const url = `${apiBase()}${path}`;
  const response = await fetch(url, {
    method: init.method,
    headers: { "content-type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? `${path} ${response.status}`);
  return payload;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  return requestJson<T>(path, { method: "POST", body });
}

async function patchJson<T>(path: string): Promise<T> {
  return requestJson<T>(path, { method: "PATCH" });
}

/** POST /api/perception/detect — returns body even on 503 (YOLO down). */
async function postPerceptionDetect(imageBase64: string): Promise<PerceptionDetectResponse & { httpOk: boolean }> {
  const url = `${apiBase()}/api/perception/detect`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ imageBase64, imageMimeType: "image/jpeg" }),
  });
  const data = (await response.json()) as {
    detections?: FrameDetection[];
    width?: number;
    height?: number;
    note?: string;
    error?: string;
  };
  return {
    detections: Array.isArray(data.detections) ? data.detections : [],
    width: typeof data.width === "number" ? data.width : 0,
    height: typeof data.height === "number" ? data.height : 0,
    note: typeof data.note === "string" ? data.note : data.error,
    httpOk: response.ok,
  };
}

function ridePath(rideId: string, suffix: string): string {
  return `/api/rides/${encodeURIComponent(rideId)}${suffix}`;
}

function secondsSince(startedAt: string, nowMs = Date.now()): number {
  const startMs = Date.parse(startedAt);
  if (!Number.isFinite(startMs)) return 0;
  return Math.max(0, Math.round((nowMs - startMs) / 100) / 10);
}

function preflightTime(): string {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function providerTone(configured: boolean, available: boolean): "ok" | "warn" | "bad" {
  if (!configured) return "warn";
  return available ? "ok" : "bad";
}

function renderProviderChip(label: string, configured: boolean, available: boolean, fallbackLabel = "not set") {
  const tone = providerTone(configured, available);
  const value = configured ? (available ? "ready" : "down") : fallbackLabel;
  const toneStyle = tone === "ok" ? styles.chipOk : tone === "warn" ? styles.chipWarn : styles.chipBad;

  return (
    <View key={label} style={[styles.chip, toneStyle]}>
      <Text style={styles.chipLabel}>{label}</Text>
      <Text style={styles.chipValue}>{value}</Text>
    </View>
  );
}

async function playVoiceAlert(voice: VoiceResponse) {
  if (voice.audioUrl) {
    const uri = voice.audioUrl.startsWith("http")
      ? voice.audioUrl
      : `${apiBase()}${voice.audioUrl.startsWith("/") ? "" : "/"}${voice.audioUrl}`;
    try {
      const { sound } = await Audio.Sound.createAsync({ uri });
      await sound.playAsync();
    } catch {
      Speech.speak(voice.text, { rate: 1.05 });
    }
  } else {
    Speech.speak(voice.text, { rate: 1.05 });
  }
}

export default function CaptureScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [locPermission, setLocPermission] = useState<boolean | null>(null);
  const cameraViewRef = useRef<CameraView | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [last, setLast] = useState<AnalyzeResponse | null>(null);
  const [activeRide, setActiveRide] = useState<ActiveRide | null>(null);
  const [preflight, setPreflight] = useState<PreflightState>({ loading: true });

  const [previewSize, setPreviewSize] = useState<PreviewSize | null>(null);
  const [liveDetections, setLiveDetections] = useState<FrameDetection[]>([]);
  const [liveDetectNote, setLiveDetectNote] = useState<string | undefined>();
  const [liveHudScore, setLiveHudScore] = useState(0);
  const [monitorTickBusy, setMonitorTickBusy] = useState(false);
  const [liveRoundTripMs, setLiveRoundTripMs] = useState<number | null>(null);
  const persistInFlightRef = useRef(false);
  const lastAutoPersistMsRef = useRef(0);
  const lastSpeechHintMsRef = useRef(0);
  const busyRef = useRef(false);
  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  const runPreflight = useCallback(async (): Promise<boolean> => {
    setPreflight((current) => ({ ...current, loading: true, error: undefined }));
    try {
      const payload = await getJson<ProviderStatusResponse>("/api/providers/status");
      setPreflight({ loading: false, payload, checkedAt: preflightTime() });
      return true;
    } catch (error) {
      setPreflight({ loading: false, error: error instanceof Error ? error.message : "Backend preflight failed" });
      return false;
    }
  }, []);

  useEffect(() => {
    void runPreflight();
  }, [runPreflight]);

  useEffect(() => {
    void (async () => {
      const { status: s } = await Location.requestForegroundPermissionsAsync();
      setLocPermission(s === "granted");
    })();
  }, []);

  const readTelemetry = useCallback(async (): Promise<Telemetry> => {
    let lat = DEMO_ORIGIN.lat;
    let lng = DEMO_ORIGIN.lng;
    let speedMps = 0;
    let headingDeg = 0;

    if (locPermission) {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
      lat = loc.coords.latitude;
      lng = loc.coords.longitude;
      if (loc.coords.speed != null && Number.isFinite(loc.coords.speed)) speedMps = Math.max(0, loc.coords.speed);
      if (loc.coords.heading != null && Number.isFinite(loc.coords.heading) && loc.coords.heading >= 0) {
        headingDeg = loc.coords.heading % 360;
      }
    }

    return { lat, lng, speedMps, headingDeg };
  }, [locPermission]);

  const startRideFor = useCallback(async (telemetry: Telemetry): Promise<RideStart> => {
    try {
      const response = await postJson<CreateRideResponse>("/api/rides", {
        mode: "bike",
        startLat: telemetry.lat,
        startLng: telemetry.lng,
      });
      const ride = { id: response.ride.id, startedAt: response.ride.startedAt, fallback: false };
      setActiveRide(ride);
      return { ride };
    } catch (error) {
      const ride = { id: DEMO_RIDE_ID, startedAt: new Date().toISOString(), fallback: true };
      setActiveRide(ride);
      return {
        ride,
        note: `Using demo ride fallback: ${error instanceof Error ? error.message : "create ride failed"}`,
      };
    }
  }, []);

  const ensureRide = useCallback(
    async (telemetry: Telemetry): Promise<RideStart> => {
      if (activeRide) return { ride: activeRide };
      return startRideFor(telemetry);
    },
    [activeRide, startRideFor],
  );

  const persistPipelineFromImage = useCallback(
    async (imageBase64: string, options: { statusPrefix?: string } = {}) => {
      const telemetry = await readTelemetry();
      const started = await ensureRide(telemetry);
      const ride = started.ride;
      const t = secondsSince(ride.startedAt);
      const point = { t, ...telemetry };
      const prefix = options.statusPrefix ?? "";

      setStatus(`${prefix}Uploading…`);
      const upload = await postJson<MediaUploadResponse>("/api/media/upload", {
        thumbnailBase64: imageBase64,
        imageMimeType: "image/jpeg",
      });

      setStatus(`${prefix}Analyzing (YOLO + save)…`);
      const saved = await postJson<AnalyzeResponse>("/api/media/analyze-and-save", {
        imageBase64,
        rideId: ride.id,
        t,
        ...telemetry,
        camera: "front",
        useYolo: true,
        clipUrl: upload.clipUrl,
        thumbnailUrl: upload.thumbnailUrl,
      });

      setStatus(`${prefix}Appending route point…`);
      await postJson<AppendRideRouteResponse>(ridePath(ride.id, "/route"), { point });

      setLast(saved);
      const note = started.note ? `${started.note}. ` : "";
      setStatus(saved.yoloNote ? `${prefix}${note}Saved event + route (${saved.yoloNote})` : `${prefix}${note}Saved event + route.`);

      const voice = await postJson<VoiceResponse>("/api/voice/alert", { text: saved.event.spokenAlert });
      await playVoiceAlert(voice);
      return { saved, started };
    },
    [ensureRide, readTelemetry],
  );

  const startRide = useCallback(async () => {
    if (activeRide) return;
    setBusy(true);
    setStatus("Starting ride…");
    try {
      const telemetry = await readTelemetry();
      const started = await startRideFor(telemetry);
      setStatus(started.note ?? `Ride ${started.ride.id} started.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Ride start failed");
    } finally {
      setBusy(false);
    }
  }, [activeRide, readTelemetry, startRideFor]);

  const endRide = useCallback(async () => {
    if (!activeRide) return;
    setBusy(true);
    setStatus("Ending ride…");
    try {
      const response = await patchJson<EndRideResponse>(ridePath(activeRide.id, "/end"));
      setActiveRide(null);
      setStatus(`Ride ${response.ride.id} ended with ${response.ride.stats.eventCount} events.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Ride end failed");
    } finally {
      setBusy(false);
    }
  }, [activeRide]);

  const onCameraLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) setPreviewSize({ w: width, h: height });
  }, []);

  useEffect(() => {
    if (!permission?.granted) {
      setLiveDetections([]);
      setLiveHudScore(0);
      setLiveDetectNote(undefined);
      setMonitorTickBusy(false);
      setLiveRoundTripMs(null);
      return;
    }

    let cancelled = false;

    const liveLoop = async () => {
      while (!cancelled) {
        if (busyRef.current) {
          await new Promise((r) => setTimeout(r, LIVE_MONITOR_ERROR_BACKOFF_MS));
          continue;
        }

        const cam = cameraViewRef.current;
        if (!cam) {
          await new Promise((r) => setTimeout(r, LIVE_MONITOR_ERROR_BACKOFF_MS));
          continue;
        }

        const t0 = Date.now();
        setMonitorTickBusy(true);
        try {
          const photo = await cam.takePictureAsync({
            base64: true,
            quality: LIVE_MONITOR_JPEG_QUALITY,
            shutterSound: false,
            skipProcessing: false,
          });
          if (!photo?.base64) {
            setLiveRoundTripMs(null);
            await new Promise((r) => setTimeout(r, LIVE_MONITOR_ERROR_BACKOFF_MS));
            continue;
          }

          const imageBase64 = `data:image/jpeg;base64,${photo.base64}`;
          const det = await postPerceptionDetect(imageBase64);
          setLiveDetections(det.detections);
          setLiveDetectNote(det.httpOk ? undefined : det.note);
          const score = scoreDetectionsForHud(det.detections);
          setLiveHudScore(score);
          setLiveRoundTripMs(Date.now() - t0);

          const now = Date.now();
          if (score >= SPEECH_HINT_MIN_SCORE && now - lastSpeechHintMsRef.current >= SPEECH_HINT_COOLDOWN_MS) {
            lastSpeechHintMsRef.current = now;
            Speech.speak(spokenHintForTopDetection(det.detections), { rate: 1.05 });
          }

          if (
            score >= AUTO_PERSIST_MIN_SCORE &&
            now - lastAutoPersistMsRef.current >= AUTO_PERSIST_COOLDOWN_MS &&
            !persistInFlightRef.current &&
            !busyRef.current
          ) {
            persistInFlightRef.current = true;
            lastAutoPersistMsRef.current = now;
            try {
              setStatus("Monitor: high risk — saving event…");
              await persistPipelineFromImage(imageBase64, { statusPrefix: "Monitor: " });
            } catch (err) {
              setStatus(err instanceof Error ? err.message : "Monitor auto-save failed");
            } finally {
              persistInFlightRef.current = false;
            }
          }
        } catch {
          setLiveDetectNote("Live frame failed (camera or network).");
          setLiveRoundTripMs(null);
          await new Promise((r) => setTimeout(r, LIVE_MONITOR_ERROR_BACKOFF_MS));
        } finally {
          setMonitorTickBusy(false);
        }
      }
    };

    void liveLoop();
    return () => {
      cancelled = true;
    };
  }, [permission?.granted, persistPipelineFromImage]);

  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#22d3ee" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Text style={styles.mono}>Camera permission is required.</Text>
        <Pressable style={styles.button} onPress={() => void requestPermission()}>
          <Text style={styles.buttonText}>Grant</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.tag}>GUARDIAN ROAD</Text>
      <Text style={styles.title}>Wi‑Fi capture</Text>
      <Text style={styles.caption}>API: {apiBase()}</Text>
      <Text style={styles.caption}>
        Set EXPO_PUBLIC_API_BASE_URL to your laptop LAN IP (same Wi‑Fi as this phone). Run Next.js, YOLO sidecar, and set
        YOLO_SERVICE_URL on the server.
      </Text>

      <View style={styles.preflightPanel}>
        <View style={styles.preflightHeader}>
          <Text style={styles.preflightTitle}>Backend preflight</Text>
          <Pressable onPress={() => void runPreflight()} disabled={preflight.loading || busy}>
            <Text style={[styles.refreshText, (preflight.loading || busy) && styles.refreshDisabled]}>{preflight.loading ? "checking" : "refresh"}</Text>
          </Pressable>
        </View>
        {preflight.payload ? (
          <>
            <Text style={styles.preflightLine}>
              Backend reachable · {preflight.payload.status}
              {preflight.checkedAt ? ` · ${preflight.checkedAt}` : ""}
            </Text>
            <View style={styles.chipRow}>
              {renderProviderChip("YOLO", preflight.payload.providers.yolo.configured, preflight.payload.providers.yolo.available)}
              {renderProviderChip("Gemini", preflight.payload.providers.gemini.configured, preflight.payload.providers.gemini.available, "stub")}
              {renderProviderChip("Voice", preflight.payload.providers.elevenLabs.configured, preflight.payload.providers.elevenLabs.available, "native")}
            </View>
          </>
        ) : (
          <Text style={[styles.preflightLine, styles.preflightError]}>
            {preflight.loading ? "Checking API…" : `Backend unreachable: ${preflight.error ?? "not checked"}`}
          </Text>
        )}
      </View>

      <View style={styles.ridePanel}>
        <Text style={styles.rideLabel}>Ride</Text>
        <Text style={styles.rideValue}>{activeRide ? `${activeRide.id}${activeRide.fallback ? " (demo fallback)" : ""}` : "No active ride"}</Text>
      </View>

      <View style={styles.actionRow}>
        <Pressable style={[styles.secondaryButton, (busy || Boolean(activeRide)) && styles.disabled]} onPress={() => void startRide()} disabled={busy || Boolean(activeRide)}>
          <Text style={styles.secondaryText}>Start ride</Text>
        </Pressable>
        <Pressable style={[styles.secondaryButton, (busy || !activeRide) && styles.disabled]} onPress={() => void endRide()} disabled={busy || !activeRide}>
          <Text style={styles.secondaryText}>End ride</Text>
        </Pressable>
      </View>

      <View style={styles.monitorPanel}>
        <Text style={styles.preflightTitle}>Live perception</Text>
        <Text style={styles.monitorCaption}>
          Always on while this screen is open: JPEG frames POST to /api/perception/detect; green boxes show YOLO classes. High HUD score triggers debounced analyze-and-save + voice. Round-trip depends on Wi‑Fi and laptop GPU.
        </Text>
        <View style={styles.monitorStats}>
          <Text style={styles.monitorStatLine}>HUD score {liveHudScore}</Text>
          <Text style={styles.monitorStatLine}>{liveDetections.length} detection(s)</Text>
          <Text style={styles.monitorStatLine}>
            {liveRoundTripMs != null ? `last frame ${liveRoundTripMs} ms` : "last frame —"}
          </Text>
          {monitorTickBusy ? <Text style={styles.monitorStatDim}>live loop…</Text> : null}
        </View>
        {liveDetectNote ? <Text style={styles.preflightError}>{liveDetectNote}</Text> : null}
      </View>

      <View style={styles.camWrap} onLayout={onCameraLayout}>
        <CameraView
          ref={(node) => {
            cameraViewRef.current = node;
          }}
          style={styles.camera}
          facing="back"
          mode="video"
        />
        {previewSize && liveDetections.length > 0
          ? liveDetections.map((d, i) => {
              const b = d.bbox;
              if (!b || b.length < 4) return null;
              const [x1, y1, x2, y2] = b;
              const left = x1 * previewSize.w;
              const top = y1 * previewSize.h;
              const w = Math.max(0, (x2 - x1) * previewSize.w);
              const h = Math.max(0, (y2 - y1) * previewSize.h);
              return (
                <View key={d.id ?? `det-${i}`} pointerEvents="none" style={[styles.detectionBox, styles.detectionRecognized, { left, top, width: w, height: h }]}>
                  <Text style={styles.detectionLabel} numberOfLines={1}>
                    {d.label}
                  </Text>
                </View>
              );
            })
          : null}
      </View>

      {status ? (
        <Text style={styles.status} selectable>
          {status}
        </Text>
      ) : null}

      {last ? (
        <View style={styles.card}>
          <Text style={styles.mono}>provider {last.provider}</Text>
          <Text style={styles.resultType}>{last.event.type.replaceAll("_", " ")}</Text>
          <Text style={styles.severity}>{Math.round(last.event.severity)}</Text>
          <Text style={styles.alert}>{last.event.spokenAlert}</Text>
          <Text style={styles.detail}>{last.event.explanation}</Text>
          {last.yoloNote ? <Text style={styles.warn}>{last.yoloNote}</Text> : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 48, backgroundColor: "#0a0a0b" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0a0a0b" },
  tag: { fontFamily: "monospace", fontSize: 11, letterSpacing: 3, color: "#22d3ee", marginBottom: 8 },
  title: { fontSize: 26, fontWeight: "600", color: "#f8fafc", marginBottom: 8 },
  caption: { fontSize: 13, color: "#94a3b8", marginBottom: 8, lineHeight: 20 },
  preflightPanel: {
    marginTop: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "rgba(15,23,42,0.78)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.18)",
  },
  preflightHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  preflightTitle: { fontFamily: "monospace", fontSize: 11, letterSpacing: 2, color: "#e2e8f0", textTransform: "uppercase" },
  refreshText: { fontFamily: "monospace", fontSize: 11, color: "#67e8f9", textTransform: "uppercase" },
  refreshDisabled: { opacity: 0.45 },
  preflightLine: { color: "#cbd5e1", fontSize: 12, marginBottom: 8 },
  preflightError: { color: "#f87171", marginBottom: 0, fontSize: 12, marginTop: 6 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 6 },
  chipOk: { backgroundColor: "rgba(34,197,94,0.12)", borderColor: "rgba(34,197,94,0.42)" },
  chipWarn: { backgroundColor: "rgba(251,191,36,0.12)", borderColor: "rgba(251,191,36,0.42)" },
  chipBad: { backgroundColor: "rgba(248,113,113,0.12)", borderColor: "rgba(248,113,113,0.48)" },
  chipLabel: { fontFamily: "monospace", fontSize: 11, color: "#94a3b8", textTransform: "uppercase" },
  chipValue: { fontFamily: "monospace", fontSize: 11, color: "#f8fafc", textTransform: "uppercase" },
  ridePanel: {
    marginTop: 8,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  rideLabel: { fontFamily: "monospace", fontSize: 11, letterSpacing: 2, color: "#64748b", textTransform: "uppercase" },
  rideValue: { color: "#e2e8f0", fontSize: 14, marginTop: 6 },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  secondaryButton: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(34,211,238,0.45)",
    alignItems: "center",
  },
  secondaryText: { color: "#a5f3fc", fontWeight: "600" },
  disabled: { opacity: 0.45 },
  monitorPanel: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "rgba(15,23,42,0.55)",
    borderWidth: 1,
    borderColor: "rgba(34,211,238,0.2)",
  },
  monitorCaption: { color: "#94a3b8", fontSize: 12, lineHeight: 18, marginTop: 6 },
  monitorStats: { marginTop: 10 },
  monitorStatLine: { fontFamily: "monospace", fontSize: 11, color: "#cbd5e1" },
  monitorStatDim: { fontFamily: "monospace", fontSize: 10, color: "#64748b", marginTop: 4 },
  camWrap: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    marginTop: 12,
    position: "relative",
  },
  camera: { width: "100%", aspectRatio: 16 / 9, backgroundColor: "#000" },
  detectionBox: {
    position: "absolute",
    borderWidth: 2,
    borderRadius: 4,
    justifyContent: "flex-start",
    overflow: "hidden",
  },
  /** All YOLO recognitions use the same positive “locked-in” cue. */
  detectionRecognized: {
    borderColor: "rgba(74, 222, 128, 0.98)",
    backgroundColor: "rgba(34, 197, 94, 0.14)",
  },
  detectionLabel: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    paddingVertical: 1,
    paddingHorizontal: 4,
    fontSize: 9,
    fontFamily: "monospace",
    color: "#052e16",
    backgroundColor: "rgba(74, 222, 128, 0.92)",
  },
  status: { marginTop: 16, color: "#cbd5e1", fontSize: 13 },
  card: {
    marginTop: 20,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  mono: { fontFamily: "monospace", fontSize: 11, color: "#64748b", marginBottom: 8 },
  resultType: { fontSize: 18, color: "#e2e8f0", fontWeight: "600" },
  severity: { fontSize: 14, color: "#f87171", marginTop: 4 },
  alert: { fontSize: 16, color: "#f1f5f9", marginTop: 12 },
  detail: { fontSize: 14, color: "#94a3b8", marginTop: 8, lineHeight: 20 },
  warn: { fontSize: 12, color: "#fbbf24", marginTop: 10 },
  button: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: "#22d3ee",
    borderRadius: 999,
  },
  buttonText: { fontWeight: "600", color: "#0a0a0b" },
});
