import { ACTOR_TYPES, CAMERA_ROLES, CONFIDENCE_MAX, CONFIDENCE_MIN, HAZARD_TYPES, SEVERITY_MAX, SEVERITY_MIN } from "@/lib/contracts";
import type { ActorType, CameraRole, DangerSegment, HazardEvent, HazardType, TrackedObject } from "@/lib/contracts";
import { ApiError } from "@/lib/api/responses";
import { isFiniteNumber, isLatitude, isLongitude, isNonNegativeFinite, isRecord, safeIdentifier, safeText } from "@/lib/api/validation";

const actorTypes = new Set<ActorType>(ACTOR_TYPES);
const cameraRoles = new Set<CameraRole>(CAMERA_ROLES);
const hazardTypes = new Set<HazardType>(HAZARD_TYPES);

export function validateCallerSegment(value: unknown): DangerSegment | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) throw new ApiError(400, "segment must be a danger segment object.");

  const id = safeIdentifier(value.id);
  const label = safeText(value.label, 160);
  const explanation = safeText(value.explanation, 1000);

  if (!id) throw new ApiError(400, "segment.id must be a valid identifier.");
  if (!label) throw new ApiError(400, "segment.label must be a non-empty string.");
  if (!isLatitude(value.centerLat) || !isLongitude(value.centerLng)) throw new ApiError(400, "segment.centerLat and segment.centerLng must be valid coordinates.");
  if (!isScore(value.score)) throw new ApiError(400, "segment.score must be a number from 0 to 100.");
  if (!isNonNegativeInteger(value.eventCount)) throw new ApiError(400, "segment.eventCount must be a non-negative integer.");
  if (!Array.isArray(value.topTypes) || !value.topTypes.length || !value.topTypes.every(isHazardType)) {
    throw new ApiError(400, "segment.topTypes must be a non-empty array of hazard types.");
  }
  if (typeof value.lastSeen !== "string" || Number.isNaN(Date.parse(value.lastSeen))) throw new ApiError(400, "segment.lastSeen must be an ISO timestamp.");
  if (!explanation) throw new ApiError(400, "segment.explanation must be a non-empty string.");

  return {
    id,
    label,
    centerLat: value.centerLat,
    centerLng: value.centerLng,
    score: value.score,
    eventCount: value.eventCount,
    topTypes: value.topTypes,
    lastSeen: value.lastSeen,
    explanation,
  };
}

export function validateCallerEvents(value: unknown): HazardEvent[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new ApiError(400, "events must be an array of hazard events.");
  return value.slice(0, 100).map((event, index) => validateCallerEvent(event, index));
}

function validateCallerEvent(value: unknown, index: number): HazardEvent {
  if (!isRecord(value)) throw new ApiError(400, `events[${index}] must be a hazard event object.`);

  const id = safeIdentifier(value.id);
  const rideId = safeIdentifier(value.rideId);
  const spokenAlert = safeText(value.spokenAlert, 160);
  const explanation = safeText(value.explanation, 1000);

  if (!id) throw new ApiError(400, `events[${index}].id must be a valid identifier.`);
  if (!rideId) throw new ApiError(400, `events[${index}].rideId must be a valid identifier.`);
  if (!isNonNegativeFinite(value.t)) throw new ApiError(400, `events[${index}].t must be non-negative.`);
  if (typeof value.timestamp !== "string" || Number.isNaN(Date.parse(value.timestamp))) throw new ApiError(400, `events[${index}].timestamp must be an ISO timestamp.`);
  if (!isHazardType(value.type)) throw new ApiError(400, `events[${index}].type must be a valid hazard type.`);
  if (!isScore(value.severity)) throw new ApiError(400, `events[${index}].severity must be a number from 0 to 100.`);
  if (!isConfidence(value.confidence)) throw new ApiError(400, `events[${index}].confidence must be a number from 0 to 1.`);
  if (!isLatitude(value.lat) || !isLongitude(value.lng)) throw new ApiError(400, `events[${index}].lat and events[${index}].lng must be valid coordinates.`);
  if (!isFiniteNumber(value.headingDeg)) throw new ApiError(400, `events[${index}].headingDeg must be a number.`);
  if (!isNonNegativeFinite(value.speedMps)) throw new ApiError(400, `events[${index}].speedMps must be non-negative.`);
  if (!isCameraRole(value.camera)) throw new ApiError(400, `events[${index}].camera must be a valid camera role.`);
  if (!spokenAlert) throw new ApiError(400, `events[${index}].spokenAlert must be a non-empty string.`);
  if (!explanation) throw new ApiError(400, `events[${index}].explanation must be a non-empty string.`);
  if (!Array.isArray(value.objects)) throw new ApiError(400, `events[${index}].objects must be an array.`);

  return {
    id,
    rideId,
    t: value.t,
    timestamp: value.timestamp,
    type: value.type,
    severity: value.severity,
    confidence: value.confidence,
    lat: value.lat,
    lng: value.lng,
    headingDeg: value.headingDeg,
    speedMps: value.speedMps,
    camera: value.camera,
    spokenAlert,
    explanation,
    clipUrl: typeof value.clipUrl === "string" ? value.clipUrl : undefined,
    thumbnailUrl: typeof value.thumbnailUrl === "string" ? value.thumbnailUrl : undefined,
    objects: value.objects.map((object, objectIndex) => validateTrackedObject(object, index, objectIndex)),
  };
}

function validateTrackedObject(value: unknown, eventIndex: number, objectIndex: number): TrackedObject {
  if (!isRecord(value)) throw new ApiError(400, `events[${eventIndex}].objects[${objectIndex}] must be an object.`);

  const id = safeIdentifier(value.id);
  if (!id) throw new ApiError(400, `events[${eventIndex}].objects[${objectIndex}].id must be a valid identifier.`);
  if (!isActorType(value.type)) throw new ApiError(400, `events[${eventIndex}].objects[${objectIndex}].type must be a valid actor type.`);
  if (!isConfidence(value.confidence)) throw new ApiError(400, `events[${eventIndex}].objects[${objectIndex}].confidence must be a number from 0 to 1.`);

  return {
    id,
    type: value.type,
    confidence: value.confidence,
    bbox: isBbox(value.bbox) ? value.bbox : undefined,
    position: isVector(value.position) ? value.position : undefined,
    velocity: isVector(value.velocity) ? value.velocity : undefined,
    distanceM: isNonNegativeFinite(value.distanceM) ? value.distanceM : undefined,
    ttcSec: isNonNegativeFinite(value.ttcSec) ? value.ttcSec : undefined,
  };
}

function isHazardType(value: unknown): value is HazardType {
  return typeof value === "string" && hazardTypes.has(value as HazardType);
}

function isCameraRole(value: unknown): value is CameraRole {
  return typeof value === "string" && cameraRoles.has(value as CameraRole);
}

function isActorType(value: unknown): value is ActorType {
  return typeof value === "string" && actorTypes.has(value as ActorType);
}

function isScore(value: unknown): value is number {
  return isFiniteNumber(value) && value >= SEVERITY_MIN && value <= SEVERITY_MAX;
}

function isConfidence(value: unknown): value is number {
  return isFiniteNumber(value) && value >= CONFIDENCE_MIN && value <= CONFIDENCE_MAX;
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

function isBbox(value: unknown): value is [number, number, number, number] {
  return Array.isArray(value) && value.length === 4 && value.every(isFiniteNumber);
}

function isVector(value: unknown): value is { x: number; y: number; z: number } {
  return isRecord(value) && isFiniteNumber(value.x) && isFiniteNumber(value.y) && isFiniteNumber(value.z);
}
