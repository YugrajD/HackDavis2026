import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { PROVIDER_NAMES } from "@/lib/contracts";
import type { DangerSegment, HazardEvent, ReportExportFormat } from "@/lib/contracts";
import { ApiError, handleApiError, jsonError, readJsonBody, requireJsonObject } from "@/lib/api/responses";
import { generateSafetyReport, generateSafetyReportWithClaude } from "@/lib/ai/report";
import { getSponsorConfig, getStorageConfig } from "@/lib/config/server";
import { listDangerSegments, listEvents } from "@/lib/db/repository";
import { resolveDangerSegment } from "@/lib/geo/danger-segments";
import { buildReportExportPayload, type ExportFormat } from "@/lib/reports/export";

export const runtime = "nodejs";

const formats: ExportFormat[] = ["markdown", "html", "csv", "pdf-text"];
let ensureReportDirPromise: Promise<void> | null = null;

type ReportExportRequest = {
  segmentId?: string;
  segment?: DangerSegment;
  events?: HazardEvent[];
  format?: ReportExportFormat;
};

export async function POST(request: Request) {
  try {
    const body = requireJsonObject<ReportExportRequest>(await readJsonBody<unknown>(request, { allowEmpty: true, maxBytes: 256 * 1024 }));
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
    const exportUrl = await persistReportExport(exportPayload.filename, exportPayload.document);

    return NextResponse.json({ ...exportPayload, exportUrl, provider: claudeReport ? PROVIDER_NAMES.claude : PROVIDER_NAMES.stub });
  } catch (error) {
    return handleApiError(error, "Export report failed.");
  }
}

async function persistReportExport(filename: string, document: string) {
  const { reports } = getStorageConfig();
  if (!ensureReportDirPromise) {
    ensureReportDirPromise = mkdir(reports.exportRoot, { recursive: true }).then(() => undefined);
  }
  await ensureReportDirPromise;

  const filepath = safeGeneratedPath(reports.exportRoot, filename);
  const tempPath = safeGeneratedPath(reports.exportRoot, `.${filename}.${process.pid}.${Date.now()}.tmp`, { allowDotfile: true });
  await writeFile(tempPath, document, "utf8");
  await rename(tempPath, filepath);
  return `${reports.publicPrefix}/${filename}`;
}

function safeGeneratedPath(root: string, filename: string, options: { allowDotfile?: boolean } = {}) {
  if (path.basename(filename) !== filename || (!options.allowDotfile && filename.startsWith("."))) {
    throw new ApiError(400, "Report filename is invalid.");
  }

  const rootPath = path.resolve(root);
  const filepath = path.resolve(rootPath, filename);
  if (!filepath.startsWith(`${rootPath}${path.sep}`)) {
    throw new ApiError(400, "Report filename is invalid.");
  }

  return filepath;
}
