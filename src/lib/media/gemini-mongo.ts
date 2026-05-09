import { PROVIDER_NAMES } from "@/lib/contracts";
import type { CameraRole, HazardEvent, PerceptionResult } from "@/lib/contracts";
import { analyzeFrameStub, analyzeFrameWithGemini } from "@/lib/ai/hazard-analysis";
import { getSponsorConfig } from "@/lib/config/server";
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
  perception?: PerceptionResult;
};

export type AnalyzeAndPersistMediaOutput = {
  event: HazardEvent;
  persisted: PersistenceMode;
  provider: "gemini" | "perception" | "stub";
  perception?: PerceptionResult;
};

export async function analyzeAndPersistMedia(input: AnalyzeAndPersistMediaInput): Promise<AnalyzeAndPersistMediaOutput> {
  const provider = getSponsorConfig().gemini.apiKey ? PROVIDER_NAMES.gemini : PROVIDER_NAMES.stub;
  let analysis = provider === PROVIDER_NAMES.gemini ? await analyzeFrameWithGemini(input).catch(() => null) : null;
  let resolvedProvider: AnalyzeAndPersistMediaOutput["provider"] = provider;

  if (!analysis) {
    analysis = analyzeFrameStub(input);
    resolvedProvider = input.perception?.tracks.length ? PROVIDER_NAMES.perception : PROVIDER_NAMES.stub;
  }

  const draft = input.perception?.hazardDraft;
  const { value: event, persisted } = await createEvent({
    ...analysis,
    rideId: input.rideId ?? draft?.rideId,
    t: input.t ?? draft?.t,
    timestamp: draft?.timestamp ?? input.perception?.capturedAt ?? new Date().toISOString(),
    lat: input.lat ?? draft?.lat,
    lng: input.lng ?? draft?.lng,
    headingDeg: input.headingDeg ?? draft?.headingDeg,
    speedMps: input.speedMps ?? draft?.speedMps,
    camera: input.camera ?? draft?.camera ?? "front",
    clipUrl: input.clipUrl,
    thumbnailUrl: input.thumbnailUrl,
  });

  return { event, persisted, provider: resolvedProvider, perception: input.perception };
}

export function mediaEvidenceSummary(event: HazardEvent) {
  const media = [event.thumbnailUrl ? "thumbnail" : null, event.clipUrl ? "clip" : null].filter(Boolean).join(" + ") || "no media";
  return `${event.type.replaceAll("_", " ")} at severity ${event.severity}/100 with ${media}; ${event.objects.length} tracked object${event.objects.length === 1 ? "" : "s"}.`;
}
