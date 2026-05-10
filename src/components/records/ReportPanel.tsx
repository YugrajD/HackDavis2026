import type { DangerSegment, ReportExportPayload, SafetyReport } from "@/lib/contracts";
import { formatTime, hazardLabel, riskLabel } from "@/lib/records/format";

type ReportPanelProps = {
  segment?: DangerSegment;
  report?: SafetyReport;
  exportPayload?: ReportExportPayload;
  provider?: string;
  busyAction?: "report" | "export";
  error?: string;
  onGenerateReport: () => void;
  onExportReport: () => void;
  onCopy: () => void;
};

export function ReportPanel({
  segment,
  report,
  exportPayload,
  provider,
  busyAction,
  error,
  onGenerateReport,
  onExportReport,
  onCopy,
}: ReportPanelProps) {
  return (
    <section className="border border-line bg-surface">
      <div className="border-b border-line p-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-telemetry">Report export</p>
        <div className="mt-1 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-roadText">Civic safety packet</h2>
            <p className="mt-1 text-sm text-roadText-muted">
              {segment ? `${segment.label} / ${riskLabel(segment.score)}` : "Select a segment to generate a report."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onGenerateReport}
              disabled={!segment || Boolean(busyAction)}
              className="border border-amber bg-amber px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-void transition-opacity disabled:cursor-not-allowed disabled:opacity-45"
            >
              {busyAction === "report" ? "Generating" : "Generate report"}
            </button>
            <button
              type="button"
              onClick={onExportReport}
              disabled={!segment || Boolean(busyAction)}
              className="border border-line-strong px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-roadText transition-colors hover:border-telemetry hover:text-telemetry disabled:cursor-not-allowed disabled:opacity-45"
            >
              {busyAction === "export" ? "Exporting" : "Export pdf-text"}
            </button>
            <button
              type="button"
              onClick={onCopy}
              disabled={!report && !exportPayload?.document}
              className="border border-line-strong px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-roadText-muted transition-colors hover:text-roadText disabled:cursor-not-allowed disabled:opacity-45"
            >
              Copy
            </button>
          </div>
        </div>
      </div>

      {error ? <div className="border-b border-critical/40 bg-critical/10 px-4 py-3 text-sm text-critical">{error}</div> : null}

      <div className="grid gap-4 p-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="border border-line bg-void p-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-roadText-muted">Segment dossier</p>
          {segment ? (
            <>
              <h3 className="mt-3 text-xl font-semibold text-roadText">{segment.label}</h3>
              <p className="mt-2 text-sm leading-6 text-roadText-muted">{segment.explanation}</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Metric label="Score" value={Math.round(segment.score).toString()} />
                <Metric label="Events" value={segment.eventCount.toString()} cyan />
                <Metric label="Last seen" value={formatTime(segment.lastSeen)} wide />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {segment.topTypes.map((type) => (
                  <span key={type} className="border border-line-strong px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-telemetry">
                    {hazardLabel(type)}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <p className="mt-3 text-sm text-roadText-muted">No selected danger segment.</p>
          )}
        </div>

        <div className="border border-line bg-void p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-roadText-muted">Report preview</p>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-telemetry">Provider {provider ?? "standby"}</p>
          </div>

          {exportPayload?.document ? (
            <pre className="mt-4 max-h-[420px] overflow-auto whitespace-pre-wrap border border-line bg-surface p-4 font-mono text-xs leading-6 text-roadText">
              {exportPayload.document}
            </pre>
          ) : report ? (
            <article className="mt-4 space-y-4 text-sm leading-6 text-roadText-muted">
              <div>
                <h3 className="text-xl font-semibold text-roadText">{report.title}</h3>
                <p className="mt-2">{report.summary}</p>
              </div>
              <ListBlock title="Evidence" items={report.evidence} />
              <ListBlock title="Recommended fixes" items={report.recommendedFixes} />
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-roadText-dim">
                Generated {formatTime(report.generatedAt)} / Segment {report.segmentId}
              </p>
            </article>
          ) : (
            <div className="mt-4 border border-dashed border-line-strong p-6 text-sm leading-6 text-roadText-muted">
              Generate a report to call <span className="font-mono text-telemetry">POST /api/ai/report</span>, then export to call{" "}
              <span className="font-mono text-telemetry">POST /api/reports/export</span>.
            </div>
          )}

          {exportPayload?.exportUrl ? (
            <a
              href={exportPayload.exportUrl}
              className="mt-4 inline-block border border-telemetry px-3 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-telemetry transition-colors hover:bg-telemetry hover:text-void"
            >
              Open persisted export
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}

type MetricProps = {
  label: string;
  value: string;
  cyan?: boolean;
  wide?: boolean;
};

function Metric({ label, value, cyan = false, wide = false }: MetricProps) {
  return (
    <div className={`border border-line bg-surface p-3 ${wide ? "col-span-2" : ""}`}>
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-roadText-dim">{label}</p>
      <p className={`mt-1 font-mono text-sm ${cyan ? "text-telemetry" : "text-roadText"}`}>{value}</p>
    </div>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-roadText-dim">{title}</p>
      <ul className="mt-2 list-inside list-disc space-y-1">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
