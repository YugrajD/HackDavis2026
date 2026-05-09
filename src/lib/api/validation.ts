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
    rideId: searchParams.get("rideId") ?? undefined,
    type: type && hazardTypes.has(type) ? type : undefined,
    camera: camera && cameraRoles.has(camera) ? camera : undefined,
    mode: mode && rideModes.has(mode) ? mode : undefined,
    minSeverity: Number.isFinite(minSeverityRaw) ? minSeverityRaw : 0,
  };
}

export function parseBbox(bbox: string | null) {
  if (!bbox) return null;
  const values = bbox.split(",").map(Number);
  if (values.length !== 4 || values.some((value) => !Number.isFinite(value))) return null;
  const [westLng, southLat, eastLng, northLat] = values;
  return { westLng, southLat, eastLng, northLat };
}
