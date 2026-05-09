import type { CameraRole, HazardType, RideMode } from "@/lib/contracts";

export const hazardTypes = new Set<HazardType>([
  "close_pass",
  "vehicle_approach",
  "pedestrian_conflict",
  "pothole",
  "road_obstruction",
  "blocked_bike_lane",
  "door_zone",
  "hard_brake",
  "intersection_conflict",
]);

export const cameraRoles = new Set<CameraRole>(["front", "rear", "dashcam"]);
export const rideModes = new Set<RideMode>(["bike", "scooter", "car"]);

export function parseEventFilters(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") as HazardType | null;
  const camera = searchParams.get("camera") as CameraRole | null;
  const mode = searchParams.get("mode") as RideMode | null;
  const minSeverityRaw = Number(searchParams.get("minSeverity") ?? 0);

  return {
    rideId: safeIdentifier(searchParams.get("rideId")) ?? undefined,
    type: type && hazardTypes.has(type) ? type : undefined,
    camera: camera && cameraRoles.has(camera) ? camera : undefined,
    mode: mode && rideModes.has(mode) ? mode : undefined,
    minSeverity: Number.isFinite(minSeverityRaw) ? clamp(minSeverityRaw, 0, 100) : 0,
  };
}

export function parseBbox(bbox: string | null) {
  if (!bbox) return null;
  const values = bbox.split(",").map(Number);
  if (values.length !== 4 || values.some((value) => !Number.isFinite(value))) return null;
  const [westLng, southLat, eastLng, northLat] = values;
  if (!isLongitude(westLng) || !isLongitude(eastLng) || !isLatitude(southLat) || !isLatitude(northLat)) return null;
  if (westLng > eastLng || southLat > northLat) return null;
  return { westLng, southLat, eastLng, northLat };
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isLatitude(value: unknown): value is number {
  return isFiniteNumber(value) && value >= -90 && value <= 90;
}

export function isLongitude(value: unknown): value is number {
  return isFiniteNumber(value) && value >= -180 && value <= 180;
}

export function isNonNegativeFinite(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0;
}

export function safeIdentifier(value: unknown, maxLength = 120) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) return undefined;
  return /^[a-zA-Z0-9._:-]+$/.test(trimmed) ? trimmed : undefined;
}

export function safeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
}

export function safeMediaUrl(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 500 || /[\u0000-\u001f]/.test(trimmed)) return undefined;
  if (trimmed.startsWith("/generated/uploads/")) return trimmed;

  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" || url.protocol === "http:" ? trimmed : undefined;
  } catch {
    return undefined;
  }
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
