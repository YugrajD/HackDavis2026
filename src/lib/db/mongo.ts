import { MongoClient, type Db } from "mongodb";
import { getStorageConfig } from "@/lib/config/server";

declare global {
  // eslint-disable-next-line no-var
  var guardianRoadMongoClientPromise: Promise<MongoClient> | undefined;
}

export function isMongoConfigured() {
  return Boolean(getStorageConfig().mongo.uri);
}

export async function getMongoDb(): Promise<Db | null> {
  const { mongo } = getStorageConfig();
  if (!mongo.uri) return null;

  if (!globalThis.guardianRoadMongoClientPromise) {
    const client = new MongoClient(mongo.uri, {
      connectTimeoutMS: 3_000,
      serverSelectionTimeoutMS: 3_000,
      socketTimeoutMS: 10_000,
    });
    globalThis.guardianRoadMongoClientPromise = client.connect();
  }

  let client: MongoClient;
  try {
    client = await globalThis.guardianRoadMongoClientPromise;
  } catch (error) {
    globalThis.guardianRoadMongoClientPromise = undefined;
    throw error;
  }
  const db = client.db(mongo.dbName);
  await ensureIndexes(db);
  return db;
}

async function ensureIndexes(db: Db) {
  await Promise.all([
    db.collection("rides").createIndex({ id: 1 }, { unique: true }),
    db.collection("rides").createIndex({ mode: 1, id: 1 }),
    db.collection("rides").createIndex({ startedAt: -1, id: 1 }),
    db.collection("events").createIndex({ id: 1 }, { unique: true }),
    db.collection("events").createIndex({ location: "2dsphere" }),
    db.collection("events").createIndex({ rideId: 1, t: 1 }),
    db.collection("events").createIndex({ rideId: 1, timestamp: -1, id: 1 }),
    db.collection("events").createIndex({ type: 1, timestamp: -1, id: 1 }),
    db.collection("events").createIndex({ camera: 1, timestamp: -1, id: 1 }),
    db.collection("events").createIndex({ severity: -1, timestamp: -1, id: 1 }),
    db.collection("danger_segments").createIndex({ id: 1 }, { unique: true }),
    db.collection("danger_segments").createIndex({ location: "2dsphere" }),
    db.collection("danger_segments").createIndex({ centerLng: 1, centerLat: 1 }),
    db.collection("danger_segments").createIndex({ score: -1, eventCount: -1, lastSeen: -1, id: 1 }),
  ]);
}

export function point(lng: number, lat: number) {
  return {
    type: "Point" as const,
    coordinates: [lng, lat] as [number, number],
  };
}
