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
    const client = new MongoClient(mongo.uri);
    globalThis.guardianRoadMongoClientPromise = client.connect();
  }

  const client = await globalThis.guardianRoadMongoClientPromise;
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
