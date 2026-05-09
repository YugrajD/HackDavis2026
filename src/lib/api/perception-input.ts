import type { ActorType, CameraRole, HazardEventDraft, HazardType, PerceptionResult, PerceptionRisk, RelativeLocation, TrackState } from "@/lib/contracts";
import { cameraRoles, clamp, hazardTypes, isFiniteNumber, isLatitude, isLongitude, safeIdentifier, safeText } from "@/lib/api/validation";

const actorTypes = new Set<ActorType>(["rider", "car", "truck", "bus", "bike", "scooter", "pedestrian", "cone", "obstacle"]);
const relativeLocations = new Set<RelativeLocation>(["ahead", "behind", "left", "right", "center", "unknown"]);

export function sanitizePerceptionResult(input: unknown): PerceptionResult | undefined {
  if (!isRecord(input)) return undefined;

  const capturedAt = validIsoTime(input.capturedAt) ?? new Date().toISOString();
  const frameId = safeIdentifier(input.frameId, 160) ?? `frame-${Date.parse(capturedAt) || Date.now()}`;
  const tracks = Array.isArray(input.tracks) ? input.tracks.slice(0, 25).map(sanitizeTrack).filter((track): track is TrackState => Boolean(track)) : [];
  const risk = sanitizeRisk(input.risk, tracks);
  const draftInput = isRecord(input.hazardDraft) ? input.hazardDraft : {};
  const camera: CameraRole = typeof draftInput.camera === "string" && cameraRoles.has(draftInput.camera as CameraRole) ? (draftInput.camera as CameraRole) : "front";

  const hazardDraft: HazardEventDraft = {
    rideId: safeIdentifier(draftInput.rideId),
    t: isFiniteNumber(draftInput.t) && draftInput.t >= 0 ? draftInput.t : Math.round(Date.parse(capturedAt) / 1000),
    timestamp: validIsoTime(draftInput.timestamp) ?? validIsoTime(draftInput.capturedAt) ?? capturedAt,
    camera,
    lat: isLatitude(draftInput.lat) ? draftInput.lat : 38.5449,
    lng: isLongitude(draftInput.lng) ? draftInput.lng : -121.7405,
    headingDeg: isFiniteNumber(draftInput.headingDeg) ? ((draftInput.headingDeg % 360) + 360) % 360 : 0,
    speedMps: isFiniteNumber(draftInput.speedMps) && draftInput.speedMps >= 0 ? draftInput.speedMps : 0,
    type: risk.type,
    severity: risk.severity,
    confidence: risk.confidence,
    spokenAlert: risk.spokenAlert,
    explanation: risk.explanation,
    objects: tracks,
  };

  return {
    frameId,
    capturedAt,
    workerVersion: "guardian-road-perception-v1",
    tracks,
    risk,
    hazardDraft,
  };
}

function sanitizeTrack(input: unknown): TrackState | null {
  if (!isRecord(input)) return null;
  const type = actorTypes.has(input.type as ActorType) ? (input.type as ActorType) : "obstacle";
  const confidence = clamp(toNumber(input.confidence, 0.65), 0, 1);
  const id = safeIdentifier(input.id, 160) ?? `track-${type}-${Math.round(confidence * 100)}`;

  return {
    id,
    type,
    label: safeText(input.label, 80),
    description: safeText(input.description, 180),
    relativeLocation: relativeLocations.has(input.relativeLocation as RelativeLocation) ? (input.relativeLocation as RelativeLocation) : "unknown",
    confidence,
    bbox: sanitizeBbox(input.bbox),
    position: sanitizeVector(input.position),
    velocity: sanitizeVector(input.velocity),
    distanceM: isFiniteNumber(input.distanceM) && input.distanceM >= 0 ? input.distanceM : undefined,
    ttcSec: isFiniteNumber(input.ttcSec) && input.ttcSec >= 0 ? input.ttcSec : undefined,
    riskScore: clamp(toNumber(input.riskScore, 0), 0, 100),
    lastFrameId: safeIdentifier(input.lastFrameId, 160) ?? "frame-unknown",
    lastSeenAt: validIsoTime(input.lastSeenAt) ?? new Date().toISOString(),
  };
}

function sanitizeRisk(input: unknown, tracks: TrackState[]): PerceptionRisk {
  const record = isRecord(input) ? input : {};
  const highest = [...tracks].sort((a, b) => b.riskScore - a.riskScore)[0];
  const type = hazardTypes.has(record.type as HazardType) ? (record.type as HazardType) : highest ? "road_obstruction" : "road_obstruction";
  const severity = clamp(toNumber(record.severity, highest?.riskScore ?? 18), 0, 100);
  const confidence = clamp(toNumber(record.confidence, highest?.confidence ?? 0.35), 0, 1);
  const spokenAlert = safeText(record.spokenAlert, 160) ?? (highest ? "Road hazard ahead." : "Path clear.");
  const explanation = safeText(record.explanation, 500) ?? (highest ? `${highest.type} track produced local perception risk.` : "No tracked road actor exceeded the hazard threshold.");
  const primaryObjectId = safeIdentifier(record.primaryObjectId, 160) ?? highest?.id;
  const reasons = Array.isArray(record.reasons) ? record.reasons.map((reason) => safeText(reason, 120)).filter((reason): reason is string => Boolean(reason)).slice(0, 8) : [];

  return { type, severity, confidence, spokenAlert, explanation, primaryObjectId, reasons };
}

function sanitizeBbox(value: unknown): [number, number, number, number] | undefined {
  if (!Array.isArray(value) || value.length !== 4) return undefined;
  const bbox = value.map((item) => clamp(toNumber(item, 0), 0, 1));
  return [bbox[0], bbox[1], bbox[2], bbox[3]];
}

function sanitizeVector(value: unknown): { x: number; y: number; z: number } | undefined {
  if (!isRecord(value)) return undefined;
  if (!isFiniteNumber(value.x) || !isFiniteNumber(value.y) || !isFiniteNumber(value.z)) return undefined;
  return { x: value.x, y: value.y, z: value.z };
}

function validIsoTime(value: unknown) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : undefined;
}

function toNumber(value: unknown, fallback: number) {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
