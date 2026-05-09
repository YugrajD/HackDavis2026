import type { CameraRole, HazardEvent } from "@/lib/contracts";
import { analyzeFrameStub, analyzeFrameWithGemini } from "@/lib/ai/hazard-analysis";
import { createEvent, type PersistenceMode } from "@/lib/db/repository";

export type AnalyzeAndPersistMediaInput = {
  imageBase64?: string;
  rideId?: string;
  t?: number;
  lat?: number;
  lng?: number;
  speedMps?: number;
  headingDeg?: number;
  camera?: CameraRole;
  clipUrl?: string;
  thumbnailUrl?: string;
};

export type AnalyzeAndPersistMediaOutput = {
  event: HazardEvent;
  persisted: PersistenceMode;
  provider: "gemini" | "stub";
};

export async function analyzeAndPersistMedia(input: AnalyzeAndPersistMediaInput): Promise<AnalyzeAndPersistMediaOutput> {
  const provider = process.env.GEMINI_API_KEY ? "gemini" : "stub";
  let analysis = provider === "gemini" ? await analyzeFrameWithGemini(input).catch(() => null) : null;
  let resolvedProvider: AnalyzeAndPersistMediaOutput["provider"] = provider;

  if (!analysis) {
    analysis = analyzeFrameStub(input);
    resolvedProvider = "stub";
  }

  const { value: event, persisted } = await createEvent({
    rideId: input.rideId,
    t: input.t,
    timestamp: new Date().toISOString(),
    lat: input.lat,
    lng: input.lng,
    headingDeg: input.headingDeg,
    speedMps: input.speedMps,
    camera: input.camera ?? "front",
    clipUrl: input.clipUrl,
    thumbnailUrl: input.thumbnailUrl,
    ...analysis,
  });

  return { event, persisted, provider: resolvedProvider };
}

export function mediaEvidenceSummary(event: HazardEvent) {
  const media = [event.thumbnailUrl ? "thumbnail" : null, event.clipUrl ? "clip" : null].filter(Boolean).join(" + ") || "no media";
  return `${event.type.replaceAll("_", " ")} at severity ${event.severity}/100 with ${media}; ${event.objects.length} tracked object${event.objects.length === 1 ? "" : "s"}.`;
}
