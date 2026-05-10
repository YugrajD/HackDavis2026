import type { DangerSegment } from "@/lib/contracts";
import { hazardLabel, riskLabel, riskTone, segmentTelemetry } from "@/lib/records/format";

type DangerSegmentListProps = {
  segments: DangerSegment[];
  selectedSegmentId?: string;
  onSelect: (segmentId: string) => void;
};

const toneClasses = {
  low: "border-line text-roadText-muted",
  medium: "border-amber/50 text-amber",
  high: "border-orange/60 text-orange",
  critical: "border-critical/70 text-critical",
};

const fixCopy = {
  low: "Monitor after next ride batch.",
  medium: "Review signage and sightline friction.",
  high: "Prioritize paint, buffers, and enforcement review.",
  critical: "Escalate for corridor intervention and rapid field check.",
};

export function DangerSegmentList({ segments, selectedSegmentId, onSelect }: DangerSegmentListProps) {
  return (
    <section className="border border-line bg-surface">
      <div className="border-b border-line px-4 py-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-telemetry">Danger segments</p>
        <h2 className="mt-1 text-lg font-semibold text-roadText">Street risk clusters</h2>
      </div>

      <div className="divide-y divide-line">
        {segments.map((segment) => {
          const tone = riskTone(segment.score);
          const selected = segment.id === selectedSegmentId;

          return (
            <button
              key={segment.id}
              type="button"
              onClick={() => onSelect(segment.id)}
              className={`block w-full p-4 text-left transition-colors hover:bg-surface-raised ${selected ? "bg-surface-hot" : "bg-surface"}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold text-roadText">{segment.label}</h3>
                  <p className="mt-2 text-sm leading-6 text-roadText-muted">{segment.explanation}</p>
                </div>
                <span className={`shrink-0 border px-2 py-1 font-mono text-xs uppercase tracking-[0.14em] ${toneClasses[tone]}`}>
                  {riskLabel(segment.score)}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {segment.topTypes.map((type) => (
                  <span key={type} className="border border-line-strong px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-roadText-muted">
                    {hazardLabel(type)}
                  </span>
                ))}
              </div>

              <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-telemetry">
                {segmentTelemetry(segment).join("  /  ")}
              </p>
              <p className="mt-3 border-l-2 border-amber/60 pl-3 text-sm text-roadText">
                Recommended fix: {fixCopy[tone]}
              </p>
            </button>
          );
        })}
      </div>

      {segments.length === 0 ? <div className="px-4 py-8 text-sm text-roadText-muted">No danger segments returned.</div> : null}
    </section>
  );
}
