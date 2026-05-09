import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getServerConfig, type SponsorConfig, type StorageConfig } from "@/lib/config/server";
import type { ReadinessResponse } from "@/lib/contracts";
import { getMongoDb, isMongoConfigured } from "@/lib/db/mongo";
import { listDangerSegments, listEvents, listRides } from "@/lib/db/repository";

export const runtime = "nodejs";

const DEMO_RIDE_ID = "demo-ride-1";

export async function GET() {
  const config = getServerConfig();
  const mongo = await checkMongo();
  const [uploads, data] = await Promise.all([checkUploads(config.storage.media), countSeededData(mongo.connected)]);

  const ready = uploads.writable && (!mongo.configured || mongo.connected);
  const response: ReadinessResponse = {
    status: ready ? "ready" : "degraded",
    generatedAt: new Date().toISOString(),
    integrations: {
      mongo,
      gemini: sponsorPresence(config.sponsors.gemini),
      anthropic: sponsorPresence(config.sponsors.anthropic),
      elevenLabs: sponsorPresence(config.sponsors.elevenLabs),
      uploads,
    },
    data,
  };

  return NextResponse.json(response, { status: ready ? 200 : 503 });
}

async function checkMongo(): Promise<ReadinessResponse["integrations"]["mongo"]> {
  if (!isMongoConfigured()) {
    return { configured: false, connected: false, mode: "memory" };
  }

  try {
    const db = await getMongoDb();
    await db?.command({ ping: 1 });
    return { configured: true, connected: true, mode: "mongodb" };
  } catch (error) {
    return {
      configured: true,
      connected: false,
      mode: "memory-fallback",
      error: error instanceof Error ? error.name : "MongoConnectionError",
    };
  }
}

async function checkUploads(media: StorageConfig["media"]): Promise<ReadinessResponse["integrations"]["uploads"]> {
  const probePath = path.join(media.uploadRoot, `.readiness-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const relativePath = media.publicPrefix.replace(/^\//, "public/");

  try {
    await mkdir(media.uploadRoot, { recursive: true });
    await writeFile(probePath, "ok", { flag: "wx" });
    await unlink(probePath);
    return { configured: true, writable: true, relativePath };
  } catch (error) {
    return {
      configured: true,
      writable: false,
      relativePath,
      error: error instanceof Error ? error.name : "UploadWriteError",
    };
  }
}

async function countSeededData(mongoConnected: boolean): Promise<ReadinessResponse["data"]> {
  const [rides, events, dangerSegments] = await Promise.all([listRides(), listEvents(), listDangerSegments()]);
  const demoEvents = events.filter((event) => event.rideId === DEMO_RIDE_ID).length;

  return {
    source: mongoConnected ? "mongodb" : "memory",
    rides: rides.length,
    events: events.length,
    dangerSegments: dangerSegments.length,
    demoRide: {
      id: DEMO_RIDE_ID,
      present: rides.some((ride) => ride.id === DEMO_RIDE_ID),
      eventCount: demoEvents,
    },
  };
}

function sponsorPresence(config: SponsorConfig[keyof SponsorConfig]) {
  return { configured: Boolean(config.apiKey) };
}
