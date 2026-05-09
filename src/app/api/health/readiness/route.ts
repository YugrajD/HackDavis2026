import { NextResponse } from "next/server";
import { checkMongoReadiness, checkUploadStorage, countSeededData, sponsorPresence } from "@/lib/api/readiness";
import { getServerConfig } from "@/lib/config/server";
import type { ReadinessResponse } from "@/lib/contracts";

export const runtime = "nodejs";

export async function GET() {
  const config = getServerConfig();
  const mongo = await checkMongoReadiness();
  const [uploads, data] = await Promise.all([checkUploadStorage(config.storage.media), countSeededData(mongo.connected)]);

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
