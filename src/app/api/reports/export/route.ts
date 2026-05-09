import { NextResponse } from "next/server";
import type { DangerSegment, HazardEvent, ReportExportFormat } from "@/lib/contracts";
import { handleApiError, jsonError, readJsonBody } from "@/lib/api/responses";
import { generateSafetyReport, generateSafetyReportWithClaude } from "@/lib/ai/report";
import { getSponsorConfig } from "@/lib/config/server";
import { listDangerSegments, listEvents } from "@/lib/db/repository";
import { resolveDangerSegment } from "@/lib/geo/danger-segments";
import { buildReportExportPayload, type ExportFormat } from "@/lib/reports/export";

const formats: ExportFormat[] = ["markdown", "html", "csv", "pdf-text"];

type ReportExportRequest = {
  segmentId?: string;
  segment?: DangerSegment;
  events?: HazardEvent[];
  format?: ReportExportFormat;
};

export async function POST(request: Request) {
  try {
    const body = await readJsonBody<ReportExportRequest>(request, { allowEmpty: true, maxBytes: 256 * 1024 });
    const format = formats.includes(body.format as ExportFormat) ? (body.format as ExportFormat) : "markdown";
    const segments = await listDangerSegments();
    const requestedSegment = body.segmentId ? resolveDangerSegment(segments, body.segmentId) : undefined;

    if (body.segmentId && !requestedSegment && !body.segment) {
      return jsonError(`Danger segment ${body.segmentId} was not found.`, 404);
    }

    const segment = body.segment ?? requestedSegment ?? segments[0];
    if (!segment) return jsonError("No danger segment available for export.", 404);

    const eventPool = Array.isArray(body.events) ? body.events.slice(0, 100) : await listEvents();
    const relatedEvents = eventPool.filter((event) => segment.topTypes.includes(event.type));
    const eventsForReport = relatedEvents.length ? relatedEvents : eventPool;
    const claudeReport = getSponsorConfig().anthropic.apiKey ? await generateSafetyReportWithClaude(segment, eventsForReport).catch(() => null) : null;
    const report = claudeReport ?? generateSafetyReport(segment, eventsForReport);
    const exportPayload = buildReportExportPayload(format, report, segment, eventsForReport);

    return NextResponse.json({ ...exportPayload, provider: claudeReport ? "claude" : "stub" });
  } catch (error) {
    return handleApiError(error, "Export report failed.");
  }
}
