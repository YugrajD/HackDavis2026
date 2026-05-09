import { NextResponse } from "next/server";
import type { DangerSegment, HazardEvent } from "@/lib/contracts";
import { generateSafetyReport, generateSafetyReportWithClaude } from "@/lib/ai/report";
import { listDangerSegments, listEvents } from "@/lib/db/repository";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    segmentId?: string;
    segment?: DangerSegment;
    events?: HazardEvent[];
  };

  const segments = await listDangerSegments();
  const requestedSegment = body.segmentId ? segments.find((item) => item.id === body.segmentId) : undefined;

  if (body.segmentId && !requestedSegment && !body.segment) {
    return NextResponse.json({ error: `Danger segment ${body.segmentId} was not found.` }, { status: 404 });
  }

  const segment = body.segment ?? requestedSegment ?? segments[0];

  if (!segment) {
    return NextResponse.json({ error: "No danger segment available for report generation." }, { status: 404 });
  }

  const eventPool = body.events ?? (await listEvents());
  const relatedEvents = eventPool.filter((event) => segment.topTypes.includes(event.type));
  const eventsForReport = relatedEvents.length ? relatedEvents : eventPool;

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const report = await generateSafetyReportWithClaude(segment, eventsForReport);
      if (report) return NextResponse.json({ report, provider: "claude" });
    } catch (error) {
      console.error("Claude safety report generation failed; falling back to deterministic report.", error);
    }
  }

  const report = generateSafetyReport(segment, eventsForReport);
  return NextResponse.json({ report, provider: "stub" });
}
