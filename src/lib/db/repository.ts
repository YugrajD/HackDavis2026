import type { CameraRole, DangerSegment, HazardEvent, HazardType, ReplayPayload, Ride, RideMode } from "@/lib/contracts";
import { demoDangerSegments, demoEvents, demoRide } from "@/lib/seed/demo-data";
import { getMongoDb, isMongoConfigured, point } from "@/lib/db/mongo";
import {
  buildEvent,
  buildRide,
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
  const maxRisk = events.reduce((max, event) => Math.max(max, event.severity), 0);
  const updatedRide: Ride = {
    ...ride,
    endedAt: new Date().toISOString(),
    stats: {
      ...ride.stats,
      durationSec: ride.route.at(-1)?.t ?? ride.stats.durationSec,
      eventCount: events.length,
      maxRisk,
    },
  };

  await db.collection<Ride>("rides").replaceOne({ id: rideId }, updatedRide);
  return updatedRide;
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

  const docs = await db.collection<EventDocument>("events").find(query, { projection: { _id: 0, location: 0 } }).toArray();
  return docs.map(stripLocation);
}

export async function createEvent(input: Partial<HazardEvent>): Promise<Persisted<HazardEvent>> {
  const db = await configuredMongoDb();
  if (!db) return { value: createMemoryEvent(input), persisted: "memory" };

  const event = buildEvent(input);
  await db.collection<EventDocument>("events").insertOne(toEventDocument(event));
  return { value: event, persisted: "mongodb" };
}

export async function createEvents(inputs: Partial<HazardEvent>[]): Promise<Persisted<HazardEvent[]>> {
  const db = await configuredMongoDb();
  if (!db) return { value: createMemoryEvents(inputs), persisted: "memory" };

  const events = inputs.map(buildEvent);
  if (events.length) {
    await db.collection<EventDocument>("events").insertMany(events.map(toEventDocument));
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

  return docs.map(stripLocation);
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
    events: await listEvents({ rideId }),
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
