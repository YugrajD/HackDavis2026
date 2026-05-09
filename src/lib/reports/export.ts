import type { DangerSegment, HazardEvent } from "@/lib/contracts";
import type { SafetyReport } from "@/lib/ai/report";
import { dangerSegmentsToHotspots, hotspotCsv } from "@/lib/geo/hotspots";

export type ExportFormat = "markdown" | "html" | "csv";

export function exportSafetyReport(format: ExportFormat, report: SafetyReport, segment: DangerSegment, events: HazardEvent[]) {
  if (format === "csv") return hotspotCsv(events, dangerSegmentsToHotspots([segment], events));
  if (format === "html") return safetyReportHtml(report, segment, events);
  return safetyReportMarkdown(report, segment, events);
}

export function safetyReportMarkdown(report: SafetyReport, segment: DangerSegment, events: HazardEvent[]) {
  const evidence = report.evidence.map((item) => `- ${item}`).join("\n");
  const fixes = report.recommendedFixes.map((item) => `- ${item}`).join("\n");
  const eventRows = events
    .slice(0, 12)
    .map((event) => `| ${event.timestamp} | ${event.type.replaceAll("_", " ")} | ${event.severity} | ${event.lat.toFixed(5)}, ${event.lng.toFixed(5)} |`)
    .join("\n");

  return `# ${report.title}\n\n${report.summary}\n\n## Segment\n\n- Label: ${segment.label}\n- Score: ${segment.score}/100\n- Event count: ${segment.eventCount}\n- Center: ${segment.centerLat.toFixed(6)}, ${segment.centerLng.toFixed(6)}\n\n## Evidence\n\n${evidence}\n\n## Recommended fixes\n\n${fixes}\n\n## Event table\n\n| Time | Type | Severity | Location |\n|---|---:|---:|---|\n${eventRows}\n`;
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

  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(report.title)}</title><style>body{font-family:Arial,sans-serif;margin:32px;color:#111}h1{font-size:28px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:8px;text-align:left}.score{font-weight:700}</style></head><body><h1>${escapeHtml(report.title)}</h1><p>${escapeHtml(report.summary)}</p><h2>Segment</h2><p>${escapeHtml(segment.label)} <span class="score">${segment.score}/100</span><br>${segment.centerLat.toFixed(6)}, ${segment.centerLng.toFixed(6)}</p><h2>Evidence</h2><ul>${evidence}</ul><h2>Recommended fixes</h2><ul>${fixes}</ul><h2>Events</h2><table><thead><tr><th>Time</th><th>Type</th><th>Severity</th><th>Location</th></tr></thead><tbody>${eventRows}</tbody></table></body></html>`;
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
