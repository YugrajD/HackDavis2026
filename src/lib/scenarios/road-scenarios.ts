import { CAMERA_ROLES, PROVIDER_NAMES, RIDE_MODES, SEVERITY_MAX, SEVERITY_MIN } from "@/lib/contracts";
import type { CameraRole, DangerSegment, HazardEvent, HazardEventDraft, HazardType, ReplayPayload, Ride, RideMode, RoadScenario, ScenarioPrompt, TrackedObject } from "@/lib/contracts";

const baseScenarioTimestampMs = Date.parse("2026-05-09T16:00:00.000Z");
const rideModes = new Set<RideMode>(RIDE_MODES);
const cameraRoles = new Set<CameraRole>(CAMERA_ROLES);

type HazardTemplate = {
  match: RegExp;
  type: HazardType;
  title: string;
  alert: string;
  object: TrackedObject;
};

const hazardLexicon: HazardTemplate[] = [
  {
    match: /close|pass|overtak|vehicle approach/i,
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
    match: /blocked|bike lane|loading|service vehicle/i,
    type: "blocked_bike_lane",
    title: "Blocked bike-lane hazard",
    alert: "Bike lane blocked ahead.",
    object: { id: "scenario-blocker", type: "truck", confidence: 0.82, position: { x: 1.6, y: 0, z: 8.4 }, distanceM: 8.4, ttcSec: 2.1 },
  },
  {
    match: /pothole|surface|pavement/i,
    type: "pothole",
    title: "Pavement defect hazard",
    alert: "Road damage ahead.",
    object: { id: "scenario-pothole", type: "obstacle", confidence: 0.8, position: { x: 0.1, y: -0.05, z: 5.1 }, distanceM: 5.1, ttcSec: 1.5 },
  },
  {
    match: /debris|cone|obstruction|object/i,
    type: "road_obstruction",
    title: "Road obstruction hazard",
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

export const scenarioPresets = [
  "rear camera close pass on Russell Boulevard",
  "blocked bike lane with cones near campus",
  "pedestrian crosswalk conflict at a Davis intersection",
  "parked car door zone on a narrow street",
] as const;

export function generateRoadScenario(input: ScenarioPrompt = {}): RoadScenario {
  const prompt = normalizePrompt(input.prompt);
  const seed = normalizeSeed(input.seed, prompt);
  const picked = hazardLexicon.find((item) => item.match.test(prompt)) ?? hazardLexicon[seed % hazardLexicon.length];
  const severity = clamp(62 + (seed % 31), SEVERITY_MIN, SEVERITY_MAX);
  const mode = normalizeMode(input.mode, prompt);
  const camera = normalizeCamera(input.camera, prompt, mode);
  const origin = {
    lat: finiteOr(input.lat, 38.5449 + ((seed % 17) - 8) * 0.00008),
    lng: finiteOr(input.lng, -121.7405 + ((seed % 13) - 6) * 0.00008),
  };
  const generatedAt = deterministicTimestamp(seed, 0);
  const route = buildScenarioRoute(origin, mode, seed);
  const peakLatLng = route[2] ?? route[0];

  return {
    id: `scenario-${slugify(picked.type)}-${seed.toString(36)}`,
    title: picked.title,
    prompt,
    seed,
    mode,
    camera,
    origin,
    route,
    timeline: [
      {
        t: 0,
        timestamp: deterministicTimestamp(seed, 0),
        type: picked.type,
        severity: Math.max(35, severity - 22),
        confidence: 0.58,
        lat: route[0].lat,
        lng: route[0].lng,
        spokenAlert: "Monitor traffic ahead.",
        explanation: `Early cue from scenario prompt: ${prompt}`,
        headingDeg: route[0].headingDeg,
        speedMps: route[0].speedMps,
        objects: [],
      },
      {
        t: 3.2,
        timestamp: deterministicTimestamp(seed, 3.2),
        type: picked.type,
        severity,
        confidence: 0.82,
        lat: peakLatLng.lat,
        lng: peakLatLng.lng,
        spokenAlert: picked.alert,
        explanation: `${picked.title} generated from prompt evidence for demo replay and perception testing.`,
        headingDeg: peakLatLng.headingDeg,
        speedMps: peakLatLng.speedMps,
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
    generatedAt,
  };
}

export function scenarioToHazardDraft(scenario: RoadScenario): HazardEventDraft & { rideId: string } {
  const peak = peakTimelineItem(scenario);
  return {
    rideId: scenario.id,
    t: peak.t,
    timestamp: peak.timestamp,
    type: peak.type,
    severity: peak.severity,
    confidence: peak.confidence,
    lat: peak.lat,
    lng: peak.lng,
    headingDeg: peak.headingDeg,
    speedMps: peak.speedMps,
    camera: scenario.camera,
    spokenAlert: peak.spokenAlert,
    explanation: peak.explanation,
    objects: peak.objects,
  };
}

export function scenarioToReplayPayload(scenario: RoadScenario): ReplayPayload {
  const event = scenarioToHazardEvent(scenario);
  return {
    ride: scenarioToRide(scenario),
    events: [event],
    dangerSegments: [scenarioToDangerSegment(scenario, event)],
    generatedAt: scenario.generatedAt,
  };
}

export function generateScenarioResponse(input: ScenarioPrompt = {}) {
  const scenario = generateRoadScenario(input);
  return {
    scenario,
    hazardDraft: scenarioToHazardDraft(scenario),
    replayPayload: scenarioToReplayPayload(scenario),
    provider: PROVIDER_NAMES.deterministicScenarioLab,
  };
}

function scenarioToHazardEvent(scenario: RoadScenario): HazardEvent {
  const draft = scenarioToHazardDraft(scenario);
  return {
    id: `evt-${scenario.id}`,
    ...draft,
  };
}

function scenarioToRide(scenario: RoadScenario): Ride {
  const peak = peakTimelineItem(scenario);
  return {
    id: scenario.id,
    mode: scenario.mode,
    startedAt: scenario.generatedAt,
    endedAt: deterministicTimestamp(scenario.seed, 8),
    startLat: scenario.origin.lat,
    startLng: scenario.origin.lng,
    route: scenario.route,
    stats: {
      durationSec: scenario.route.at(-1)?.t ?? 8,
      distanceMeters: Math.round(36 + (scenario.seed % 34)),
      maxRisk: peak.severity,
      eventCount: 1,
    },
  };
}

function scenarioToDangerSegment(scenario: RoadScenario, event: HazardEvent): DangerSegment {
  return {
    id: `seg-${scenario.id}`,
    label: `${scenario.title} hotspot`,
    centerLat: event.lat,
    centerLng: event.lng,
    score: event.severity,
    eventCount: 1,
    topTypes: [event.type],
    lastSeen: event.timestamp,
    explanation: `Scenario lab hotspot produced from prompt: ${scenario.prompt}`,
  };
}

function peakTimelineItem(scenario: RoadScenario) {
  return scenario.timeline.reduce((max, item) => (item.severity > max.severity ? item : max), scenario.timeline[0]);
}

function buildScenarioRoute(origin: { lat: number; lng: number }, mode: RideMode, seed: number) {
  const speed = mode === "car" ? 8.4 : mode === "scooter" ? 4.6 : 5.2;
  const heading = 82 + (seed % 18);
  const latStep = (((seed % 5) - 2) * 0.000005) + 0.00001;
  const lngStep = 0.000095 + (seed % 7) * 0.000004;

  return [0, 1.6, 3.2, 5.4, 8].map((t, index) => ({
    t,
    lat: roundCoord(origin.lat + latStep * index),
    lng: roundCoord(origin.lng + lngStep * index),
    speedMps: index === 0 ? Math.max(0, speed - 0.7) : speed,
    headingDeg: heading + index * 2,
  }));
}

function normalizePrompt(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 240) : "bike lane obstruction near campus";
}

function normalizeMode(value: unknown, prompt: string): RideMode {
  if (typeof value === "string" && rideModes.has(value as RideMode)) return value as RideMode;
  if (prompt.match(/scooter/i)) return "scooter";
  return prompt.match(/car|dashcam|driver/i) ? "car" : "bike";
}

function normalizeCamera(value: unknown, prompt: string, mode: RideMode): CameraRole {
  if (typeof value === "string" && cameraRoles.has(value as CameraRole)) return value as CameraRole;
  return prompt.match(/behind|rear/i) ? "rear" : mode === "car" ? "dashcam" : "front";
}

function normalizeSeed(value: unknown, prompt: string) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.abs(Math.trunc(value)) >>> 0;
  return hashString(prompt);
}

function deterministicTimestamp(seed: number, t: number) {
  return new Date(baseScenarioTimestampMs + (seed % 86_400) * 1000 + Math.round(t * 1000)).toISOString();
}

function finiteOr(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  return hash;
}

function slugify(value: string) {
  return value.replace(/_/g, "-").toLowerCase();
}

function roundCoord(value: number) {
  return Number(value.toFixed(6));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
