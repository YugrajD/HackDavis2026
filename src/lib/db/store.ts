import { randomUUID } from "node:crypto";
import { CONFIDENCE_MAX, CONFIDENCE_MIN, SEVERITY_MAX, SEVERITY_MIN } from "@/lib/contracts";
import type { CameraRole, DangerSegment, HazardEvent, HazardType, ReplayPayload, Ride, RideMode, RoutePoint } from "@/lib/contracts";
import { sortEvents, sortEventsNewestFirst, type EventSortOrder } from "@/lib/db/event-ordering";
import { computeDangerSegments, haversineMeters, sortDangerSegments } from "@/lib/geo/danger-segments";
import { demoDangerSegments, demoEvents, demoRide } from "@/lib/seed/demo-data";

export type EventFilters = {
  rideId?: string;
  type?: HazardType;
  camera?: CameraRole;
  mode?: RideMode;
  minSeverity?: number;
};

export type CreateRideInput = {
  mode: RideMode;
  startLat: number;
  startLng: number;
};

export type EventStats = {
  count: number;
  maxSeverity: number;
};

type StoreState = {
  rides: Ride[];
  events: HazardEvent[];
  dangerSegments: DangerSegment[];
};

type ListEventsOptions = {
  order?: EventSortOrder;
};

declare global {
  // eslint-disable-next-line no-var
  var guardianRoadStore: StoreState | undefined;
}

function initialState(): StoreState {
  return {
    rides: cloneValue([demoRide]),
    events: cloneValue(demoEvents),
    dangerSegments: cloneValue(demoDangerSegments),
  };
}

function state(): StoreState {
  if (!globalThis.guardianRoadStore) {
    globalThis.guardianRoadStore = initialState();
  }
  return globalThis.guardianRoadStore;
}

export function resetDemoData() {
  globalThis.guardianRoadStore = initialState();
  return {
    rideId: demoRide.id,
    eventCount: demoEvents.length,
    segmentCount: demoDangerSegments.length,
  };
}

export function listRides() {
  return state().rides;
}

export function getRide(rideId: string) {
  return state().rides.find((ride) => ride.id === rideId) ?? null;
}

export function buildRide(input: CreateRideInput) {
  return {
    id: `ride-${randomUUID()}`,
    mode: input.mode,
    startedAt: new Date().toISOString(),
    startLat: input.startLat,
    startLng: input.startLng,
    route: [
      {
        t: 0,
        lat: input.startLat,
        lng: input.startLng,
        speedMps: 0,
        headingDeg: 0,
      },
    ],
    stats: {
      durationSec: 0,
      distanceMeters: 0,
      maxRisk: 0,
      eventCount: 0,
    },
  } satisfies Ride;
}

export function createRide(input: CreateRideInput) {
  const ride = buildRide(input);
  state().rides.unshift(ride);
  return ride;
}

export function endRide(rideId: string) {
  const ride = getRide(rideId);
  if (!ride) return null;

  ride.endedAt = new Date().toISOString();
  ride.stats = calculateRideStatsFromEventStats(ride.route, eventStatsForRide(rideId));

  return ride;
}

export function appendRideRoute(rideId: string, points: RoutePoint[]) {
  const ride = getRide(rideId);
  if (!ride) return null;

  ride.route.push(...points);
  ride.stats = calculateRideStatsFromEventStats(ride.route, eventStatsForRide(rideId));

  return ride;
}

export function listEvents(filters: EventFilters = {}, options: ListEventsOptions = {}) {
  const minSeverity = filters.minSeverity ?? 0;
  const modeRideIds = filters.mode ? new Set(state().rides.filter((ride) => ride.mode === filters.mode).map((ride) => ride.id)) : null;
  const events = state().events.filter((event) => eventMatchesFilters(event, filters, minSeverity, modeRideIds));

  return sortEvents(events, options.order ?? "newest");
}

export function buildEvent(input: Partial<HazardEvent>) {
  return {
    id: input.id ?? `evt-${randomUUID()}`,
    rideId: input.rideId ?? demoRide.id,
    t: input.t ?? 0,
    timestamp: input.timestamp ?? new Date().toISOString(),
    type: input.type ?? "road_obstruction",
    severity: clamp(input.severity ?? 50, SEVERITY_MIN, SEVERITY_MAX),
    confidence: clamp(input.confidence ?? 0.75, CONFIDENCE_MIN, CONFIDENCE_MAX),
    lat: input.lat ?? demoRide.startLat,
    lng: input.lng ?? demoRide.startLng,
    headingDeg: input.headingDeg ?? 0,
    speedMps: input.speedMps ?? 0,
    camera: input.camera ?? "front",
    spokenAlert: input.spokenAlert ?? "Road hazard ahead.",
    explanation: input.explanation ?? "A road hazard was detected from the active camera feed.",
    clipUrl: input.clipUrl,
    thumbnailUrl: input.thumbnailUrl,
    objects: input.objects ?? [],
  } satisfies HazardEvent;
}

export function createEvent(input: Partial<HazardEvent>) {
  const event = buildEvent(input);
  state().events.unshift(event);
  applyEventStatsDelta(event.rideId, 1, event.severity);
  recomputeDangerSegments();
  return event;
}

export function createEvents(inputs: Partial<HazardEvent>[]) {
  const events = inputs.map(buildEvent);
  if (!events.length) return events;

  state().events.unshift(...events);
  applyEventStatsDeltas(events);
  recomputeDangerSegments();
  return events;
}

export function listNearbyEvents(lat: number, lng: number, radiusM: number) {
  return sortEventsNewestFirst(state().events.filter((event) => haversineMeters(lat, lng, event.lat, event.lng) <= radiusM));
}

export function listDangerSegments(bbox?: { westLng: number; southLat: number; eastLng: number; northLat: number }) {
  const segments = !bbox
    ? state().dangerSegments
    : state().dangerSegments.filter(
        (segment) =>
          segment.centerLng >= bbox.westLng &&
          segment.centerLng <= bbox.eastLng &&
          segment.centerLat >= bbox.southLat &&
          segment.centerLat <= bbox.northLat,
      );

  return sortDangerSegments(segments);
}

export function getReplayPayload(rideId: string): ReplayPayload | null {
  const ride = getRide(rideId);
  if (!ride) return null;

  return {
    ride,
    events: listEvents({ rideId }, { order: "timeline" }),
    dangerSegments: listDangerSegments(),
    generatedAt: new Date().toISOString(),
  };
}

export function calculateRideStats(route: RoutePoint[], events: HazardEvent[]) {
  return calculateRideStatsFromEventStats(route, summarizeEvents(events));
}

export function calculateRideStatsFromEventStats(route: RoutePoint[], eventStats: EventStats) {
  const distanceMeters = route.slice(1).reduce((sum, point, index) => {
    const previous = route[index];
    return sum + haversineMeters(previous.lat, previous.lng, point.lat, point.lng);
  }, 0);

  return {
    durationSec: route.at(-1)?.t ?? 0,
    distanceMeters: Math.round(distanceMeters),
    maxRisk: eventStats.maxSeverity,
    eventCount: eventStats.count,
  };
}

function eventMatchesFilters(event: HazardEvent, filters: EventFilters, minSeverity: number, modeRideIds: Set<string> | null) {
  if (filters.rideId && event.rideId !== filters.rideId) return false;
  if (filters.type && event.type !== filters.type) return false;
  if (filters.camera && event.camera !== filters.camera) return false;
  if (modeRideIds && !modeRideIds.has(event.rideId)) return false;
  if (event.severity < minSeverity) return false;
  return true;
}

function eventStatsForRide(rideId: string) {
  return summarizeEvents(state().events.filter((event) => event.rideId === rideId));
}

function summarizeEvents(events: HazardEvent[]): EventStats {
  return {
    count: events.length,
    maxSeverity: events.reduce((max, event) => Math.max(max, event.severity), 0),
  };
}

function applyEventStatsDeltas(events: HazardEvent[]) {
  const deltas = new Map<string, EventStats>();

  for (const event of events) {
    const current = deltas.get(event.rideId) ?? { count: 0, maxSeverity: 0 };
    current.count += 1;
    current.maxSeverity = Math.max(current.maxSeverity, event.severity);
    deltas.set(event.rideId, current);
  }

  for (const [rideId, delta] of deltas) {
    applyEventStatsDelta(rideId, delta.count, delta.maxSeverity);
  }
}

function applyEventStatsDelta(rideId: string, countDelta: number, maxSeverity: number) {
  const ride = getRide(rideId);
  if (!ride) return;

  ride.stats = {
    ...ride.stats,
    eventCount: ride.stats.eventCount + countDelta,
    maxRisk: Math.max(ride.stats.maxRisk, maxSeverity),
  };
}

function recomputeDangerSegments() {
  const store = state();
  store.dangerSegments = computeDangerSegments(store.events);
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function cloneValue<T>(value: T): T {
  return structuredClone(value);
}
