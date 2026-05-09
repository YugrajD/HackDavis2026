import * as THREE from "three";
import type { HazardEvent, ReplayPayload, RoutePoint } from "../contracts";
import { eventToMeters, latLngToMeters, routePointToMeters } from "./coordinates";

export type PreparedReplay = {
  origin: RoutePoint;
  routeScenePoints: THREE.Vector3[];
  worldCenter: { x: number; z: number };
  routeWidth: number;
  routeDepth: number;
  longestRouteSpan: number;
  minTime: number;
  maxTime: number;
  highestRiskEvent: HazardEvent;
};

type MeterBounds = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export function prepareReplay(payload: ReplayPayload): PreparedReplay {
  const origin = payload.ride.route[0];
  const routeMeters = payload.ride.route.map((point) => routePointToMeters(point, origin));
  const bounds = getMeterBounds(routeMeters);
  const worldCenter = {
    x: (bounds.minX + bounds.maxX) / 2,
    z: (bounds.minZ + bounds.maxZ) / 2
  };
  const routeWidth = Math.max(120, bounds.maxX - bounds.minX);
  const routeDepth = Math.max(90, bounds.maxZ - bounds.minZ);
  const highestRiskEvent = payload.events.reduce((highest, event) =>
    event.severity > highest.severity ? event : highest
  );

  return {
    origin,
    routeScenePoints: routeMeters.map((point) => metersToSceneVector(point, worldCenter, 0.12)),
    worldCenter,
    routeWidth,
    routeDepth,
    longestRouteSpan: Math.max(routeWidth, routeDepth),
    minTime: payload.ride.route[0].t,
    maxTime: payload.ride.route[payload.ride.route.length - 1].t,
    highestRiskEvent
  };
}

export function metersToSceneVector(
  point: { x: number; z: number },
  worldCenter: { x: number; z: number },
  y = 0
): THREE.Vector3 {
  return new THREE.Vector3(point.x - worldCenter.x, y, point.z - worldCenter.z);
}

export function routePointSceneVector(
  point: RoutePoint,
  prepared: PreparedReplay,
  y = 0
): THREE.Vector3 {
  const meters = routePointToMeters(point, prepared.origin);
  return metersToSceneVector(meters, prepared.worldCenter, y);
}

export function eventSceneVector(
  event: HazardEvent,
  prepared: PreparedReplay,
  y = 0
): THREE.Vector3 {
  return metersToSceneVector(eventToMeters(event, prepared.origin), prepared.worldCenter, y);
}

export function latLngSceneVector(
  lat: number,
  lng: number,
  prepared: PreparedReplay,
  y = 0
): THREE.Vector3 {
  return metersToSceneVector(
    latLngToMeters(lat, lng, prepared.origin.lat, prepared.origin.lng),
    prepared.worldCenter,
    y
  );
}

export function getNearestEvent(events: HazardEvent[], t: number): HazardEvent | undefined {
  return events.reduce<HazardEvent | undefined>((nearest, event) => {
    if (!nearest) return event;
    return Math.abs(event.t - t) < Math.abs(nearest.t - t) ? event : nearest;
  }, undefined);
}

export function colorForSeverity(severity: number): string {
  if (severity >= 85) return "#ff4f45";
  if (severity >= 70) return "#ffb238";
  if (severity >= 55) return "#f6d75f";
  return "#55e6ff";
}

export function objectColor(type: string, severity: number): string {
  if (type === "pedestrian") return "#f6d75f";
  if (type === "cone") return "#ff9b2f";
  if (type === "obstacle") return "#ffb238";
  if (type === "car" || type === "truck" || type === "bus") return colorForSeverity(severity);
  return "#7af1ff";
}

function getMeterBounds(points: Array<{ x: number; z: number }>): MeterBounds {
  return points.reduce(
    (acc, point) => ({
      minX: Math.min(acc.minX, point.x),
      maxX: Math.max(acc.maxX, point.x),
      minZ: Math.min(acc.minZ, point.z),
      maxZ: Math.max(acc.maxZ, point.z)
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      minZ: Number.POSITIVE_INFINITY,
      maxZ: Number.NEGATIVE_INFINITY
    }
  );
}
