import type { ActorType, CameraRole, HazardEvent, HazardType, TrackedObject } from "@/lib/contracts";

export type FrameObservation = {
  frameId: string;
  capturedAt: string;
  camera: CameraRole;
  lat?: number;
  lng?: number;
  speedMps?: number;
  headingDeg?: number;
  width?: number;
  height?: number;
  detections: FrameDetection[];
};

export type FrameDetection = {
  id?: string;
  label: string;
  confidence: number;
  bbox?: [number, number, number, number];
  depthM?: number;
};

export type TrackState = TrackedObject & {
  lastFrameId: string;
  lastSeenAt: string;
};

export type PerceptionResult = {
  tracks: TrackState[];
  hazardDraft: Pick<HazardEvent, "type" | "severity" | "confidence" | "spokenAlert" | "explanation" | "objects" | "camera" | "lat" | "lng" | "headingDeg" | "speedMps" | "timestamp" | "t">;
};

const actorLabels: Array<[RegExp, ActorType]> = [
  [/truck|van/i, "truck"],
  [/bus/i, "bus"],
  [/car|vehicle|sedan|suv/i, "car"],
  [/bike|cyclist/i, "bike"],
  [/scooter/i, "scooter"],
  [/pedestrian|person|walker/i, "pedestrian"],
  [/cone/i, "cone"],
];

export function analyzeFrameObservation(current: FrameObservation, previous?: FrameObservation): PerceptionResult {
  const tracks = current.detections.map((detection, index) => detectionToTrack(detection, index, current, previous));
  const risk = scoreRisk(tracks, current);

  return {
    tracks,
    hazardDraft: {
      t: secondsSinceEpoch(current.capturedAt),
      timestamp: current.capturedAt,
      camera: current.camera,
      lat: current.lat ?? 38.5449,
      lng: current.lng ?? -121.7405,
      headingDeg: current.headingDeg ?? 0,
      speedMps: current.speedMps ?? 0,
      type: risk.type,
      severity: risk.severity,
      confidence: risk.confidence,
      spokenAlert: risk.alert,
      explanation: risk.explanation,
      objects: tracks,
    },
  };
}

function detectionToTrack(detection: FrameDetection, index: number, current: FrameObservation, previous?: FrameObservation): TrackState {
  const type = actorTypeFor(detection.label);
  const distanceM = detection.depthM ?? estimateDepthFromBbox(detection.bbox, type);
  const prior = previous?.detections.find((item) => (detection.id && item.id === detection.id) || item.label === detection.label);
  const previousDepth = prior?.depthM ?? estimateDepthFromBbox(prior?.bbox, type);
  const dt = previous ? Math.max(0.1, (Date.parse(current.capturedAt) - Date.parse(previous.capturedAt)) / 1000) : 1;
  const closingMps = previousDepth !== undefined && distanceM !== undefined ? Math.max(0, (previousDepth - distanceM) / dt) : 0;
  const lateralOffset = detection.bbox ? (centerX(detection.bbox) - 0.5) * 4 : 0;
  const forward = distanceM ?? 8;

  return {
    id: detection.id ?? `track-${current.frameId}-${index}`,
    type,
    confidence: clamp(detection.confidence, 0, 1),
    bbox: detection.bbox,
    position: { x: lateralOffset, y: 0, z: current.camera === "rear" ? -forward : forward },
    velocity: { x: 0, y: 0, z: current.camera === "rear" ? closingMps : -closingMps },
    distanceM,
    ttcSec: closingMps > 0 && distanceM !== undefined ? clamp(distanceM / closingMps, 0.1, 30) : undefined,
    lastFrameId: current.frameId,
    lastSeenAt: current.capturedAt,
  };
}

function scoreRisk(tracks: TrackState[], frame: FrameObservation): { type: HazardType; severity: number; confidence: number; alert: string; explanation: string } {
  const highest = [...tracks].sort((a, b) => riskForTrack(b, frame) - riskForTrack(a, frame))[0];
  if (!highest) {
    return {
      type: "road_obstruction",
      severity: 18,
      confidence: 0.35,
      alert: "Path clear.",
      explanation: "No tracked road actor exceeded the hazard threshold in this frame.",
    };
  }

  const severity = riskForTrack(highest, frame);
  const vehicle = ["car", "truck", "bus"].includes(highest.type);
  const vulnerable = ["pedestrian", "bike", "scooter"].includes(highest.type);
  const nearCenter = Math.abs(highest.position?.x ?? 0) < 0.9;

  if (vehicle && frame.camera === "rear") {
    return {
      type: "vehicle_approach",
      severity,
      confidence: highest.confidence,
      alert: "Vehicle closing from behind.",
      explanation: `Rear ${highest.type} track is ${formatMeters(highest.distanceM)} away with TTC ${formatSeconds(highest.ttcSec)}.`,
    };
  }

  if (vehicle && !nearCenter) {
    return {
      type: "close_pass",
      severity,
      confidence: highest.confidence,
      alert: "Vehicle passing close.",
      explanation: `${highest.type} track sits in the rider clearance buffer at ${formatMeters(highest.distanceM)}.`,
    };
  }

  if (vulnerable) {
    return {
      type: "pedestrian_conflict",
      severity,
      confidence: highest.confidence,
      alert: "Cross traffic risk ahead.",
      explanation: `${highest.type} track intersects the path with estimated TTC ${formatSeconds(highest.ttcSec)}.`,
    };
  }

  return {
    type: nearCenter ? "road_obstruction" : "blocked_bike_lane",
    severity,
    confidence: highest.confidence,
    alert: "Road hazard ahead.",
    explanation: `${highest.type} track occupies the projected path at ${formatMeters(highest.distanceM)}.`,
  };
}

function riskForTrack(track: TrackState, frame: FrameObservation) {
  const distance = track.distanceM ?? 12;
  const ttc = track.ttcSec ?? 8;
  const speed = frame.speedMps ?? 0;
  const distanceRisk = clamp((12 - distance) * 7, 0, 70);
  const ttcRisk = clamp((4 - ttc) * 18, 0, 80);
  const speedRisk = clamp(speed * 3, 0, 24);
  const typeBonus = ["car", "truck", "bus"].includes(track.type) ? 14 : track.type === "pedestrian" ? 10 : 6;
  return Math.round(clamp(distanceRisk + ttcRisk + speedRisk + typeBonus, 0, 100));
}

function actorTypeFor(label: string): ActorType {
  return actorLabels.find(([regex]) => regex.test(label))?.[1] ?? "obstacle";
}

function estimateDepthFromBbox(bbox: FrameDetection["bbox"], type: ActorType) {
  if (!bbox) return undefined;
  const height = Math.max(0.01, bbox[3] - bbox[1]);
  const referenceHeightM = type === "pedestrian" ? 1.7 : type === "bike" || type === "scooter" ? 1.1 : type === "cone" ? 0.7 : 1.5;
  return clamp((referenceHeightM / height) * 2.2, 1, 80);
}

function centerX(bbox: [number, number, number, number]) {
  return (bbox[0] + bbox[2]) / 2;
}

function secondsSinceEpoch(timestamp: string) {
  const parsed = Date.parse(timestamp);
  return Number.isFinite(parsed) ? Math.round(parsed / 1000) : 0;
}

function formatMeters(value?: number) {
  return value === undefined ? "unknown distance" : `${value.toFixed(1)}m`;
}

function formatSeconds(value?: number) {
  return value === undefined ? "unknown" : `${value.toFixed(1)}s`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
