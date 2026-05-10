import type { DangerSegment, HazardEvent, ReplayPayload, RoutePoint } from "@/lib/contracts";

export type MeterPoint = {
  x: number;
  z: number;
};

export type ScreenPoint = MeterPoint & {
  xPct: number;
  yPct: number;
};

export type ProjectedRoutePoint = RoutePoint & {
  meters: MeterPoint;
  screen: ScreenPoint;
};

export type ProjectedHazardEvent = {
  event: HazardEvent;
  meters: MeterPoint;
  screen: ScreenPoint;
};

export type ProjectedDangerSegment = {
  segment: DangerSegment;
  meters: MeterPoint;
  screen: ScreenPoint;
};

export type ProjectedReplay = {
  origin: { lat: number; lng: number };
  route: ProjectedRoutePoint[];
  events: ProjectedHazardEvent[];
  dangerSegments: ProjectedDangerSegment[];
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
};

export function latLngToMeters(lat: number, lng: number, originLat: number, originLng: number): MeterPoint {
  const earthRadiusMeters = 6378137;
  const dLat = ((lat - originLat) * Math.PI) / 180;
  const dLng = ((lng - originLng) * Math.PI) / 180;

  return {
    x: dLng * earthRadiusMeters * Math.cos((originLat * Math.PI) / 180),
    z: -dLat * earthRadiusMeters,
  };
}

export function interpolateRoutePoint(route: RoutePoint[], t: number): RoutePoint | null {
  if (route.length === 0) return null;
  if (route.length === 1 || t <= route[0].t) return route[0];

  const lastPoint = route[route.length - 1];
  if (t >= lastPoint.t) return lastPoint;

  const nextIndex = route.findIndex((point) => point.t >= t);
  if (nextIndex <= 0) return route[0];

  const previous = route[nextIndex - 1];
  const next = route[nextIndex];
  const span = Math.max(next.t - previous.t, 1);
  const ratio = (t - previous.t) / span;

  return {
    t,
    lat: previous.lat + (next.lat - previous.lat) * ratio,
    lng: previous.lng + (next.lng - previous.lng) * ratio,
    speedMps: previous.speedMps + (next.speedMps - previous.speedMps) * ratio,
    headingDeg: previous.headingDeg + (next.headingDeg - previous.headingDeg) * ratio,
  };
}

export function projectReplayPayload(payload: ReplayPayload): ProjectedReplay {
  const origin = payload.ride.route[0]
    ? { lat: payload.ride.route[0].lat, lng: payload.ride.route[0].lng }
    : { lat: payload.ride.startLat, lng: payload.ride.startLng };

  const routeMeters = payload.ride.route.map((point) => ({
    point,
    meters: latLngToMeters(point.lat, point.lng, origin.lat, origin.lng),
  }));
  const eventMeters = payload.events.map((event) => ({
    event,
    meters: latLngToMeters(event.lat, event.lng, origin.lat, origin.lng),
  }));
  const segmentMeters = payload.dangerSegments.map((segment) => ({
    segment,
    meters: latLngToMeters(segment.centerLat, segment.centerLng, origin.lat, origin.lng),
  }));

  const allPoints = [...routeMeters, ...eventMeters, ...segmentMeters].map((item) => item.meters);
  const fallbackPoint = { x: 0, z: 0 };
  const points = allPoints.length > 0 ? allPoints : [fallbackPoint];
  const rawBounds = points.reduce(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      maxX: Math.max(bounds.maxX, point.x),
      minZ: Math.min(bounds.minZ, point.z),
      maxZ: Math.max(bounds.maxZ, point.z),
    }),
    { minX: points[0].x, maxX: points[0].x, minZ: points[0].z, maxZ: points[0].z },
  );

  const width = Math.max(rawBounds.maxX - rawBounds.minX, 12);
  const height = Math.max(rawBounds.maxZ - rawBounds.minZ, 12);
  const padX = width * 0.12;
  const padZ = height * 0.12;
  const bounds = {
    minX: rawBounds.minX - padX,
    maxX: rawBounds.maxX + padX,
    minZ: rawBounds.minZ - padZ,
    maxZ: rawBounds.maxZ + padZ,
  };

  const toScreen = (meters: MeterPoint): ScreenPoint => {
    const boundedWidth = Math.max(bounds.maxX - bounds.minX, 1);
    const boundedHeight = Math.max(bounds.maxZ - bounds.minZ, 1);

    return {
      ...meters,
      xPct: ((meters.x - bounds.minX) / boundedWidth) * 100,
      yPct: ((meters.z - bounds.minZ) / boundedHeight) * 100,
    };
  };

  return {
    origin,
    bounds,
    route: routeMeters.map(({ point, meters }) => ({ ...point, meters, screen: toScreen(meters) })),
    events: eventMeters.map(({ event, meters }) => ({ event, meters, screen: toScreen(meters) })),
    dangerSegments: segmentMeters.map(({ segment, meters }) => ({ segment, meters, screen: toScreen(meters) })),
  };
}
