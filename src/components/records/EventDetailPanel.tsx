import type { HazardEvent } from "@/lib/contracts";
import {
  eventTelemetry,
  formatConfidence,
  formatLatLng,
  formatSpeed,
  formatTime,
  hazardLabel,
  riskLabel,
  riskTone,
} from "@/lib/records/format";

type EventDetailPanelProps = {
  event?: HazardEvent;
};

const toneClasses = {
  low: "border-line text-roadText-muted",
  medium: "border-amber/50 text-amber",
  high: "border-orange/60 text-orange",
  critical: "border-critical/70 text-critical",
};

export function EventDetailPanel({ event }: EventDetailPanelProps) {
  if (!event) {
    return (
      <aside className="border border-line bg-surface p-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-telemetry">Evidence inspector</p>
        <p className="mt-4 text-sm text-roadText-muted">Select an event from the ledger to inspect saved evidence.</p>
      </aside>
    );
  }

  const tone = riskTone(event.severity);

  return (
    <aside className="border border-line bg-surface">
      <div className="border-b border-line p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-telemetry">Evidence inspector</p>
            <h2 className="mt-2 text-2xl font-semibold text-roadText">{hazardLabel(event.type)}</h2>
          </div>
          <span className={`border px-2 py-1 font-mono text-xs uppercase tracking-[0.14em] ${toneClasses[tone]}`}>
            {riskLabel(event.severity)}
          </span>
        </div>
        <p className="mt-3 text-sm leading-6 text-roadText-muted">{event.explanation}</p>
      </div>

      <div className="p-5">
        <div className="border border-line-strong bg-void">
          {event.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={event.thumbnailUrl} alt={`Thumbnail for ${event.id}`} className="aspect-video w-full object-cover" />
          ) : (
            <div className="grid aspect-video place-items-center bg-[linear-gradient(rgba(34,211,238,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.06)_1px,transparent_1px)] bg-[length:28px_28px]">
              <div className="border border-line-strong bg-surface px-4 py-3 text-center">
                <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-roadText-muted">No clip thumbnail saved</p>
                <p className="mt-1 text-sm text-roadText">Telemetry record remains complete.</p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Metric label="Confidence" value={formatConfidence(event.confidence)} />
          <Metric label="Camera" value={event.camera} cyan />
          <Metric label="Heading" value={`${Math.round(event.headingDeg)}°`} />
          <Metric label="Speed" value={formatSpeed(event.speedMps)} />
          <Metric label="Timestamp" value={formatTime(event.timestamp)} wide />
          <Metric label="GPS" value={formatLatLng(event.lat, event.lng)} wide cyan />
        </div>

        <div className="mt-5 border border-line bg-void p-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-roadText-muted">Spoken warning</p>
          <p className="mt-2 text-lg font-medium text-roadText">{event.spokenAlert}</p>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-roadText-muted">Tracked objects</p>
            <a
              href={`/replay/${event.rideId}?event=${event.id}`}
              className="border border-amber/70 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-amber transition-colors hover:bg-amber hover:text-void"
            >
              Open in replay
            </a>
          </div>
          <div className="mt-3 divide-y divide-line border border-line">
            {event.objects.length > 0 ? (
              event.objects.map((object) => (
                <div key={object.id} className="grid grid-cols-[1fr_auto] gap-3 bg-void px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium text-roadText">{hazardLabel(object.type)}</p>
                    <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-roadText-dim">{object.id}</p>
                  </div>
                  <div className="text-right font-mono text-xs text-telemetry">
                    {formatConfidence(object.confidence)}
                    {object.distanceM ? <span className="block text-roadText-dim">{object.distanceM.toFixed(1)}m</span> : null}
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-void px-3 py-4 text-sm text-roadText-muted">No object tracks attached to this record.</div>
            )}
          </div>
        </div>

        <div className="mt-5 border border-line bg-void p-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-roadText-muted">Machine line</p>
          <p className="mt-2 font-mono text-xs leading-6 text-telemetry">{eventTelemetry(event).join("  /  ")}</p>
        </div>
      </div>
    </aside>
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
    <div className={`border border-line bg-void p-3 ${wide ? "col-span-2" : ""}`}>
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-roadText-dim">{label}</p>
      <p className={`mt-1 font-mono text-sm ${cyan ? "text-telemetry" : "text-roadText"}`}>{value}</p>
    </div>
  );
}
