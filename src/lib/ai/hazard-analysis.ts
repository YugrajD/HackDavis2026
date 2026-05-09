import type { CameraRole, HazardEvent } from "@/lib/contracts";

export type AnalyzeFrameInput = {
  imageBase64?: string;
  lat?: number;
  lng?: number;
  speedMps?: number;
  headingDeg?: number;
  camera?: CameraRole;
};

export type AnalyzeFrameOutput = Pick<
  HazardEvent,
  "type" | "severity" | "confidence" | "spokenAlert" | "explanation" | "objects"
>;

export function analyzeFrameStub(input: AnalyzeFrameInput): AnalyzeFrameOutput {
  if (input.camera === "rear") {
    return {
      type: "vehicle_approach",
      severity: 84,
      confidence: 0.86,
      spokenAlert: "Vehicle closing from behind.",
      explanation: "Rear camera context suggests an approaching vehicle in the rider buffer zone.",
      objects: [
        {
          id: `obj-rear-${Date.now()}`,
          type: "car",
          confidence: 0.86,
          bbox: [0.12, 0.28, 0.48, 0.72],
          position: { x: -1.6, y: 0, z: -5.2 },
          velocity: { x: 0.1, y: 0, z: 7.8 },
          distanceM: 5.2,
          ttcSec: 1.4,
        },
      ],
    };
  }

  if ((input.speedMps ?? 0) > 5.5) {
    return {
      type: "intersection_conflict",
      severity: 79,
      confidence: 0.82,
      spokenAlert: "Cross traffic risk ahead.",
      explanation: "Forward camera and rider speed indicate a possible conflict zone ahead.",
      objects: [],
    };
  }

  return {
    type: "road_obstruction",
    severity: 62,
    confidence: 0.8,
    spokenAlert: "Road hazard ahead.",
    explanation: "Forward camera detected an obstruction or surface anomaly in the rider path.",
    objects: [],
  };
}
