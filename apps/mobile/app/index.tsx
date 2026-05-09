import { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Location from "expo-location";
import Constants from "expo-constants";
import { Audio } from "expo-av";
import * as Speech from "expo-speech";
import type { AppendRideRouteResponse, CreateRideResponse, EndRideResponse, MediaUploadResponse, ProviderStatusResponse, Ride } from "./types";

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

const DEMO_RIDE_ID = "demo-ride-1";
const DEMO_ORIGIN = { lat: 38.5449, lng: -121.7405 };
const CAPTURE_IMAGE_QUALITY = 0.55;

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

export default function CaptureScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [locPermission, setLocPermission] = useState<boolean | null>(null);
  const [cameraRef, setCameraRef] = useState<CameraView | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [last, setLast] = useState<AnalyzeResponse | null>(null);
  const [activeRide, setActiveRide] = useState<ActiveRide | null>(null);
  const [preflight, setPreflight] = useState<PreflightState>({ loading: true });

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

  const capture = useCallback(async () => {
    if (!cameraRef) return;
    setBusy(true);
    setStatus("Capturing…");
    setLast(null);

    try {
      setStatus("Checking backend…");
      const backendReachable = await runPreflight();
      if (!backendReachable) throw new Error("Backend is not reachable. Check API base URL and Wi‑Fi.");

      const telemetry = await readTelemetry();
      const started = await ensureRide(telemetry);
      const ride = started.ride;

      const photo = await cameraRef.takePictureAsync({
        base64: true,
        quality: CAPTURE_IMAGE_QUALITY,
        shutterSound: false,
        skipProcessing: false,
      });

      if (!photo?.base64) throw new Error("Camera did not return base64.");

      const imageBase64 = `data:image/jpeg;base64,${photo.base64}`;
      const t = secondsSince(ride.startedAt);
      const point = { t, ...telemetry };

      setStatus("Uploading…");
      const upload = await postJson<MediaUploadResponse>("/api/media/upload", {
        thumbnailBase64: imageBase64,
        imageMimeType: "image/jpeg",
      });

      setStatus("Analyzing (YOLO + save)…");
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

      setStatus("Appending route point…");
      await postJson<AppendRideRouteResponse>(ridePath(ride.id, "/route"), { point });

      setLast(saved);
      const note = started.note ? `${started.note}. ` : "";
      setStatus(saved.yoloNote ? `${note}Saved event + route (${saved.yoloNote})` : `${note}Saved event + route.`);

      const voice = await postJson<VoiceResponse>("/api/voice/alert", { text: saved.event.spokenAlert });
      if (voice.audioUrl) {
        const uri = voice.audioUrl.startsWith("http") ? voice.audioUrl : `${apiBase()}${voice.audioUrl.startsWith("/") ? "" : "/"}${voice.audioUrl}`;
        try {
          const { sound } = await Audio.Sound.createAsync({ uri });
          await sound.playAsync();
        } catch {
          Speech.speak(voice.text, { rate: 1.05 });
        }
      } else {
        Speech.speak(voice.text, { rate: 1.05 });
      }
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Capture failed");
    } finally {
      setBusy(false);
    }
  }, [cameraRef, ensureRide, readTelemetry, runPreflight]);

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

      <View style={styles.camWrap}>
        <CameraView ref={setCameraRef} style={styles.camera} facing="back" mode="picture" />
      </View>

      <Pressable style={[styles.capture, busy && styles.captureDisabled]} onPress={() => void capture()} disabled={busy}>
        {busy ? <ActivityIndicator color="#0a0a0b" /> : <Text style={styles.captureText}>Capture hazard</Text>}
      </Pressable>

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
  preflightError: { color: "#f87171", marginBottom: 0 },
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
  camWrap: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    marginTop: 12,
  },
  camera: { width: "100%", aspectRatio: 16 / 9, backgroundColor: "#000" },
  capture: {
    marginTop: 20,
    backgroundColor: "#22d3ee",
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: "center",
  },
  captureDisabled: { opacity: 0.6 },
  captureText: { fontWeight: "600", color: "#0a0a0b", fontSize: 16 },
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
