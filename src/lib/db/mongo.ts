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
    db.collection("events").createIndex({ location: "2dsphere" }),
    db.collection("events").createIndex({ rideId: 1, t: 1 }),
    db.collection("danger_segments").createIndex({ location: "2dsphere" }),
  ]);
}

export function point(lng: number, lat: number) {
  return {
    type: "Point" as const,
    coordinates: [lng, lat] as [number, number],
  };
}
