import { ACTOR_TYPES, CONFIDENCE_MAX, CONFIDENCE_MIN, SEVERITY_MAX, SEVERITY_MIN } from "@/lib/contracts";
import type { ActorType, CameraRole, HazardEvent, HazardType, TrackedObject } from "@/lib/contracts";
import { cameraRoles, clamp, hazardTypes, isFiniteNumber, isLatitude, isLongitude, safeIdentifier, safeMediaUrl, safeText } from "@/lib/api/validation";

const actorTypes = new Set<ActorType>(ACTOR_TYPES);

export function sanitizeHazardEventInput(input: Partial<HazardEvent>): Partial<HazardEvent> {
  const output: Partial<HazardEvent> = {};

  const id = safeIdentifier(input.id);
  const rideId = safeIdentifier(input.rideId);
  const spokenAlert = safeText(input.spokenAlert, 160);
  const explanation = safeText(input.explanation, 800);
  const clipUrl = safeMediaUrl(input.clipUrl);
  const thumbnailUrl = safeMediaUrl(input.thumbnailUrl);

  if (id) output.id = id;
  if (rideId) output.rideId = rideId;
  if (isFiniteNumber(input.t) && input.t >= 0) output.t = input.t;
  if (typeof input.timestamp === "string" && !Number.isNaN(Date.parse(input.timestamp))) output.timestamp = input.timestamp;
  if (isHazardType(input.type)) output.type = input.type;
  if (isFiniteNumber(input.severity)) output.severity = clamp(input.severity, SEVERITY_MIN, SEVERITY_MAX);
  if (isFiniteNumber(input.confidence)) output.confidence = clamp(input.confidence, CONFIDENCE_MIN, CONFIDENCE_MAX);
  if (isLatitude(input.lat)) output.lat = input.lat;
  if (isLongitude(input.lng)) output.lng = input.lng;
  if (isFiniteNumber(input.headingDeg)) output.headingDeg = ((input.headingDeg % 360) + 360) % 360;
  if (isFiniteNumber(input.speedMps) && input.speedMps >= 0) output.speedMps = input.speedMps;
  if (isCameraRole(input.camera)) output.camera = input.camera;
  if (spokenAlert) output.spokenAlert = spokenAlert;
  if (explanation) output.explanation = explanation;
  if (clipUrl) output.clipUrl = clipUrl;
  if (thumbnailUrl) output.thumbnailUrl = thumbnailUrl;
  if (Array.isArray(input.objects)) output.objects = input.objects.slice(0, 25).filter(isTrackedObjectLike).map(sanitizeTrackedObject);

  return output;
}

function isHazardType(value: unknown): value is HazardType {
  return typeof value === "string" && hazardTypes.has(value as HazardType);
}

function isCameraRole(value: unknown): value is CameraRole {
  return typeof value === "string" && cameraRoles.has(value as CameraRole);
}

function isTrackedObjectLike(value: unknown): value is Partial<TrackedObject> {
  return Boolean(value && typeof value === "object" && "type" in value);
}

function isActorType(value: unknown): value is ActorType {
  return typeof value === "string" && actorTypes.has(value as ActorType);
}

function sanitizeTrackedObject(input: Partial<TrackedObject>): TrackedObject {
  return {
    id: safeIdentifier(input.id) ?? `obj-${Date.now()}`,
    type: isActorType(input.type) ? input.type : "obstacle",
    confidence: isFiniteNumber(input.confidence) ? clamp(input.confidence, CONFIDENCE_MIN, CONFIDENCE_MAX) : 0.75,
    bbox: isBbox(input.bbox) ? input.bbox : undefined,
    position: isVector(input.position) ? input.position : undefined,
    velocity: isVector(input.velocity) ? input.velocity : undefined,
    distanceM: isFiniteNumber(input.distanceM) && input.distanceM >= 0 ? input.distanceM : undefined,
    ttcSec: isFiniteNumber(input.ttcSec) && input.ttcSec >= 0 ? input.ttcSec : undefined,
  };
}

function isBbox(value: unknown): value is [number, number, number, number] {
  return Array.isArray(value) && value.length === 4 && value.every((item) => isFiniteNumber(item) && item >= CONFIDENCE_MIN && item <= CONFIDENCE_MAX);
}

function isVector(value: unknown): value is { x: number; y: number; z: number } {
  return Boolean(
    value &&
      typeof value === "object" &&
      isFiniteNumber((value as { x?: unknown }).x) &&
      isFiniteNumber((value as { y?: unknown }).y) &&
      isFiniteNumber((value as { z?: unknown }).z),
  );
}
