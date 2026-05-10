import type { CameraRole, HazardEvent, HazardType, RideMode } from "@/lib/contracts";
import type { EventFiltersState } from "@/lib/records/filter-events";
import { hazardLabel } from "@/lib/records/format";

type EventFiltersProps = {
  filters: EventFiltersState;
  events: HazardEvent[];
  rideMode?: RideMode;
  onChange: (filters: EventFiltersState) => void;
};

const CAMERA_OPTIONS: Array<CameraRole | "all"> = ["all", "front", "rear", "dashcam"];
const MODE_OPTIONS: Array<RideMode | "all"> = ["all", "bike", "scooter", "car"];

export function EventFilters({ filters, events, rideMode, onChange }: EventFiltersProps) {
  const types = Array.from(new Set(events.map((event) => event.type))).sort() as HazardType[];

  return (
    <section className="border border-line bg-surface p-4">
      <div className="flex flex-col gap-2 border-b border-line pb-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-telemetry">Records filter</p>
          <h2 className="mt-1 text-lg font-semibold text-roadText">Hazard evidence feed</h2>
        </div>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-roadText-muted">
          Mode source: <span className="text-telemetry">{rideMode ?? "pending"}</span>
        </p>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[1.3fr_1fr_1fr_1fr_1fr]">
        <label className="grid gap-1 font-mono text-[10px] uppercase tracking-[0.18em] text-roadText-muted">
          Search
          <input
            value={filters.query}
            onChange={(event) => onChange({ ...filters, query: event.target.value })}
            placeholder="alert, street, event id"
            className="border border-line-strong bg-void px-3 py-2 font-sans text-sm normal-case tracking-normal text-roadText placeholder:text-roadText-dim"
          />
        </label>

        <label className="grid gap-1 font-mono text-[10px] uppercase tracking-[0.18em] text-roadText-muted">
          Type
          <select
            value={filters.type}
            onChange={(event) => onChange({ ...filters, type: event.target.value as EventFiltersState["type"] })}
            className="border border-line-strong bg-void px-3 py-2 font-sans text-sm normal-case tracking-normal text-roadText"
          >
            <option value="all">All types</option>
            {types.map((type) => (
              <option key={type} value={type}>
                {hazardLabel(type)}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 font-mono text-[10px] uppercase tracking-[0.18em] text-roadText-muted">
          Camera
          <select
            value={filters.camera}
            onChange={(event) => onChange({ ...filters, camera: event.target.value as EventFiltersState["camera"] })}
            className="border border-line-strong bg-void px-3 py-2 font-sans text-sm normal-case tracking-normal text-roadText"
          >
            {CAMERA_OPTIONS.map((camera) => (
              <option key={camera} value={camera}>
                {camera === "all" ? "All cameras" : camera}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 font-mono text-[10px] uppercase tracking-[0.18em] text-roadText-muted">
          Ride mode
          <select
            value={filters.mode}
            onChange={(event) => onChange({ ...filters, mode: event.target.value as EventFiltersState["mode"] })}
            className="border border-line-strong bg-void px-3 py-2 font-sans text-sm normal-case tracking-normal text-roadText"
          >
            {MODE_OPTIONS.map((mode) => (
              <option key={mode} value={mode}>
                {mode === "all" ? "All modes" : mode}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 font-mono text-[10px] uppercase tracking-[0.18em] text-roadText-muted">
          Min severity
          <input
            type="number"
            min={0}
            max={100}
            value={filters.minSeverity}
            onChange={(event) => onChange({ ...filters, minSeverity: Number(event.target.value) })}
            className="border border-line-strong bg-void px-3 py-2 font-sans text-sm normal-case tracking-normal text-roadText"
          />
        </label>
      </div>
    </section>
  );
}
