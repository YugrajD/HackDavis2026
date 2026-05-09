import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useFrameProcessor,
} from "react-native-vision-camera";
import * as Speech from "expo-speech";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { runOnJS, useSharedValue } from "react-native-reanimated";
import { useResizePlugin } from "vision-camera-resize-plugin";
import { DetectionOverlay } from "../components/DetectionOverlay";
import { ModeToggle } from "../components/ModeToggle";
import { buildHazardsFromDetections } from "../lib/hazardScoring";
import type { Detection, MobileHazard, RideMode } from "../lib/types";
import { colorForSeverity } from "../lib/visuals";
import { cocoSsdMobileNetV1, useCocoSsdMobileNetV1 } from "../ml/cocoSsdMobileNetV1";
import { parseRawDetections } from "../ml/cocoSsdParser";

// Run TFLite on every Nth camera frame to stay within thermal/battery budget.
const FRAME_STRIDE = 4;

export function CaptureScreen() {
  const { hasPermission, requestPermission } = useCameraPermission();
  const [mode, setMode] = useState<RideMode>("bike");
  const [detections, setDetections] = useState<Detection[]>([]);
  const [savedHazards, setSavedHazards] = useState<MobileHazard[]>([]);
  const lastSpokenId = useRef<string | null>(null);

  const device = useCameraDevice("back");
  const modelResult = useCocoSsdMobileNetV1();
  const tfliteModel = modelResult.state === "loaded" ? modelResult.model : null;
  const { resize } = useResizePlugin();
  const frameCounter = useSharedValue(0);

  // Called on the JS thread after each inference pass.
  const handleRawOutput = useCallback(
    (boxes: number[], classes: number[], scores: number[], count: number) => {
      setDetections(parseRawDetections(boxes, classes, scores, count));
    },
    []
  );

  const frameProcessor = useFrameProcessor(
    (frame) => {
      "worklet";
      if (!tfliteModel) return;

      frameCounter.value = (frameCounter.value + 1) % FRAME_STRIDE;
      if (frameCounter.value !== 0) return;

      // Resize camera frame to the 300×300 RGB input the model expects.
      const resized = resize(frame, {
        scale: { width: 300, height: 300 },
        pixelFormat: "rgb",
        dataType: "uint8",
      });

      // run() is synchronous in worklet context despite its Promise TS type.
      // The resize plugin returns a Uint8Array; the model expects the raw ArrayBuffer.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const runSync = (tfliteModel as any).run.bind(tfliteModel) as (
        inputs: ArrayBuffer[]
      ) => ArrayBuffer[];
      const outputs = runSync([resized.buffer as ArrayBuffer]);

      // Wrap each ArrayBuffer output in a typed view for indexing.
      const rawBoxes = new Float32Array(outputs[0] as ArrayBuffer);    // [40]
      const rawClasses = new Float32Array(outputs[1] as ArrayBuffer);  // [10]
      const rawScores = new Float32Array(outputs[2] as ArrayBuffer);   // [10]
      const rawCount = new Float32Array(outputs[3] as ArrayBuffer);    // [1]

      // Copy to plain arrays before crossing the worklet→JS boundary.
      const boxes: number[] = [];
      const classes: number[] = [];
      const scores: number[] = [];
      for (let i = 0; i < rawBoxes.length; i++) boxes[i] = rawBoxes[i] as number;
      for (let i = 0; i < rawClasses.length; i++) classes[i] = rawClasses[i] as number;
      for (let i = 0; i < rawScores.length; i++) scores[i] = rawScores[i] as number;
      const count = (rawCount[0] as number) ?? 0;

      runOnJS(handleRawOutput)(boxes, classes, scores, count);
    },
    [tfliteModel, resize, frameCounter, handleRawOutput]
  );

  const hazards = useMemo(
    () => buildHazardsFromDetections(detections, mode),
    [detections, mode]
  );
  const topHazard = hazards[0];

  useEffect(() => {
    if (!topHazard || topHazard.severity < 70) return;
    if (lastSpokenId.current === topHazard.detection.id) return;

    lastSpokenId.current = topHazard.detection.id;
    setSavedHazards((prev) => [topHazard, ...prev].slice(0, 8));
    Speech.speak(topHazard.spokenAlert, { rate: 0.96, pitch: 1.0 });
  }, [topHazard]);

  if (!hasPermission) {
    return (
      <PermissionShell title="Guardian Road needs camera access">
        <Text style={styles.permissionCopy}>
          Camera access lets the app detect road users and show risk alerts while riding or
          driving.
        </Text>
        <Pressable style={styles.primaryButton} onPress={requestPermission}>
          <Text style={styles.primaryButtonText}>Enable Camera</Text>
        </Pressable>
      </PermissionShell>
    );
  }

  if (!device) {
    return <PermissionShell title="No back camera found." />;
  }

  return (
    <SafeAreaView style={styles.shell}>
      <View style={styles.cameraStage}>
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          isActive
          frameProcessor={modelResult.state === "loaded" ? frameProcessor : undefined}
        />
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
          <Metric label="Input" value="300 × 300" />
          <Metric label="Runtime" value={formatModelState(modelResult.state)} />
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
              <Text style={styles.explanation}>{statusMessage(modelResult.state)}</Text>
            </>
          )}
        </View>
      </View>

      <View style={styles.savedPanel}>
        <View style={styles.savedHeader}>
          <Text style={styles.sectionTitle}>Saved Hazard Events</Text>
          <Text style={styles.savedCount}>{savedHazards.length} saved</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.savedList}
        >
          {savedHazards.length === 0 ? (
            <Text style={styles.emptyState}>High-risk detections will appear here.</Text>
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
  if (state === "loaded") return "TFLite active";
  if (state === "loading") return "Loading…";
  return "Needs dev build";
}

function statusMessage(state: string): string {
  if (state === "loaded") return "No high-priority hazard in frame.";
  if (state === "loading") return "Model loading — inference starts shortly.";
  return "TFLite requires an Expo dev build (expo run:ios / run:android).";
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: "#05070a" },
  cameraStage: {
    flex: 1,
    margin: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(126, 235, 255, 0.26)",
    borderRadius: 14,
    backgroundColor: "#0a0f14",
  },
  cameraScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(5, 7, 10, 0.18)",
  },
  topBar: {
    position: "absolute",
    top: 14,
    left: 14,
    right: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  eyebrow: {
    color: "#8feeff",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  title: { marginTop: 2, color: "#f7fcff", fontSize: 24, fontWeight: "900" },
  modelPanel: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 148,
    flexDirection: "row",
    gap: 8,
  },
  metric: {
    flex: 1,
    minHeight: 54,
    justifyContent: "center",
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 8,
    backgroundColor: "rgba(5, 9, 13, 0.78)",
  },
  metricLabel: {
    color: "#91a7b1",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  metricValue: { marginTop: 3, color: "#f7fcff", fontSize: 12, fontWeight: "900" },
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
    backgroundColor: "rgba(7, 12, 17, 0.9)",
  },
  alertHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  riskPill: { fontSize: 13, fontWeight: "900", textTransform: "uppercase" },
  confidence: { color: "#9db1bb", fontSize: 12, fontWeight: "800" },
  alertText: { marginTop: 8, color: "#ffffff", fontSize: 21, fontWeight: "900" },
  explanation: {
    marginTop: 8,
    color: "#b5c5cc",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  savedPanel: { paddingHorizontal: 12, paddingBottom: 14 },
  savedHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionTitle: {
    color: "#f7fcff",
    fontSize: 13,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  savedCount: { color: "#91a7b1", fontSize: 12, fontWeight: "800" },
  savedList: { gap: 8, paddingRight: 12 },
  savedCard: {
    width: 132,
    minHeight: 82,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 9,
    backgroundColor: "rgba(255, 255, 255, 0.045)",
  },
  savedRisk: { fontSize: 24, fontWeight: "900" },
  savedType: {
    marginTop: 4,
    color: "#f7fcff",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "capitalize",
  },
  savedMeta: {
    marginTop: 4,
    color: "#91a7b1",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  emptyState: { color: "#91a7b1", fontSize: 13, fontWeight: "700" },
  permissionShell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#05070a",
  },
  permissionTitle: {
    marginTop: 8,
    color: "#f7fcff",
    fontSize: 26,
    fontWeight: "900",
    textAlign: "center",
  },
  permissionCopy: {
    marginTop: 12,
    color: "#b5c5cc",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  primaryButton: {
    marginTop: 22,
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: "#54e6ff",
  },
  primaryButtonText: { color: "#061015", fontSize: 15, fontWeight: "900" },
});
