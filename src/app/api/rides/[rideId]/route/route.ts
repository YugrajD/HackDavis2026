import { NextResponse } from "next/server";
import type { AppendRideRouteResponse, RoutePoint } from "@/lib/contracts";
import { handleApiError, jsonError, readJsonBody } from "@/lib/api/responses";
import { isFiniteNumber, isLatitude, isLongitude, isNonNegativeFinite, safeIdentifier } from "@/lib/api/validation";
import { appendRideRoute, getRide } from "@/lib/db/repository";

const MAX_ROUTE_POINTS = 500;

type RoutePointInput = Partial<RoutePoint>;

export async function POST(request: Request, { params }: { params: Promise<{ rideId: string }> }) {
  try {
    const { rideId: rawRideId } = await params;
    const rideId = safeIdentifier(rawRideId);
    if (!rideId) return jsonError("rideId is invalid.", 400);

    const body = await readJsonBody<unknown>(request, { maxBytes: 256 * 1024 });
    const pointInputs = extractPointInputs(body);

    if (!pointInputs.length) {
      return jsonError("Provide one route point or a non-empty points array.", 400);
    }

    if (pointInputs.length > MAX_ROUTE_POINTS) {
      return jsonError(`Route append cannot exceed ${MAX_ROUTE_POINTS} points.`, 413);
    }

    const points = pointInputs.map(sanitizeRoutePoint);
    const invalidIndex = points.findIndex((point) => point === null);
    if (invalidIndex !== -1) {
      return jsonError(`Route point at index ${invalidIndex} must include non-negative t and speedMps, valid lat/lng, and headingDeg from 0 to 360.`, 400);
    }

    const routePoints = points.filter((point): point is RoutePoint => point !== null);
    const ride = await getRide(rideId);
    if (!ride) {
      return jsonError(`Ride ${rideId} was not found.`, 404);
    }

    const lastRouteTime = ride.route.at(-1)?.t ?? -1;
    const nonMonotonicIndex = findNonMonotonicRoutePointIndex(routePoints, lastRouteTime);
    if (nonMonotonicIndex !== -1) {
      return jsonError(`Route point at index ${nonMonotonicIndex} must have t greater than the previous route point.`, 400);
    }

    const result = await appendRideRoute(rideId, routePoints);
    if (!result) {
      return jsonError(`Ride ${rideId} was not found.`, 404);
    }

    const response = { ride: result.value, appended: routePoints.length, persisted: result.persisted } satisfies AppendRideRouteResponse;
    return NextResponse.json(response);
  } catch (error) {
    return handleApiError(error, "Append ride route failed.");
  }
}

function extractPointInputs(body: unknown): RoutePointInput[] {
  if (Array.isArray(body)) return body.map(coerceRoutePointInput);
  if (!isRecord(body)) return [];
  if (Array.isArray(body.points)) return body.points.map(coerceRoutePointInput);
  if (body.point !== undefined) return [coerceRoutePointInput(body.point)];
  if ("lat" in body || "lng" in body || "t" in body) return [body];
  return [];
}

function sanitizeRoutePoint(point: RoutePointInput): RoutePoint | null {
  if (!isNonNegativeFinite(point.t) || !isLatitude(point.lat) || !isLongitude(point.lng) || !isNonNegativeFinite(point.speedMps)) {
    return null;
  }

  if (!isFiniteNumber(point.headingDeg) || point.headingDeg < 0 || point.headingDeg > 360) {
    return null;
  }

  return {
    t: point.t,
    lat: point.lat,
    lng: point.lng,
    speedMps: point.speedMps,
    headingDeg: point.headingDeg,
  };
}

function coerceRoutePointInput(value: unknown): RoutePointInput {
  return isRecord(value) ? value : {};
}

function findNonMonotonicRoutePointIndex(points: RoutePoint[], previousTime: number) {
  let lastTime = previousTime;
  for (const [index, point] of points.entries()) {
    if (point.t <= lastTime) return index;
    lastTime = point.t;
  }
  return -1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
