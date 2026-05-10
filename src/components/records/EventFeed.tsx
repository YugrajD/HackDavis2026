import type { HazardEvent } from "@/lib/contracts";
import { formatConfidence, formatLatLng, formatTime, hazardLabel, riskLabel, riskTone } from "@/lib/records/format";

type EventFeedProps = {
  events: HazardEvent[];
  selectedEventId?: string;
  onSelect: (eventId: string) => void;
};

const toneClasses = {
  low: "border-line text-roadText-muted",
  medium: "border-amber/50 text-amber",
  high: "border-orange/60 text-orange",
  critical: "border-critical/70 text-critical",
};

export function EventFeed({ events, selectedEventId, onSelect }: EventFeedProps) {
  return (
    <section className="border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-telemetry">Event ledger</p>
          <h2 className="mt-1 text-lg font-semibold text-roadText">{events.length} matching records</h2>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse text-left text-sm">
          <thead className="border-b border-line bg-void/70 font-mono text-[10px] uppercase tracking-[0.18em] text-roadText-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Severity</th>
              <th className="px-4 py-3 font-medium">Hazard</th>
              <th className="px-4 py-3 font-medium">Time</th>
              <th className="px-4 py-3 font-medium">Camera</th>
              <th className="px-4 py-3 font-medium">Location</th>
              <th className="px-4 py-3 font-medium">Alert / explanation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {events.map((event) => {
              const tone = riskTone(event.severity);
              const selected = event.id === selectedEventId;

              return (
                <tr
                  key={event.id}
                  className={selected ? "bg-surface-hot" : "bg-surface transition-colors hover:bg-surface-raised"}
                >
                  <td className="px-4 py-3 align-top">
                    <button
                      type="button"
                      onClick={() => onSelect(event.id)}
                      className={`min-w-24 border px-2 py-1 text-left font-mono text-xs uppercase tracking-[0.14em] ${toneClasses[tone]}`}
                    >
                      {riskLabel(event.severity)}
                    </button>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <button type="button" onClick={() => onSelect(event.id)} className="text-left">
                      <span className="block font-medium text-roadText">{hazardLabel(event.type)}</span>
                      <span className="mt-1 block font-mono text-[11px] uppercase tracking-[0.16em] text-roadText-dim">
                        {event.id}
                      </span>
                    </button>
                  </td>
                  <td className="px-4 py-3 align-top font-mono text-xs text-roadText-muted">{formatTime(event.timestamp)}</td>
                  <td className="px-4 py-3 align-top font-mono text-xs uppercase tracking-[0.16em] text-telemetry">
                    {event.camera}
                    <span className="mt-1 block text-roadText-dim">{formatConfidence(event.confidence)}</span>
                  </td>
                  <td className="px-4 py-3 align-top font-mono text-xs text-roadText-muted">
                    {formatLatLng(event.lat, event.lng)}
                  </td>
                  <td className="max-w-[360px] px-4 py-3 align-top">
                    <p className="font-medium text-roadText">{event.spokenAlert}</p>
                    <p className="mt-1 line-clamp-2 text-roadText-muted">{event.explanation}</p>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {events.length === 0 ? (
        <div className="border-t border-line px-4 py-8 text-sm text-roadText-muted">
          No records match the active filters. Lower severity or clear the search string.
        </div>
      ) : null}
    </section>
  );
}
