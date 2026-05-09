import type { Db } from "mongodb";
import type { CameraRole, DangerSegment, HazardEvent, HazardType, ReplayPayload, Ride, RideMode, RoutePoint } from "@/lib/contracts";
import { sortEventsForTimeline, sortEventsNewestFirst } from "@/lib/db/event-ordering";
import { getMongoDb, isMongoConfigured, point } from "@/lib/db/mongo";
import { computeDangerSegments } from "@/lib/geo/danger-segments";
import { demoDangerSegments, demoEvents, demoRide } from "@/lib/seed/demo-data";
import {
  appendRideRoute as appendMemoryRideRoute,
  buildEvent,
  buildRide,
  calculateRideStats,
  createEvent as createMemoryEvent,
  createEvents as createMemoryEvents,
  createRide as createMemoryRide,
  endRide as endMemoryRide,
  getReplayPayload as getMemoryReplayPayload,
  getRide as getMemoryRide,
  listDangerSegments as listMemoryDangerSegments,
  listEvents as listMemoryEvents,
  listNearbyEvents as listMemoryNearbyEvents,
  listRides as listMemoryRides,
  resetDemoData as resetMemoryDemoData,
  type CreateRideInput,
  type EventFilters,
} from "@/lib/db/store";

export type PersistenceMode = "memory" | "mongodb";

type Persisted<T> = {
  value: T;
  persisted: PersistenceMode;
};

type Location = ReturnType<typeof point>;
type EventDocument = HazardEvent & { location: Location };
type DangerSegmentDocument = DangerSegment & { location: Location };

export async function listRides() {
  const db = await configuredMongoDb();
  if (!db) return listMemoryRides();

  return db.collection<Ride>("rides").find({}, { projection: { _id: 0 } }).toArray();
}

export async function getRide(rideId: string) {
  const db = await configuredMongoDb();
  if (!db) return getMemoryRide(rideId);

  return db.collection<Ride>("rides").findOne({ id: rideId }, { projection: { _id: 0 } });
}

export async function createRide(input: CreateRideInput): Promise<Persisted<Ride>> {
  const db = await configuredMongoDb();
  if (!db) return { value: createMemoryRide(input), persisted: "memory" };

  const ride = buildRide(input);
  await db.collection<Ride>("rides").insertOne({ ...ride });
  return { value: ride, persisted: "mongodb" };
}

export async function endRide(rideId: string) {
  const db = await configuredMongoDb();
  if (!db) return endMemoryRide(rideId);

  const ride = await getRide(rideId);
  if (!ride) return null;

  const events = await listEvents({ rideId });
  const updatedRide: Ride = {
    ...ride,
    endedAt: new Date().toISOString(),
    stats: calculateRideStats(ride.route, events),
  };

  await db.collection<Ride>("rides").replaceOne({ id: rideId }, updatedRide);
  return updatedRide;
}

export async function appendRideRoute(rideId: string, points: RoutePoint[]): Promise<Persisted<Ride> | null> {
  const db = await configuredMongoDb();
  if (!db) {
    const ride = appendMemoryRideRoute(rideId, points);
    return ride ? { value: ride, persisted: "memory" } : null;
  }

  const ride = await getRide(rideId);
  if (!ride) return null;

  const route = [...ride.route, ...points];
  const events = await listEvents({ rideId });
  const updatedRide: Ride = {
    ...ride,
    route,
    stats: calculateRideStats(route, events),
  };

  await db.collection<Ride>("rides").replaceOne({ id: rideId }, updatedRide);
  return { value: updatedRide, persisted: "mongodb" };
}

export async function listEvents(filters: EventFilters = {}) {
  const db = await configuredMongoDb();
  if (!db) return listMemoryEvents(filters);

  const query: Record<string, unknown> = {};
  if (filters.rideId) query.rideId = filters.rideId;
  if (filters.type) query.type = filters.type;
  if (filters.camera) query.camera = filters.camera;
  if (filters.minSeverity !== undefined) query.severity = { $gte: filters.minSeverity };

  if (filters.mode) {
    const rides = await db.collection<Ride>("rides").find({ mode: filters.mode }, { projection: { _id: 0, id: 1 } }).toArray();
    const rideIds = rides.map((ride) => ride.id);

    if (filters.rideId && !rideIds.includes(filters.rideId)) return [];
    if (!filters.rideId) query.rideId = { $in: rideIds };
  }

  const docs = await db.collection<EventDocument>("events").find(query, { projection: { _id: 0, location: 0 } }).sort({ timestamp: -1, t: -1, id: 1 }).toArray();
  return sortEventsNewestFirst(docs.map(stripLocation));
}

export async function createEvent(input: Partial<HazardEvent>): Promise<Persisted<HazardEvent>> {
  const db = await configuredMongoDb();
  if (!db) return { value: createMemoryEvent(input), persisted: "memory" };

  const event = buildEvent(input);
  await db.collection<EventDocument>("events").insertOne(toEventDocument(event));
  await recomputeMongoDangerSegments(db);
  return { value: event, persisted: "mongodb" };
}

export async function createEvents(inputs: Partial<HazardEvent>[]): Promise<Persisted<HazardEvent[]>> {
  const db = await configuredMongoDb();
  if (!db) return { value: createMemoryEvents(inputs), persisted: "memory" };

  const events = inputs.map(buildEvent);
  if (events.length) {
    await db.collection<EventDocument>("events").insertMany(events.map(toEventDocument));
    await recomputeMongoDangerSegments(db);
  }

  return { value: events, persisted: "mongodb" };
}

export async function listNearbyEvents(lat: number, lng: number, radiusM: number) {
  const db = await configuredMongoDb();
  if (!db) return listMemoryNearbyEvents(lat, lng, radiusM);

  const docs = await db
    .collection<EventDocument>("events")
    .find(
      {
        location: {
          $near: {
            $geometry: point(lng, lat),
            $maxDistance: radiusM,
          },
        },
      },
      { projection: { _id: 0, location: 0 } },
    )
    .toArray();

  return sortEventsNewestFirst(docs.map(stripLocation));
}

export async function listDangerSegments(bbox?: { westLng: number; southLat: number; eastLng: number; northLat: number }) {
  const db = await configuredMongoDb();
  if (!db) return listMemoryDangerSegments(bbox);

  const query = bbox
    ? {
        centerLng: { $gte: bbox.westLng, $lte: bbox.eastLng },
        centerLat: { $gte: bbox.southLat, $lte: bbox.northLat },
      }
    : {};

  const docs = await db.collection<DangerSegmentDocument>("danger_segments").find(query, { projection: { _id: 0, location: 0 } }).toArray();
  return docs.map(stripLocation);
}

export async function getReplayPayload(rideId: string): Promise<ReplayPayload | null> {
  const db = await configuredMongoDb();
  if (!db) return getMemoryReplayPayload(rideId);

  const ride = await getRide(rideId);
  if (!ride) return null;

  return {
    ride,
    events: sortEventsForTimeline(await listEvents({ rideId })),
    dangerSegments: await listDangerSegments(),
    generatedAt: new Date().toISOString(),
  };
}

export async function resetDemoData() {
  const db = await configuredMongoDb();
  if (!db) return resetMemoryDemoData();

  await Promise.all([
    db.collection<Ride>("rides").replaceOne({ id: demoRide.id }, demoRide, { upsert: true }),
    db.collection<EventDocument>("events").deleteMany({ rideId: demoRide.id }),
    db
      .collection<DangerSegmentDocument>("danger_segments")
      .deleteMany({ id: { $in: demoDangerSegments.map((segment) => segment.id) } }),
  ]);
  await Promise.all([
    db.collection<EventDocument>("events").insertMany(demoEvents.map(toEventDocument)),
    db.collection<DangerSegmentDocument>("danger_segments").insertMany(demoDangerSegments.map(toDangerSegmentDocument)),
  ]);

  return {
    rideId: demoRide.id,
    eventCount: demoEvents.length,
    segmentCount: demoDangerSegments.length,
  };
}

async function configuredMongoDb() {
  if (!isMongoConfigured()) return null;

  try {
    return await getMongoDb();
  } catch {
    return null;
  }
}

async function recomputeMongoDangerSegments(db: Db) {
  const docs = await db.collection<EventDocument>("events").find({}, { projection: { _id: 0, location: 0 } }).toArray();
  const dangerSegments = computeDangerSegments(docs.map(stripLocation));

  await db.collection<DangerSegmentDocument>("danger_segments").deleteMany({});
  if (dangerSegments.length) {
    await db.collection<DangerSegmentDocument>("danger_segments").insertMany(dangerSegments.map(toDangerSegmentDocument));
  }
}

function toEventDocument(event: HazardEvent): EventDocument {
  return {
    ...event,
    location: point(event.lng, event.lat),
  };
}

function toDangerSegmentDocument(segment: DangerSegment): DangerSegmentDocument {
  return {
    ...segment,
    location: point(segment.centerLng, segment.centerLat),
  };
}

function stripLocation<T>(document: T & { location?: Location }) {
  const { location: _location, ...payload } = document;
  return payload;
}
