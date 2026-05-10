import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { getServerConfig, getYoloServiceUrl, type SponsorConfig, type StorageConfig } from "@/lib/config/server";
import type { ProviderStatusResponse, ReadinessResponse } from "@/lib/contracts";
import { PROVIDER_NAMES } from "@/lib/contracts";
import { getMongoDb, isMongoConfigured } from "@/lib/db/mongo";
import { listDangerSegments, listEvents, listRides } from "@/lib/db/repository";

export const DEMO_RIDE_ID = "demo-ride-1";

export async function checkMongoReadiness(): Promise<ReadinessResponse["integrations"]["mongo"]> {
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

export async function checkUploadStorage(media: StorageConfig["media"]): Promise<ReadinessResponse["integrations"]["uploads"]> {
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

export async function countSeededData(mongoConnected: boolean): Promise<ReadinessResponse["data"]> {
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

export function sponsorPresence(config: SponsorConfig[keyof SponsorConfig]) {
  return { configured: Boolean(config.apiKey) };
}

export async function checkYoloReadiness(timeoutMs = 800): Promise<ReadinessResponse["integrations"]["yolo"]> {
  const base = getYoloServiceUrl();
  if (!base) return { configured: false, available: false, check: "not-configured" };

  let serviceHost: string | undefined;
  try {
    const url = new URL(base);
    serviceHost = url.host;
  } catch {
    return { configured: true, available: false, check: "failed-health", error: "InvalidUrl" };
  }

  try {
    const response = await fetch(`${base.replace(/\/$/, "")}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(timeoutMs),
    });

    return {
      configured: true,
      available: response.ok,
      check: response.ok ? "health" : "failed-health",
      serviceHost,
      ...(response.ok ? {} : { error: `HTTP_${response.status}` }),
    };
  } catch (error) {
    return {
      configured: true,
      available: false,
      check: "failed-health",
      serviceHost,
      error: error instanceof Error ? error.name : "YoloHealthError",
    };
  }
}

export async function getProviderStatus(): Promise<ProviderStatusResponse> {
  const config = getServerConfig();
  const [mongo, uploads, yolo] = await Promise.all([checkMongoReadiness(), checkUploadStorage(config.storage.media), checkYoloReadiness()]);
  const ready = uploads.writable && (!mongo.configured || mongo.connected) && (!yolo.configured || yolo.available);

  return {
    status: ready ? "ready" : "degraded",
    generatedAt: new Date().toISOString(),
    providers: {
      mongodb: {
        configured: mongo.configured,
        available: mongo.connected,
        mode: mongo.mode,
        check: mongo.configured ? (mongo.connected ? "ping" : "failed-ping") : "not-configured",
        error: mongo.error,
      },
      gemini: {
        configured: Boolean(config.sponsors.gemini.apiKey),
        available: Boolean(config.sponsors.gemini.apiKey),
        check: "configuration",
        fallback: PROVIDER_NAMES.stub,
      },
      claude: {
        configured: Boolean(config.sponsors.anthropic.apiKey),
        available: Boolean(config.sponsors.anthropic.apiKey),
        check: "configuration",
        fallback: PROVIDER_NAMES.stub,
      },
      elevenLabs: {
        configured: Boolean(config.sponsors.elevenLabs.apiKey),
        available: Boolean(config.sponsors.elevenLabs.apiKey),
        check: "configuration",
        fallback: "native-tts",
      },
      yolo,
      uploadStorage: {
        configured: uploads.configured,
        available: uploads.writable,
        writable: uploads.writable,
        relativePath: uploads.relativePath,
        check: "write-probe",
        error: uploads.error,
      },
      localFallback: {
        configured: true,
        available: true,
        persistence: "memory",
        frameAnalysis: PROVIDER_NAMES.stub,
        reports: PROVIDER_NAMES.stub,
        voice: "native-tts",
        scenarios: PROVIDER_NAMES.deterministicScenarioLab,
      },
    },
  };
}
