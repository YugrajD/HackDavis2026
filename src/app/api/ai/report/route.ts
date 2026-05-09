import { NextResponse } from "next/server";
import type { DangerSegment, HazardEvent } from "@/lib/contracts";
import { generateSafetyReport } from "@/lib/ai/report";
import { listDangerSegments, listEvents } from "@/lib/db/store";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    segmentId?: string;
    segment?: DangerSegment;
    events?: HazardEvent[];
  };

  const segments = listDangerSegments();
  const requestedSegment = body.segmentId ? segments.find((item) => item.id === body.segmentId) : undefined;

  if (body.segmentId && !requestedSegment && !body.segment) {
    return NextResponse.json({ error: `Danger segment ${body.segmentId} was not found.` }, { status: 404 });
  }

  const segment = body.segment ?? requestedSegment ?? segments[0];

  if (!segment) {
    return NextResponse.json({ error: "No danger segment available for report generation." }, { status: 404 });
  }

  const eventPool = body.events ?? listEvents();
  const relatedEvents = eventPool.filter((event) => segment.topTypes.includes(event.type));
  const report = generateSafetyReport(segment, relatedEvents.length ? relatedEvents : eventPool);

  return NextResponse.json({ report, provider: process.env.ANTHROPIC_API_KEY ? "stub-claude-ready" : "stub" });
}
