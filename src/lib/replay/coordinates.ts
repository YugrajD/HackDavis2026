import type { HazardEvent, RoutePoint } from "../contracts";

export type MeterPoint = {
  x: number;
  z: number;
};

export function latLngToMeters(
  lat: number,
  lng: number,
  originLat: number,
  originLng: number
): MeterPoint {
  const radius = 6378137;
  const dLat = ((lat - originLat) * Math.PI) / 180;
  const dLng = ((lng - originLng) * Math.PI) / 180;

  return {
    x: dLng * radius * Math.cos((originLat * Math.PI) / 180),
    z: -dLat * radius
  };
}

export function routePointToMeters(point: RoutePoint, origin: RoutePoint): MeterPoint {
  return latLngToMeters(point.lat, point.lng, origin.lat, origin.lng);
}

export function eventToMeters(event: HazardEvent, origin: RoutePoint): MeterPoint {
  return latLngToMeters(event.lat, event.lng, origin.lat, origin.lng);
}

export function headingToForward(headingDeg: number): MeterPoint {
  const radians = (headingDeg * Math.PI) / 180;

  return {
    x: Math.sin(radians),
    z: -Math.cos(radians)
  };
}

export function headingToRotationY(headingDeg: number): number {
  const forward = headingToForward(headingDeg);
  return Math.atan2(forward.x, forward.z);
}
