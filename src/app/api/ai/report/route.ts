import { NextResponse } from "next/server";
import { PROVIDER_NAMES } from "@/lib/contracts";
import type { DangerSegment, HazardEvent } from "@/lib/contracts";
import { handleApiError, jsonError, readJsonBody, requireJsonObject } from "@/lib/api/responses";
import { generateSafetyReport, generateSafetyReportWithClaude } from "@/lib/ai/report";
import { getSponsorConfig } from "@/lib/config/server";
import { listDangerSegments, listEvents } from "@/lib/db/repository";
import { resolveDangerSegment } from "@/lib/geo/danger-segments";

export async function POST(request: Request) {
  try {
    const body = requireJsonObject<{
      segmentId?: string;
      segment?: DangerSegment;
      events?: HazardEvent[];
    }>(await readJsonBody<unknown>(request, { allowEmpty: true, maxBytes: 256 * 1024 }));

    const segments = await listDangerSegments();
    const requestedSegment = body.segmentId ? resolveDangerSegment(segments, body.segmentId) : undefined;

    if (body.segmentId && !requestedSegment && !body.segment) {
      return jsonError(`Danger segment ${body.segmentId} was not found.`, 404);
    }

    const segment = body.segment ?? requestedSegment ?? segments[0];

    if (!segment) {
      return jsonError("No danger segment available for report generation.", 404);
    }

    const eventPool = Array.isArray(body.events) ? body.events.slice(0, 100) : await listEvents();
    const relatedEvents = eventPool.filter((event) => segment.topTypes.includes(event.type));
    const eventsForReport = relatedEvents.length ? relatedEvents : eventPool;

    if (getSponsorConfig().anthropic.apiKey) {
      try {
        const report = await generateSafetyReportWithClaude(segment, eventsForReport);
        if (report) return NextResponse.json({ report, provider: PROVIDER_NAMES.claude });
      } catch (error) {
        console.error("Claude safety report generation failed; falling back to deterministic report.", error);
      }
    }

    const report = generateSafetyReport(segment, eventsForReport);
    return NextResponse.json({ report, provider: PROVIDER_NAMES.stub });
  } catch (error) {
    return handleApiError(error, "Generate report failed.");
  }
}
