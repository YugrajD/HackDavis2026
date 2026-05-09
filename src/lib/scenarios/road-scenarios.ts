import type { CameraRole, HazardEvent, HazardType, RideMode, TrackedObject } from "@/lib/contracts";

export type ScenarioPrompt = {
  prompt: string;
  mode?: RideMode;
  camera?: CameraRole;
  lat?: number;
  lng?: number;
  seed?: number;
};

export type RoadScenario = {
  id: string;
  title: string;
  prompt: string;
  mode: RideMode;
  camera: CameraRole;
  origin: { lat: number; lng: number };
  timeline: Array<Pick<HazardEvent, "t" | "type" | "severity" | "confidence" | "spokenAlert" | "explanation" | "headingDeg" | "speedMps" | "objects">>;
  reconstructionHints: {
    splatPrompt: string;
    cameraPath: Array<{ t: number; x: number; y: number; z: number; yawDeg: number }>;
    riskZones: Array<{ t: number; radiusM: number; color: "amber" | "red" }>;
  };
};

const hazardLexicon: Array<{ match: RegExp; type: HazardType; title: string; alert: string; object: TrackedObject }> = [
  {
    match: /close|pass|overtak|car|truck|bus/i,
    type: "close_pass",
    title: "Close pass reconstruction",
    alert: "Vehicle passing close.",
    object: { id: "scenario-car", type: "car", confidence: 0.88, position: { x: -1.2, y: 0, z: -3.5 }, velocity: { x: 0.2, y: 0, z: 6.4 }, distanceM: 3.7, ttcSec: 1.1 },
  },
  {
    match: /door|parked/i,
    type: "door_zone",
    title: "Door-zone conflict",
    alert: "Door zone ahead.",
    object: { id: "scenario-door", type: "obstacle", confidence: 0.76, position: { x: 1.1, y: 0, z: 2.4 }, distanceM: 2.6, ttcSec: 1.7 },
  },
  {
    match: /pedestrian|crosswalk|walk/i,
    type: "pedestrian_conflict",
    title: "Crosswalk conflict",
    alert: "Pedestrian conflict ahead.",
    object: { id: "scenario-ped", type: "pedestrian", confidence: 0.84, position: { x: 0.8, y: 0, z: 5.2 }, velocity: { x: -0.8, y: 0, z: 0.2 }, distanceM: 5.3, ttcSec: 2.2 },
  },
  {
    match: /pothole|debris|cone|blocked|obstruction|surface/i,
    type: "road_obstruction",
    title: "Blocked lane hazard",
    alert: "Road hazard ahead.",
    object: { id: "scenario-obstacle", type: "obstacle", confidence: 0.82, position: { x: 0.2, y: 0, z: 4.1 }, distanceM: 4.1, ttcSec: 1.9 },
  },
  {
    match: /intersection|turn|left|right|conflict/i,
    type: "intersection_conflict",
    title: "Intersection conflict",
    alert: "Cross traffic risk.",
    object: { id: "scenario-cross-car", type: "car", confidence: 0.8, position: { x: -4.8, y: 0, z: 6.2 }, velocity: { x: 5.1, y: 0, z: 0 }, distanceM: 7.8, ttcSec: 1.6 },
  },
];

export function generateRoadScenario(input: ScenarioPrompt): RoadScenario {
  const prompt = input.prompt.trim() || "bike lane obstruction near campus";
  const seed = input.seed ?? hashString(prompt);
  const picked = hazardLexicon.find((item) => item.match.test(prompt)) ?? hazardLexicon[seed % hazardLexicon.length];
  const severity = clamp(62 + (seed % 31), 0, 100);
  const mode = input.mode ?? (prompt.match(/car|dashcam|driver/i) ? "car" : "bike");
  const camera = input.camera ?? (prompt.match(/behind|rear/i) ? "rear" : mode === "car" ? "dashcam" : "front");
  const origin = { lat: input.lat ?? 38.5449 + ((seed % 17) - 8) * 0.00008, lng: input.lng ?? -121.7405 + ((seed % 13) - 6) * 0.00008 };

  return {
    id: `scenario-${slugify(picked.type)}-${seed.toString(36)}`,
    title: picked.title,
    prompt,
    mode,
    camera,
    origin,
    timeline: [
      {
        t: 0,
        type: picked.type,
        severity: Math.max(35, severity - 22),
        confidence: 0.58,
        spokenAlert: "Monitor traffic ahead.",
        explanation: `Early cue from scenario prompt: ${prompt}`,
        headingDeg: 92,
        speedMps: mode === "car" ? 8.8 : 5.2,
        objects: [],
      },
      {
        t: 3.2,
        type: picked.type,
        severity,
        confidence: 0.82,
        spokenAlert: picked.alert,
        explanation: `${picked.title} generated from prompt evidence for demo replay and perception testing.`,
        headingDeg: 96,
        speedMps: mode === "car" ? 8.1 : 4.8,
        objects: [picked.object],
      },
    ],
    reconstructionHints: {
      splatPrompt: `Davis CA street scene, ${prompt}, clear lane geometry, safety reconstruction evidence, no people identifiable`,
      cameraPath: [
        { t: 0, x: 0, y: 1.6, z: -6, yawDeg: 0 },
        { t: 1.6, x: 0.2, y: 1.55, z: -2.5, yawDeg: 3 },
        { t: 3.2, x: 0.4, y: 1.5, z: 1.5, yawDeg: 8 },
      ],
      riskZones: [
        { t: 1.6, radiusM: 4, color: severity >= 76 ? "red" : "amber" },
        { t: 3.2, radiusM: 7, color: severity >= 76 ? "red" : "amber" },
      ],
    },
  };
}

export function scenarioToHazardDraft(scenario: RoadScenario): Partial<HazardEvent> {
  const peak = scenario.timeline.reduce((max, item) => (item.severity > max.severity ? item : max), scenario.timeline[0]);
  return {
    rideId: scenario.id,
    t: peak.t,
    timestamp: new Date().toISOString(),
    type: peak.type,
    severity: peak.severity,
    confidence: peak.confidence,
    lat: scenario.origin.lat,
    lng: scenario.origin.lng,
    headingDeg: peak.headingDeg,
    speedMps: peak.speedMps,
    camera: scenario.camera,
    spokenAlert: peak.spokenAlert,
    explanation: peak.explanation,
    objects: peak.objects,
  };
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  return hash;
}

function slugify(value: string) {
  return value.replace(/_/g, "-").toLowerCase();
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
