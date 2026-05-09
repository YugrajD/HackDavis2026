import type { DangerSegment, HazardEvent, ReportExportFormat, ReportExportPayload, SafetyReport } from "@/lib/contracts";
import { dangerSegmentsToHotspots, hotspotCsv } from "@/lib/geo/hotspots";

export type ExportFormat = ReportExportFormat;

export function exportSafetyReport(format: ExportFormat, report: SafetyReport, segment: DangerSegment, events: HazardEvent[]) {
  if (format === "csv") return hotspotCsv(events, dangerSegmentsToHotspots([segment], events));
  if (format === "html") return safetyReportHtml(report, segment, events);
  if (format === "pdf-text") return safetyReportPdfText(report, segment, events);
  return safetyReportMarkdown(report, segment, events);
}

export function buildReportExportPayload(format: ExportFormat, report: SafetyReport, segment: DangerSegment, events: HazardEvent[]): ReportExportPayload {
  return {
    report,
    segment,
    format,
    document: exportSafetyReport(format, report, segment, events),
    filename: reportFilename(segment, format),
    contentType: contentTypeFor(format),
    generatedAt: report.generatedAt,
    events: events.slice(0, 50).map((event) => ({
      id: event.id,
      timestamp: event.timestamp,
      type: event.type,
      severity: event.severity,
      lat: event.lat,
      lng: event.lng,
      camera: event.camera,
      explanation: event.explanation,
    })),
  };
}

export function safetyReportMarkdown(report: SafetyReport, segment: DangerSegment, events: HazardEvent[]) {
  const evidence = report.evidence.map((item) => `- ${item}`).join("\n");
  const fixes = report.recommendedFixes.map((item) => `- ${item}`).join("\n");
  const eventRows = events
    .slice(0, 12)
    .map((event) => `| ${event.timestamp} | ${event.type.replaceAll("_", " ")} | ${event.severity} | ${event.lat.toFixed(5)}, ${event.lng.toFixed(5)} |`)
    .join("\n");

  return `# ${report.title}\n\n${report.summary}\n\nGenerated: ${report.generatedAt}\n\n## Segment\n\n- Label: ${segment.label}\n- Score: ${segment.score}/100\n- Event count: ${segment.eventCount}\n- Center: ${segment.centerLat.toFixed(6)}, ${segment.centerLng.toFixed(6)}\n\n## Evidence\n\n${evidence}\n\n## Recommended fixes\n\n${fixes}\n\n## Event table\n\n| Time | Type | Severity | Location |\n|---|---:|---:|---|\n${eventRows}\n`;
}

export function safetyReportHtml(report: SafetyReport, segment: DangerSegment, events: HazardEvent[]) {
  const evidence = report.evidence.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const fixes = report.recommendedFixes.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const eventRows = events
    .slice(0, 12)
    .map(
      (event) =>
        `<tr><td>${escapeHtml(event.timestamp)}</td><td>${escapeHtml(event.type.replaceAll("_", " "))}</td><td>${event.severity}</td><td>${event.lat.toFixed(5)}, ${event.lng.toFixed(5)}</td></tr>`,
    )
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(report.title)}</title><style>body{font-family:Arial,sans-serif;margin:32px;color:#111}h1{font-size:28px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:8px;text-align:left}.score{font-weight:700}</style></head><body><h1>${escapeHtml(report.title)}</h1><p>${escapeHtml(report.summary)}</p><p>Generated: ${escapeHtml(report.generatedAt)}</p><h2>Segment</h2><p>${escapeHtml(segment.label)} <span class="score">${segment.score}/100</span><br>${segment.centerLat.toFixed(6)}, ${segment.centerLng.toFixed(6)}</p><h2>Evidence</h2><ul>${evidence}</ul><h2>Recommended fixes</h2><ul>${fixes}</ul><h2>Events</h2><table><thead><tr><th>Time</th><th>Type</th><th>Severity</th><th>Location</th></tr></thead><tbody>${eventRows}</tbody></table></body></html>`;
}

export function safetyReportPdfText(report: SafetyReport, segment: DangerSegment, events: HazardEvent[]) {
  const lines = [
    "GUARDIAN ROAD CIVIC SAFETY REPORT",
    "==================================",
    "",
    report.title.toUpperCase(),
    `Generated: ${report.generatedAt}`,
    `Segment: ${segment.label}`,
    `Risk score: ${segment.score}/100`,
    `Center: ${segment.centerLat.toFixed(6)}, ${segment.centerLng.toFixed(6)}`,
    "",
    "SUMMARY",
    wrap(report.summary, 88),
    "",
    "EVIDENCE",
    ...report.evidence.map((item, index) => `${index + 1}. ${wrap(item, 84, 3)}`),
    "",
    "RECOMMENDED FIXES",
    ...report.recommendedFixes.map((item, index) => `${index + 1}. ${wrap(item, 84, 3)}`),
    "",
    "EVENT APPENDIX",
    ...events.slice(0, 12).map((event) => `${event.timestamp}  ${event.type.replaceAll("_", " ").padEnd(24)} severity ${String(event.severity).padStart(3)}  ${event.lat.toFixed(5)}, ${event.lng.toFixed(5)}`),
    "",
    "END OF REPORT",
  ];

  return `${lines.join("\n")}\n`;
}

function reportFilename(segment: DangerSegment, format: ExportFormat) {
  const extension = format === "html" ? "html" : format === "csv" ? "csv" : format === "pdf-text" ? "txt" : "md";
  return `${segment.id}-guardian-road-report.${extension}`;
}

function contentTypeFor(format: ExportFormat) {
  if (format === "html") return "text/html; charset=utf-8";
  if (format === "csv") return "text/csv; charset=utf-8";
  if (format === "pdf-text") return "text/plain; charset=utf-8";
  return "text/markdown; charset=utf-8";
}

function wrap(value: string, width: number, indent = 0) {
  const prefix = " ".repeat(indent);
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > width && current) {
      lines.push(current);
      current = `${prefix}${word}`;
    } else {
      current = next;
    }
  }

  if (current) lines.push(current);
  return lines.join("\n");
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
