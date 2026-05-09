import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import type { ReadinessResponse } from "@/lib/contracts";
import { getMongoDb, isMongoConfigured } from "@/lib/db/mongo";
import { listDangerSegments, listEvents, listRides } from "@/lib/db/repository";

export const runtime = "nodejs";

const UPLOAD_DIR = path.join(process.cwd(), "public", "generated", "uploads");
const UPLOAD_DIR_RELATIVE = "public/generated/uploads";
const DEMO_RIDE_ID = "demo-ride-1";

export async function GET() {
  const mongo = await checkMongo();
  const [uploads, data] = await Promise.all([checkUploads(), countSeededData(mongo.connected)]);

  const ready = uploads.writable && (!mongo.configured || mongo.connected);
  const response: ReadinessResponse = {
    status: ready ? "ready" : "degraded",
    generatedAt: new Date().toISOString(),
    integrations: {
      mongo,
      gemini: envPresence("GEMINI_API_KEY"),
      anthropic: envPresence("ANTHROPIC_API_KEY"),
      elevenLabs: envPresence("ELEVENLABS_API_KEY"),
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

async function checkUploads(): Promise<ReadinessResponse["integrations"]["uploads"]> {
  const probePath = path.join(UPLOAD_DIR, `.readiness-${Date.now()}-${Math.random().toString(36).slice(2)}`);

  try {
    await mkdir(UPLOAD_DIR, { recursive: true });
    await writeFile(probePath, "ok", { flag: "wx" });
    await unlink(probePath);
    return { configured: true, writable: true, relativePath: UPLOAD_DIR_RELATIVE };
  } catch (error) {
    return {
      configured: true,
      writable: false,
      relativePath: UPLOAD_DIR_RELATIVE,
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

function envPresence(name: "GEMINI_API_KEY" | "ANTHROPIC_API_KEY" | "ELEVENLABS_API_KEY") {
  return { configured: Boolean(process.env[name]?.trim()) };
}
