import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, useWindowDimensions } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Video, ResizeMode } from "expo-av";
import Constants from "expo-constants";

type HazardEventItem = {
  id: string;
  rideId: string;
  timestamp: string;
  type: string;
  severity: number;
  spokenAlert: string;
  clipUrl?: string;
  thumbnailUrl?: string;
};

type EventsPayload = { events: HazardEventItem[] };

function apiBase(): string {
  const fromExtra = Constants.expoConfig?.extra?.apiBaseUrl as string | undefined;
  return (fromExtra ?? "http://127.0.0.1:3000").replace(/\/$/, "");
}

function resolveMediaUrl(pathOrUrl: string | undefined): string | null {
  if (!pathOrUrl?.trim()) return null;
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) return pathOrUrl;
  const base = apiBase();
  return `${base}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

export default function ClipGalleryScreen() {
  const { rideId } = useLocalSearchParams<{ rideId?: string }>();
  const { width } = useWindowDimensions();
  const tileW = Math.min(width - 40, 520);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clips, setClips] = useState<HazardEventItem[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = rideId ? `?rideId=${encodeURIComponent(rideId)}` : "";
      const url = `${apiBase()}/api/events${qs}`;
      const res = await fetch(url);
      const data = (await res.json()) as EventsPayload & { error?: string };
      if (!res.ok) throw new Error(data.error ?? `${res.status}`);
      const list = Array.isArray(data.events) ? data.events : [];
      const withVideo = list.filter((e) => Boolean(e.clipUrl?.trim()));
      setClips(withVideo);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load clips");
      setClips([]);
    } finally {
      setLoading(false);
    }
  }, [rideId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={styles.screen}>
      <Text style={styles.sub}>{rideId ? `Ride ${rideId}` : "All rides"} · events with clip URLs</Text>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#22d3ee" />
        </View>
      ) : error ? (
        <Text style={styles.err}>{error}</Text>
      ) : clips.length === 0 ? (
        <Text style={styles.empty}>No video clips yet. Hazard saves that include a clip appear here.</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {clips.map((ev) => {
            const uri = resolveMediaUrl(ev.clipUrl);
            if (!uri) return null;
            return (
              <View key={ev.id} style={[styles.card, { width: tileW }]}>
                <Video
                  style={[styles.video, { width: tileW - 28 }]}
                  source={{ uri }}
                  useNativeControls
                  resizeMode={ResizeMode.CONTAIN}
                  shouldPlay={false}
                />
                <Text style={styles.meta}>{new Date(ev.timestamp).toLocaleString()}</Text>
                <Text style={styles.metaDim}>{ev.type.replaceAll("_", " ")} · sev {Math.round(ev.severity)}</Text>
                <Text style={styles.alert} numberOfLines={2}>
                  {ev.spokenAlert}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0a0a0b",
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  sub: {
    fontFamily: "monospace",
    fontSize: 11,
    color: "#64748b",
    marginBottom: 16,
  },
  center: { paddingVertical: 40, alignItems: "center" },
  err: { color: "#f87171", fontSize: 14 },
  empty: { color: "#94a3b8", fontSize: 14, lineHeight: 22 },
  list: { paddingBottom: 40, gap: 20 },
  card: {
    alignSelf: "center",
    padding: 14,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  video: {
    aspectRatio: 16 / 9,
    borderRadius: 12,
    backgroundColor: "#000",
  },
  meta: { marginTop: 10, fontFamily: "monospace", fontSize: 11, color: "#cbd5e1" },
  metaDim: { marginTop: 4, fontSize: 12, color: "#64748b" },
  alert: { marginTop: 8, fontSize: 14, color: "#e2e8f0", lineHeight: 20 },
});
