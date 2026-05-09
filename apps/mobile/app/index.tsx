import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Location from "expo-location";
import Constants from "expo-constants";
import { Audio } from "expo-av";
import * as Speech from "expo-speech";
import type { MediaUploadResponse } from "./types";

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

function apiBase(): string {
  const fromExtra = Constants.expoConfig?.extra?.apiBaseUrl as string | undefined;
  return (fromExtra ?? "http://127.0.0.1:3000").replace(/\/$/, "");
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const url = `${apiBase()}${path}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? `${path} ${response.status}`);
  return payload;
}

export default function CaptureScreen() {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [locPermission, setLocPermission] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [last, setLast] = useState<AnalyzeResponse | null>(null);

  const [rideId] = useState("demo-ride-1");

  useEffect(() => {
    void (async () => {
      const { status: s } = await Location.requestForegroundPermissionsAsync();
      setLocPermission(s === "granted");
    })();
  }, []);

  const capture = useCallback(async () => {
    if (!cameraRef.current) return;
    setBusy(true);
    setStatus("Capturing…");
    setLast(null);

    try {
      let lat = 38.5449;
      let lng = -121.7405;
      let speedMps = 0;
      let headingDeg = 0;

      if (locPermission) {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
        if (loc.coords.speed != null && Number.isFinite(loc.coords.speed)) speedMps = loc.coords.speed;
        if (loc.coords.heading != null && Number.isFinite(loc.coords.heading)) headingDeg = loc.coords.heading;
      }

      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.82,
        shutterSound: false,
        skipProcessing: false,
      });

      if (!photo?.base64) throw new Error("Camera did not return base64.");

      const imageBase64 = `data:image/jpeg;base64,${photo.base64}`;

      setStatus("Uploading…");
      const upload = await postJson<MediaUploadResponse>("/api/media/upload", {
        imageBase64,
        imageMimeType: "image/jpeg",
      });

      setStatus("Analyzing (YOLO + save)…");
      const t = Math.round(Date.now() / 1000) % 1_000_000;

      const saved = await postJson<AnalyzeResponse>("/api/media/analyze-and-save", {
        imageBase64,
        rideId,
        t,
        lat,
        lng,
        speedMps,
        headingDeg,
        camera: "front",
        useYolo: true,
        clipUrl: upload.clipUrl,
        thumbnailUrl: upload.thumbnailUrl,
      });

      setLast(saved);
      setStatus(saved.yoloNote ? `Saved (${saved.yoloNote})` : "Saved event.");

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
  }, [locPermission]);

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

      <View style={styles.camWrap}>
        <CameraView ref={cameraRef} style={styles.camera} facing="back" mode="picture" />
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
