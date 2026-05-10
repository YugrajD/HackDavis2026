import type { RoutePoint } from "../contracts";

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}

function lerpHeading(startDeg: number, endDeg: number, amount: number): number {
  const delta = ((((endDeg - startDeg) % 360) + 540) % 360) - 180;
  return (startDeg + delta * amount + 360) % 360;
}

export function clampTime(route: RoutePoint[], t: number): number {
  if (route.length === 0) return 0;
  return Math.min(Math.max(t, route[0].t), route[route.length - 1].t);
}

export function interpolateRoutePoint(route: RoutePoint[], t: number): RoutePoint {
  if (route.length === 0) {
    throw new Error("Cannot interpolate an empty route.");
  }

  const safeTime = clampTime(route, t);

  if (safeTime <= route[0].t) return route[0];
  if (safeTime >= route[route.length - 1].t) return route[route.length - 1];

  const nextIndex = route.findIndex((point) => point.t >= safeTime);
  const previous = route[nextIndex - 1];
  const next = route[nextIndex];
  const amount = (safeTime - previous.t) / (next.t - previous.t);

  return {
    t: safeTime,
    lat: lerp(previous.lat, next.lat, amount),
    lng: lerp(previous.lng, next.lng, amount),
    speedMps: lerp(previous.speedMps, next.speedMps, amount),
    headingDeg: lerpHeading(previous.headingDeg, next.headingDeg, amount)
  };
}

export function formatReplayTime(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}
