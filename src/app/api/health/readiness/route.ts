import { NextResponse } from "next/server";
import { checkMongoReadiness, checkUploadStorage, checkYoloReadiness, countSeededData, sponsorPresence } from "@/lib/api/readiness";
import { getServerConfig } from "@/lib/config/server";
import type { ReadinessResponse } from "@/lib/contracts";

export const runtime = "nodejs";

export async function GET() {
  const config = getServerConfig();
  const mongo = await checkMongoReadiness();
  const [uploads, yolo, data] = await Promise.all([checkUploadStorage(config.storage.media), checkYoloReadiness(), countSeededData(mongo.connected)]);

  const ready = uploads.writable && (!mongo.configured || mongo.connected) && (!yolo.configured || yolo.available);
  const response: ReadinessResponse = {
    status: ready ? "ready" : "degraded",
    generatedAt: new Date().toISOString(),
    integrations: {
      mongo,
      gemini: sponsorPresence(config.sponsors.gemini),
      anthropic: sponsorPresence(config.sponsors.anthropic),
      elevenLabs: sponsorPresence(config.sponsors.elevenLabs),
      yolo,
      uploads,
    },
    data,
  };

  return NextResponse.json(response, { status: ready ? 200 : 503 });
}
