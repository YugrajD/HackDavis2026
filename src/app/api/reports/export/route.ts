import { NextResponse } from "next/server";
import { generateSafetyReport, generateSafetyReportWithClaude } from "@/lib/ai/report";
import { listDangerSegments, listEvents } from "@/lib/db/repository";
import { exportSafetyReport, type ExportFormat } from "@/lib/reports/export";

const formats: ExportFormat[] = ["markdown", "html", "csv"];

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { segmentId?: string; format?: ExportFormat };
  const format = formats.includes(body.format as ExportFormat) ? (body.format as ExportFormat) : "markdown";
  const segments = await listDangerSegments();
  const segment = body.segmentId ? segments.find((item) => item.id === body.segmentId) : segments[0];

  if (!segment) return NextResponse.json({ error: "No danger segment available for export." }, { status: 404 });
  if (body.segmentId && !segments.some((item) => item.id === body.segmentId)) {
    return NextResponse.json({ error: `Danger segment ${body.segmentId} was not found.` }, { status: 404 });
  }

  const events = await listEvents();
  const relatedEvents = events.filter((event) => segment.topTypes.includes(event.type));
  const eventsForReport = relatedEvents.length ? relatedEvents : events;
  const report = (process.env.ANTHROPIC_API_KEY ? await generateSafetyReportWithClaude(segment, eventsForReport).catch(() => null) : null) ?? generateSafetyReport(segment, eventsForReport);
  const document = exportSafetyReport(format, report, segment, eventsForReport);

  return NextResponse.json({ report, segment, format, document });
}
