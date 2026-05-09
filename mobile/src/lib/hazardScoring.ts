import type { Detection, MobileHazard, RideMode } from "./types";

const vehicleLabels = new Set(["car", "truck", "bus", "motorcycle"]);

export function buildHazardsFromDetections(
  detections: Detection[],
  mode: RideMode,
  now = Date.now()
): MobileHazard[] {
  return detections
    .map((detection) => scoreDetection(detection, mode, now))
    .filter((hazard): hazard is MobileHazard => hazard !== null)
    .sort((a, b) => b.severity - a.severity);
}

function scoreDetection(detection: Detection, mode: RideMode, now: number): MobileHazard | null {
  const proximityRisk = Math.max(0, 100 - detection.distanceM * 8);
  const ttcRisk = detection.ttcSec ? Math.max(0, 100 - detection.ttcSec * 25) : 25;
  const confidenceRisk = detection.confidence * 100;
  const baseSeverity = Math.round(proximityRisk * 0.5 + ttcRisk * 0.3 + confidenceRisk * 0.2);

  if (mode === "bike" && vehicleLabels.has(detection.label)) {
    const closePass = detection.bbox.x < 0.2 || detection.bbox.x + detection.bbox.width > 0.8;
    const severity = clampSeverity(baseSeverity + (closePass ? 15 : 4));

    return {
      id: `${detection.id}-${now}`,
      type: closePass ? "close_pass" : "vehicle_approach",
      severity,
      confidence: detection.confidence,
      spokenAlert: closePass
        ? "Vehicle closing near your side."
        : "Vehicle approach detected.",
      explanation: `${detection.label} detected ${detection.distanceM.toFixed(
        1
      )} meters away while riding in bike mode.`,
      detection,
      createdAt: now
    };
  }

  if (mode === "bike" && detection.label === "person") {
    return {
      id: `${detection.id}-${now}`,
      type: "pedestrian_conflict",
      severity: clampSeverity(baseSeverity + 8),
      confidence: detection.confidence,
      spokenAlert: "Pedestrian ahead.",
      explanation: `Pedestrian detected ${detection.distanceM.toFixed(
        1
      )} meters ahead in the rider path.`,
      detection,
      createdAt: now
    };
  }

  if (mode === "car" && detection.label === "bicycle") {
    return {
      id: `${detection.id}-${now}`,
      type: detection.ttcSec && detection.ttcSec < 1.5 ? "intersection_conflict" : "vehicle_approach",
      severity: clampSeverity(baseSeverity + 18),
      confidence: detection.confidence,
      spokenAlert: "Cyclist ahead. Give space.",
      explanation: `Cyclist detected ${detection.distanceM.toFixed(
        1
      )} meters ahead from dashcam view.`,
      detection,
      createdAt: now
    };
  }

  if (mode === "car" && detection.label === "person") {
    return {
      id: `${detection.id}-${now}`,
      type: "pedestrian_conflict",
      severity: clampSeverity(baseSeverity + 5),
      confidence: detection.confidence,
      spokenAlert: "Pedestrian near roadway.",
      explanation: `Pedestrian detected ${detection.distanceM.toFixed(
        1
      )} meters from the vehicle path.`,
      detection,
      createdAt: now
    };
  }

  return null;
}

function clampSeverity(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}
