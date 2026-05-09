import { useEffect, useMemo, useRef, useState } from "react";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Speech from "expo-speech";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { DetectionOverlay } from "../components/DetectionOverlay";
import { ModeToggle } from "../components/ModeToggle";
import { buildHazardsFromDetections } from "../lib/hazardScoring";
import { getMockDetections } from "../lib/mockDetections";
import type { MobileHazard, RideMode } from "../lib/types";
import { colorForSeverity } from "../lib/visuals";
import { cocoSsdMobileNetV1, useCocoSsdMobileNetV1 } from "../ml/cocoSsdMobileNetV1";

export function CaptureScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<RideMode>("bike");
  const [frameIndex, setFrameIndex] = useState(0);
  const [savedHazards, setSavedHazards] = useState<MobileHazard[]>([]);
  const lastSpokenHazardId = useRef<string | null>(null);
  const model = useCocoSsdMobileNetV1();

  useEffect(() => {
    const interval = setInterval(() => {
      setFrameIndex((current) => current + 1);
    }, 1600);

    return () => clearInterval(interval);
  }, []);

  const detections = useMemo(() => getMockDetections(mode, frameIndex), [frameIndex, mode]);
  const hazards = useMemo(() => buildHazardsFromDetections(detections, mode), [detections, mode]);
  const topHazard = hazards[0];

  useEffect(() => {
    if (!topHazard || topHazard.severity < 70) return;
    if (lastSpokenHazardId.current === topHazard.detection.id) return;

    lastSpokenHazardId.current = topHazard.detection.id;
    setSavedHazards((existing) => [topHazard, ...existing].slice(0, 8));
    Speech.speak(topHazard.spokenAlert, {
      rate: 0.96,
      pitch: 1.0
    });
  }, [topHazard]);

  if (!permission) {
    return <PermissionShell title="Loading camera permission..." />;
  }

  if (!permission.granted) {
    return (
      <PermissionShell title="Guardian Road needs camera access">
        <Text style={styles.permissionCopy}>
          Camera access lets the mobile app detect road users and show risk alerts while
          riding or driving.
        </Text>
        <Pressable style={styles.primaryButton} onPress={requestPermission}>
          <Text style={styles.primaryButtonText}>Enable Camera</Text>
        </Pressable>
      </PermissionShell>
    );
  }

  return (
    <SafeAreaView style={styles.shell}>
      <View style={styles.cameraStage}>
        <CameraView style={StyleSheet.absoluteFill} facing="back" />
        <View style={styles.cameraScrim} />
        <DetectionOverlay detections={detections} hazards={hazards} />

        <View style={styles.topBar}>
          <View>
            <Text style={styles.eyebrow}>Guardian Road</Text>
            <Text style={styles.title}>{mode === "bike" ? "Rider Mode" : "Driver Mode"}</Text>
          </View>
          <ModeToggle mode={mode} onChange={setMode} />
        </View>

        <View style={styles.modelPanel}>
          <Metric label="Model" value={cocoSsdMobileNetV1.name} />
          <Metric label="Input" value="300 x 300" />
          <Metric label="Runtime" value={formatModelState(model.state)} />
        </View>

        <View style={styles.alertPanel}>
          {topHazard ? (
            <>
              <View style={styles.alertHeader}>
                <Text style={[styles.riskPill, { color: colorForSeverity(topHazard.severity) }]}>
                  Risk {topHazard.severity}
                </Text>
                <Text style={styles.confidence}>
                  {Math.round(topHazard.confidence * 100)}% confidence
                </Text>
              </View>
              <Text style={styles.alertText}>{topHazard.spokenAlert}</Text>
              <Text style={styles.explanation}>{topHazard.explanation}</Text>
            </>
          ) : (
            <>
              <Text style={styles.alertText}>Road scan active.</Text>
              <Text style={styles.explanation}>No high-priority hazard in the current frame.</Text>
            </>
          )}
        </View>
      </View>

      <View style={styles.savedPanel}>
        <View style={styles.savedHeader}>
          <Text style={styles.sectionTitle}>Saved Hazard Events</Text>
          <Text style={styles.savedCount}>{savedHazards.length} saved</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.savedList}>
          {savedHazards.length === 0 ? (
            <Text style={styles.emptyState}>High-risk detections will be saved here.</Text>
          ) : (
            savedHazards.map((hazard) => (
              <View key={hazard.id} style={styles.savedCard}>
                <Text style={[styles.savedRisk, { color: colorForSeverity(hazard.severity) }]}>
                  {hazard.severity}
                </Text>
                <Text style={styles.savedType}>{hazard.type.replaceAll("_", " ")}</Text>
                <Text style={styles.savedMeta}>{hazard.detection.label}</Text>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function PermissionShell({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <SafeAreaView style={styles.permissionShell}>
      <Text style={styles.eyebrow}>Guardian Road</Text>
      <Text style={styles.permissionTitle}>{title}</Text>
      {children}
    </SafeAreaView>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function formatModelState(state: string): string {
  if (state === "loaded") return "TFLite loaded";
  if (state === "loading") return "Loading";
  if (state === "error") return "Needs dev build";
  return "Ready";
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: "#05070a"
  },
  cameraStage: {
    flex: 1,
    margin: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(126, 235, 255, 0.26)",
    borderRadius: 14,
    backgroundColor: "#0a0f14"
  },
  cameraScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(5, 7, 10, 0.18)"
  },
  topBar: {
    position: "absolute",
    top: 14,
    left: 14,
    right: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  eyebrow: {
    color: "#8feeff",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  title: {
    marginTop: 2,
    color: "#f7fcff",
    fontSize: 24,
    fontWeight: "900"
  },
  modelPanel: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 148,
    flexDirection: "row",
    gap: 8
  },
  metric: {
    flex: 1,
    minHeight: 54,
    justifyContent: "center",
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 8,
    backgroundColor: "rgba(5, 9, 13, 0.78)"
  },
  metricLabel: {
    color: "#91a7b1",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  metricValue: {
    marginTop: 3,
    color: "#f7fcff",
    fontSize: 12,
    fontWeight: "900"
  },
  alertPanel: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 14,
    minHeight: 118,
    justifyContent: "center",
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 10,
    backgroundColor: "rgba(7, 12, 17, 0.9)"
  },
  alertHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  riskPill: {
    fontSize: 13,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  confidence: {
    color: "#9db1bb",
    fontSize: 12,
    fontWeight: "800"
  },
  alertText: {
    marginTop: 8,
    color: "#ffffff",
    fontSize: 21,
    fontWeight: "900"
  },
  explanation: {
    marginTop: 8,
    color: "#b5c5cc",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18
  },
  savedPanel: {
    paddingHorizontal: 12,
    paddingBottom: 14
  },
  savedHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10
  },
  sectionTitle: {
    color: "#f7fcff",
    fontSize: 13,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  savedCount: {
    color: "#91a7b1",
    fontSize: 12,
    fontWeight: "800"
  },
  savedList: {
    gap: 8,
    paddingRight: 12
  },
  savedCard: {
    width: 132,
    minHeight: 82,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 9,
    backgroundColor: "rgba(255, 255, 255, 0.045)"
  },
  savedRisk: {
    fontSize: 24,
    fontWeight: "900"
  },
  savedType: {
    marginTop: 4,
    color: "#f7fcff",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "capitalize"
  },
  savedMeta: {
    marginTop: 4,
    color: "#91a7b1",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  emptyState: {
    color: "#91a7b1",
    fontSize: 13,
    fontWeight: "700"
  },
  permissionShell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#05070a"
  },
  permissionTitle: {
    marginTop: 8,
    color: "#f7fcff",
    fontSize: 26,
    fontWeight: "900",
    textAlign: "center"
  },
  permissionCopy: {
    marginTop: 12,
    color: "#b5c5cc",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center"
  },
  primaryButton: {
    marginTop: 22,
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: "#54e6ff"
  },
  primaryButtonText: {
    color: "#061015",
    fontSize: 15,
    fontWeight: "900"
  }
});
