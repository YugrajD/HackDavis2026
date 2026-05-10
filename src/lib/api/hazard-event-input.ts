import { ACTOR_TYPES, CONFIDENCE_MAX, CONFIDENCE_MIN, SEVERITY_MAX, SEVERITY_MIN } from "@/lib/contracts";
import type { ActorType, CameraRole, HazardEvent, HazardType, TrackedObject } from "@/lib/contracts";
import { cameraRoles, clamp, hazardTypes, isFiniteNumber, isLatitude, isLongitude, isRecord, safeIdentifier, safeMediaUrl, safeText } from "@/lib/api/validation";

const actorTypes = new Set<ActorType>(ACTOR_TYPES);

export function sanitizeHazardEventInput(input: unknown): Partial<HazardEvent> {
  const source = isRecord(input) ? (input as Partial<HazardEvent>) : {};
  const output: Partial<HazardEvent> = {};

  const id = safeIdentifier(source.id);
  const rideId = safeIdentifier(source.rideId);
  const spokenAlert = safeText(source.spokenAlert, 160);
  const explanation = safeText(source.explanation, 800);
  const clipUrl = safeMediaUrl(source.clipUrl);
  const thumbnailUrl = safeMediaUrl(source.thumbnailUrl);

  if (id) output.id = id;
  if (rideId) output.rideId = rideId;
  if (isFiniteNumber(source.t) && source.t >= 0) output.t = source.t;
  if (typeof source.timestamp === "string" && !Number.isNaN(Date.parse(source.timestamp))) output.timestamp = source.timestamp;
  if (isHazardType(source.type)) output.type = source.type;
  if (isFiniteNumber(source.severity)) output.severity = clamp(source.severity, SEVERITY_MIN, SEVERITY_MAX);
  if (isFiniteNumber(source.confidence)) output.confidence = clamp(source.confidence, CONFIDENCE_MIN, CONFIDENCE_MAX);
  if (isLatitude(source.lat)) output.lat = source.lat;
  if (isLongitude(source.lng)) output.lng = source.lng;
  if (isFiniteNumber(source.headingDeg)) output.headingDeg = ((source.headingDeg % 360) + 360) % 360;
  if (isFiniteNumber(source.speedMps) && source.speedMps >= 0) output.speedMps = source.speedMps;
  if (isCameraRole(source.camera)) output.camera = source.camera;
  if (spokenAlert) output.spokenAlert = spokenAlert;
  if (explanation) output.explanation = explanation;
  if (clipUrl) output.clipUrl = clipUrl;
  if (thumbnailUrl) output.thumbnailUrl = thumbnailUrl;
  if (Array.isArray(source.objects)) output.objects = source.objects.slice(0, 25).filter(isTrackedObjectLike).map(sanitizeTrackedObject);

  return output;
}

export function hasHazardEventInputFields(input: Partial<HazardEvent>) {
  return Object.keys(input).length > 0;
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
