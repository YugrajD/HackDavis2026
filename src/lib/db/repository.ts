import type { Db } from "mongodb";
import type { CameraRole, DangerSegment, HazardEvent, HazardType, ReplayPayload, Ride, RideMode, RoutePoint } from "@/lib/contracts";
import { mongoEventSort, sortEventsNewestFirst, type EventSortOrder } from "@/lib/db/event-ordering";
import { getMongoDb, isMongoConfigured, point } from "@/lib/db/mongo";
import { computeDangerSegments, sortDangerSegments } from "@/lib/geo/danger-segments";
import { demoDangerSegments, demoEvents, demoRide } from "@/lib/seed/demo-data";
import {
  appendRideRoute as appendMemoryRideRoute,
  buildEvent,
  buildRide,
  calculateRideStatsFromEventStats,
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
  type EventStats,
} from "@/lib/db/store";

export type PersistenceMode = "memory" | "mongodb";

type Persisted<T> = {
  value: T;
  persisted: PersistenceMode;
};

type Location = ReturnType<typeof point>;
type EventDocument = HazardEvent & { location: Location };
type DangerSegmentDocument = DangerSegment & { location: Location };
type DangerSegmentEvent = Pick<HazardEvent, "id" | "rideId" | "t" | "timestamp" | "type" | "severity" | "lat" | "lng">;
type ListEventsOptions = { order?: EventSortOrder };

export async function listRides() {
  const db = await configuredMongoDb();
  if (!db) return listMemoryRides();

  return db.collection<Ride>("rides").find({}, { projection: { _id: 0 } }).sort({ startedAt: -1, id: 1 }).toArray();
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

  const updatedRide: Ride = {
    ...ride,
    endedAt: new Date().toISOString(),
    stats: calculateRideStatsFromEventStats(ride.route, await readEventStats(db, rideId)),
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
  const updatedRide: Ride = {
    ...ride,
    route,
    stats: calculateRideStatsFromEventStats(route, await readEventStats(db, rideId)),
  };

  await db.collection<Ride>("rides").replaceOne({ id: rideId }, updatedRide);
  return { value: updatedRide, persisted: "mongodb" };
}

export async function listEvents(filters: EventFilters = {}, options: ListEventsOptions = {}) {
  const db = await configuredMongoDb();
  if (!db) return listMemoryEvents(filters, options);

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

  const docs = await db
    .collection<EventDocument>("events")
    .find(query, { projection: { _id: 0, location: 0 } })
    .sort(mongoEventSort(options.order ?? "newest"))
    .toArray();
  return docs.map(stripLocation);
}

export async function createEvent(input: Partial<HazardEvent>): Promise<Persisted<HazardEvent>> {
  const db = await configuredMongoDb();
  if (!db) return { value: createMemoryEvent(input), persisted: "memory" };

  const event = buildEvent(input);
  await db.collection<EventDocument>("events").insertOne(toEventDocument(event));
  await Promise.all([applyMongoEventStatsDeltas(db, [event]), recomputeMongoDangerSegments(db)]);
  return { value: event, persisted: "mongodb" };
}

export async function createEvents(inputs: Partial<HazardEvent>[]): Promise<Persisted<HazardEvent[]>> {
  const db = await configuredMongoDb();
  if (!db) return { value: createMemoryEvents(inputs), persisted: "memory" };

  const events = inputs.map(buildEvent);
  if (events.length) {
    await db.collection<EventDocument>("events").insertMany(events.map(toEventDocument));
    await Promise.all([applyMongoEventStatsDeltas(db, events), recomputeMongoDangerSegments(db)]);
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
  return sortDangerSegments(docs.map(stripLocation));
}

export async function getReplayPayload(rideId: string): Promise<ReplayPayload | null> {
  const db = await configuredMongoDb();
  if (!db) return getMemoryReplayPayload(rideId);

  const [ride, eventDocs, segmentDocs] = await Promise.all([
    db.collection<Ride>("rides").findOne({ id: rideId }, { projection: { _id: 0 } }),
    db.collection<EventDocument>("events").find({ rideId }, { projection: { _id: 0, location: 0 } }).sort(mongoEventSort("timeline")).toArray(),
    db.collection<DangerSegmentDocument>("danger_segments").find({}, { projection: { _id: 0, location: 0 } }).toArray(),
  ]);

  if (!ride) return null;

  return {
    ride,
    events: eventDocs.map(stripLocation),
    dangerSegments: sortDangerSegments(segmentDocs.map(stripLocation)),
    generatedAt: new Date().toISOString(),
  };
}

export async function resetDemoData() {
  const db = await configuredMongoDb();
  if (!db) return resetMemoryDemoData();

  const ride = cloneValue(demoRide);
  const events = cloneValue(demoEvents);
  const dangerSegments = cloneValue(demoDangerSegments);

  await Promise.all([
    db.collection<Ride>("rides").replaceOne({ id: ride.id }, ride, { upsert: true }),
    db.collection<EventDocument>("events").deleteMany({ rideId: ride.id }),
    db.collection<DangerSegmentDocument>("danger_segments").deleteMany({ id: { $in: dangerSegments.map((segment) => segment.id) } }),
  ]);
  await Promise.all([
    db.collection<EventDocument>("events").insertMany(events.map(toEventDocument)),
    db.collection<DangerSegmentDocument>("danger_segments").insertMany(dangerSegments.map(toDangerSegmentDocument)),
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

async function readEventStats(db: Db, rideId: string): Promise<EventStats> {
  const [stats] = await db
    .collection<EventDocument>("events")
    .aggregate<EventStats>([
      { $match: { rideId } },
      { $group: { _id: null, count: { $sum: 1 }, maxSeverity: { $max: "$severity" } } },
      { $project: { _id: 0, count: 1, maxSeverity: { $ifNull: ["$maxSeverity", 0] } } },
    ])
    .toArray();

  return stats ?? { count: 0, maxSeverity: 0 };
}

async function applyMongoEventStatsDeltas(db: Db, events: HazardEvent[]) {
  if (!events.length) return;

  const deltas = new Map<string, EventStats>();
  for (const event of events) {
    const current = deltas.get(event.rideId) ?? { count: 0, maxSeverity: 0 };
    current.count += 1;
    current.maxSeverity = Math.max(current.maxSeverity, event.severity);
    deltas.set(event.rideId, current);
  }

  await Promise.all(
    [...deltas].map(([rideId, delta]) =>
      db.collection<Ride>("rides").updateOne({ id: rideId }, { $inc: { "stats.eventCount": delta.count }, $max: { "stats.maxRisk": delta.maxSeverity } }),
    ),
  );
}

async function recomputeMongoDangerSegments(db: Db) {
  const docs = await db.collection<DangerSegmentEvent>("events").find({}, { projection: dangerSegmentEventProjection }).toArray();
  const dangerSegments = computeDangerSegments(docs as unknown as HazardEvent[]);

  await replaceMongoDangerSegments(db, dangerSegments);
}

async function replaceMongoDangerSegments(db: Db, dangerSegments: DangerSegment[]) {
  if (!dangerSegments.length) {
    await db.collection<DangerSegmentDocument>("danger_segments").deleteMany({});
    return;
  }

  await db.collection<DangerSegmentDocument>("danger_segments").bulkWrite(
    dangerSegments.map((segment) => ({
      replaceOne: {
        filter: { id: segment.id },
        replacement: toDangerSegmentDocument(segment),
        upsert: true,
      },
    })),
  );
  await db.collection<DangerSegmentDocument>("danger_segments").deleteMany({ id: { $nin: dangerSegments.map((segment) => segment.id) } });
}

const dangerSegmentEventProjection = {
  _id: 0,
  id: 1,
  rideId: 1,
  t: 1,
  timestamp: 1,
  type: 1,
  severity: 1,
  lat: 1,
  lng: 1,
} as const;

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

function cloneValue<T>(value: T): T {
  return structuredClone(value);
}
