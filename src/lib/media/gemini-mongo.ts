import { PROVIDER_NAMES } from "@/lib/contracts";
import type { CameraRole, HazardEvent, PerceptionResult } from "@/lib/contracts";
import {
  analyzeFrameStub,
  analyzeFrameWithGemini,
  mergeGeminiWithYoloPerception,
} from "@/lib/ai/hazard-analysis";
import { getSponsorConfig, getYoloServiceUrl } from "@/lib/config/server";
import { createEvent, type PersistenceMode } from "@/lib/db/repository";
import { fetchYoloDetectionsFromService } from "@/lib/perception/yolo-client";
import { buildPerceptionFromYoloDetections } from "@/lib/perception/yolo-perception";

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
  /** When true, call YOLO service (YOLO_SERVICE_URL) to fill perception when not already supplied. */
  useYolo?: boolean;
};

export type AnalyzeAndPersistMediaOutput = {
  event: HazardEvent;
  persisted: PersistenceMode;
  provider: "gemini" | "perception" | "stub";
  perception?: PerceptionResult;
  yoloNote?: string;
};

export async function analyzeAndPersistMedia(input: AnalyzeAndPersistMediaInput): Promise<AnalyzeAndPersistMediaOutput> {
  let perception = input.perception;
  let yoloNote: string | undefined;

  const canRunYolo =
    input.useYolo && Boolean(getYoloServiceUrl()) && Boolean(input.imageBase64?.trim()) && !input.perception;

  if (canRunYolo) {
    const yolo = await fetchYoloDetectionsFromService(input.imageBase64);
    if (yolo?.note) yoloNote = yolo.note;
    if (yolo) {
      perception = buildPerceptionFromYoloDetections({
        detections: yolo.detections,
        width: yolo.width,
        height: yolo.height,
        camera: input.camera ?? "front",
        lat: input.lat,
        lng: input.lng,
        speedMps: input.speedMps,
        headingDeg: input.headingDeg,
      });
    }
  }

  const frameInput = { ...input, perception };

  const geminiConfigured = Boolean(getSponsorConfig().gemini.apiKey);
  let analysis = geminiConfigured ? await analyzeFrameWithGemini(frameInput).catch(() => null) : null;
  let resolvedProvider: AnalyzeAndPersistMediaOutput["provider"] = geminiConfigured ? PROVIDER_NAMES.gemini : PROVIDER_NAMES.stub;

  if (analysis && perception) {
    analysis = mergeGeminiWithYoloPerception(analysis, perception);
  } else if (!analysis) {
    analysis = analyzeFrameStub(frameInput);
    resolvedProvider = perception ? PROVIDER_NAMES.perception : PROVIDER_NAMES.stub;
  } else {
    resolvedProvider = PROVIDER_NAMES.gemini;
  }

  const draft = perception?.hazardDraft ?? input.perception?.hazardDraft;
  const { value: event, persisted } = await createEvent({
    ...analysis,
    rideId: input.rideId ?? draft?.rideId,
    t: input.t ?? draft?.t,
    timestamp: draft?.timestamp ?? perception?.capturedAt ?? input.perception?.capturedAt ?? new Date().toISOString(),
    lat: input.lat ?? draft?.lat,
    lng: input.lng ?? draft?.lng,
    headingDeg: input.headingDeg ?? draft?.headingDeg,
    speedMps: input.speedMps ?? draft?.speedMps,
    camera: input.camera ?? draft?.camera ?? "front",
    clipUrl: input.clipUrl,
    thumbnailUrl: input.thumbnailUrl,
  });

  return { event, persisted, provider: resolvedProvider, perception, yoloNote };
}

export function mediaEvidenceSummary(event: HazardEvent) {
  const media = [event.thumbnailUrl ? "thumbnail" : null, event.clipUrl ? "clip" : null].filter(Boolean).join(" + ") || "no media";
  return `${event.type.replaceAll("_", " ")} at severity ${event.severity}/100 with ${media}; ${event.objects.length} tracked object${event.objects.length === 1 ? "" : "s"}.`;
}
