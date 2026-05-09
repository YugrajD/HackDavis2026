import type { ActorType, CameraRole, HazardEvent, HazardType, TrackedObject } from "@/lib/contracts";
import { cameraRoles, hazardTypes } from "@/lib/api/validation";

const actorTypes = new Set<ActorType>(["rider", "car", "truck", "bus", "bike", "scooter", "pedestrian", "cone", "obstacle"]);

export function sanitizeHazardEventInput(input: Partial<HazardEvent>): Partial<HazardEvent> {
  const output: Partial<HazardEvent> = {};

  if (typeof input.id === "string") output.id = input.id;
  if (typeof input.rideId === "string") output.rideId = input.rideId;
  if (isFiniteNumber(input.t)) output.t = input.t;
  if (typeof input.timestamp === "string") output.timestamp = input.timestamp;
  if (isHazardType(input.type)) output.type = input.type;
  if (isFiniteNumber(input.severity)) output.severity = input.severity;
  if (isFiniteNumber(input.confidence)) output.confidence = input.confidence;
  if (isFiniteNumber(input.lat)) output.lat = input.lat;
  if (isFiniteNumber(input.lng)) output.lng = input.lng;
  if (isFiniteNumber(input.headingDeg)) output.headingDeg = input.headingDeg;
  if (isFiniteNumber(input.speedMps)) output.speedMps = input.speedMps;
  if (isCameraRole(input.camera)) output.camera = input.camera;
  if (typeof input.spokenAlert === "string") output.spokenAlert = input.spokenAlert;
  if (typeof input.explanation === "string") output.explanation = input.explanation;
  if (typeof input.clipUrl === "string") output.clipUrl = input.clipUrl;
  if (typeof input.thumbnailUrl === "string") output.thumbnailUrl = input.thumbnailUrl;
  if (Array.isArray(input.objects)) output.objects = input.objects.filter(isTrackedObjectLike).map(sanitizeTrackedObject);

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
    id: typeof input.id === "string" ? input.id : `obj-${Date.now()}`,
    type: isActorType(input.type) ? input.type : "obstacle",
    confidence: isFiniteNumber(input.confidence) ? clamp(input.confidence, 0, 1) : 0.75,
    bbox: isBbox(input.bbox) ? input.bbox : undefined,
    position: isVector(input.position) ? input.position : undefined,
    velocity: isVector(input.velocity) ? input.velocity : undefined,
    distanceM: isFiniteNumber(input.distanceM) ? input.distanceM : undefined,
    ttcSec: isFiniteNumber(input.ttcSec) ? input.ttcSec : undefined,
  };
}

function isBbox(value: unknown): value is [number, number, number, number] {
  return Array.isArray(value) && value.length === 4 && value.every(isFiniteNumber);
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

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
