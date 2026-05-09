import { NextResponse } from "next/server";
import { handleApiError, jsonError, readJsonBody } from "@/lib/api/responses";
import { generateSafetyReport, generateSafetyReportWithClaude } from "@/lib/ai/report";
import { listDangerSegments, listEvents } from "@/lib/db/repository";
import { exportSafetyReport, type ExportFormat } from "@/lib/reports/export";

const formats: ExportFormat[] = ["markdown", "html", "csv"];

export async function POST(request: Request) {
  try {
    const body = await readJsonBody<{ segmentId?: string; format?: ExportFormat }>(request, { allowEmpty: true, maxBytes: 32 * 1024 });
    const format = formats.includes(body.format as ExportFormat) ? (body.format as ExportFormat) : "markdown";
    const segments = await listDangerSegments();
    const segment = body.segmentId ? segments.find((item) => item.id === body.segmentId) : segments[0];

    if (!segment) return jsonError("No danger segment available for export.", 404);
    if (body.segmentId && !segments.some((item) => item.id === body.segmentId)) {
      return jsonError(`Danger segment ${body.segmentId} was not found.`, 404);
    }

    const events = await listEvents();
    const relatedEvents = events.filter((event) => segment.topTypes.includes(event.type));
    const eventsForReport = relatedEvents.length ? relatedEvents : events;
    const report =
      (process.env.ANTHROPIC_API_KEY ? await generateSafetyReportWithClaude(segment, eventsForReport).catch(() => null) : null) ??
      generateSafetyReport(segment, eventsForReport);
    const document = exportSafetyReport(format, report, segment, eventsForReport);

    return NextResponse.json({ report, segment, format, document });
  } catch (error) {
    return handleApiError(error, "Export report failed.");
  }
}
