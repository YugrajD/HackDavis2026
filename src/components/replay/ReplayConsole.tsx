"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { HazardEvent, ReplayPayload, RoutePoint } from "@/lib/contracts";
import { interpolateRoutePoint, latLngToMeters, projectReplayPayload } from "@/lib/replay/coordinates";

type ReplayFetchState = {
  endpoint: string;
  ok: boolean;
  status: number | null;
  statusText: string;
  receivedAt: string;
  error?: string;
};

type ReplayConsoleProps = {
  rideId: string;
  payload: ReplayPayload | null;
  fetchState: ReplayFetchState;
  initialEventId?: string;
};

const timelineStepSeconds = 0.5;

export function ReplayConsole({ rideId, payload, fetchState, initialEventId }: ReplayConsoleProps) {
  const projected = useMemo(() => (payload ? projectReplayPayload(payload) : null), [payload]);
  const highestRiskEvent = useMemo(() => getHighestRiskEvent(payload?.events ?? []), [payload]);
  const initialSelectedEventId = initialEventId ?? highestRiskEvent?.id ?? payload?.events[0]?.id ?? null;
  const [selectedEventId, setSelectedEventId] = useState<string | null>(initialSelectedEventId);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => {
    const initialEvent = payload?.events.find((event) => event.id === initialSelectedEventId);
    return initialEvent?.t ?? payload?.ride.route[0]?.t ?? 0;
  });

  const durationSec = useMemo(() => getReplayDuration(payload), [payload]);
  const selectedEvent = payload?.events.find((event) => event.id === selectedEventId) ?? highestRiskEvent ?? null;
  const interpolated = useMemo(() => (payload ? interpolateRoutePoint(payload.ride.route, currentTime) : null), [payload, currentTime]);
  const riderScreen = useMemo(() => {
    if (!payload || !projected || !interpolated) return null;
    const meters = latLngToMeters(interpolated.lat, interpolated.lng, projected.origin.lat, projected.origin.lng);
    const width = Math.max(projected.bounds.maxX - projected.bounds.minX, 1);
    const height = Math.max(projected.bounds.maxZ - projected.bounds.minZ, 1);

    return {
      xPct: ((meters.x - projected.bounds.minX) / width) * 100,
      yPct: ((meters.z - projected.bounds.minZ) / height) * 100,
      headingDeg: interpolated.headingDeg,
      speedMps: interpolated.speedMps,
    };
  }, [interpolated, payload, projected]);

  useEffect(() => {
    if (!playing || !payload) return;

    const timer = window.setInterval(() => {
      setCurrentTime((time) => {
        const nextTime = Number((time + timelineStepSeconds).toFixed(1));
        return nextTime >= durationSec ? 0 : nextTime;
      });
    }, 220);

    return () => window.clearInterval(timer);
  }, [durationSec, payload, playing]);

  if (!payload || !projected) {
    return (
      <ReplayShell rideId={rideId} fetchState={fetchState}>
        <section className="border border-line bg-surface p-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-critical">payload unavailable</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-roadText">Replay data did not load.</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-roadText-muted">
            The replay console only reads <span className="font-mono text-telemetry">{fetchState.endpoint}</span>. Seed the demo or check the backend response, then reload this page.
          </p>
          <PayloadStateCard payload={payload} state={fetchState} />
        </section>
      </ReplayShell>
    );
  }

  const routePoints = projected.route.map((point) => `${point.screen.xPct.toFixed(2)},${point.screen.yPct.toFixed(2)}`).join(" ");
  const selectedProjectedEvent = projected.events.find(({ event }) => event.id === selectedEvent?.id) ?? null;
  const sortedEvents = [...payload.events].sort((a, b) => a.t - b.t || b.severity - a.severity);

  function chooseEvent(event: HazardEvent) {
    setSelectedEventId(event.id);
    setCurrentTime(event.t);
    setPlaying(false);
  }

  function jumpToHighestRisk() {
    if (!highestRiskEvent) return;
    chooseEvent(highestRiskEvent);
  }

  return (
    <ReplayShell rideId={rideId} fetchState={fetchState}>
      <section className="grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.8fr)]">
        <div className="space-y-5">
          <div className="border border-line bg-surface">
            <div className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-roadText-muted">route reconstruction</p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight text-roadText">{payload.ride.id}</h2>
              </div>
              <div className="grid grid-cols-3 gap-2 text-right font-mono text-[10px] uppercase tracking-[0.18em] text-roadText-dim sm:min-w-80">
                <Metric label="mode" value={payload.ride.mode} tone="cyan" />
                <Metric label="distance" value={`${Math.round(payload.ride.stats.distanceMeters)}m`} />
                <Metric label="max risk" value={String(payload.ride.stats.maxRisk)} tone="amber" />
              </div>
            </div>

            <div className="relative min-h-[440px] overflow-hidden bg-void">
              <div className="absolute inset-0 opacity-70" style={gridStyle} aria-hidden="true" />
              <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Projected route with hazard events and danger segments">
                {projected.dangerSegments.map(({ segment, screen }) => (
                  <circle
                    key={segment.id}
                    cx={screen.xPct}
                    cy={screen.yPct}
                    r={Math.max(5, Math.min(16, segment.score / 7))}
                    fill={segment.score >= 90 ? "rgba(251, 78, 27, 0.14)" : "rgba(245, 158, 11, 0.12)"}
                    stroke={segment.score >= 90 ? "rgba(251, 78, 27, 0.72)" : "rgba(245, 158, 11, 0.68)"}
                    strokeWidth="0.35"
                  />
                ))}
                {routePoints.length > 0 ? (
                  <polyline points={routePoints} fill="none" stroke="rgba(232, 237, 240, 0.9)" strokeWidth="0.85" vectorEffect="non-scaling-stroke" />
                ) : null}
                {routePoints.length > 0 ? (
                  <polyline points={routePoints} fill="none" stroke="rgba(34, 211, 238, 0.52)" strokeWidth="2.2" vectorEffect="non-scaling-stroke" strokeLinecap="square" />
                ) : null}
              </svg>

              {projected.events.map(({ event, screen }) => {
                const active = selectedEvent?.id === event.id;
                return (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => chooseEvent(event)}
                    className={`absolute z-20 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center border bg-void font-mono text-[10px] tabular-nums transition-colors duration-150 ${markerClass(event.severity, active)}`}
                    style={{ left: `${screen.xPct}%`, top: `${screen.yPct}%` }}
                    aria-label={`Select ${formatHazardType(event.type)} event at ${formatTime(event.t)}`}
                  >
                    {Math.round(event.severity)}
                  </button>
                );
              })}

              {riderScreen ? (
                <div
                  className="absolute z-30 h-9 w-9 -translate-x-1/2 -translate-y-1/2 border border-telemetry bg-void shadow-[0_0_0_2px_rgba(34,211,238,0.15)]"
                  style={{ left: `${riderScreen.xPct}%`, top: `${riderScreen.yPct}%` }}
                  aria-label="Current rider position"
                >
                  <div className="absolute left-1/2 top-1/2 h-1 w-11 origin-left bg-telemetry/70" style={{ transform: `rotate(${riderScreen.headingDeg - 90}deg)` }} />
                  <div className="absolute inset-2 border border-telemetry bg-surface" />
                </div>
              ) : null}

              <div className="absolute left-4 top-4 z-40 border border-line-strong bg-void/90 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-roadText-muted">
                t <span className="text-telemetry">{formatTime(currentTime)}</span> · speed <span className="text-telemetry">{riderScreen ? `${riderScreen.speedMps.toFixed(1)} m/s` : "n/a"}</span>
              </div>
              <div className="absolute bottom-4 right-4 z-40 max-w-xs border border-line bg-void/90 px-3 py-2 text-[11px] leading-5 text-roadText-muted">
                <span className="font-mono uppercase tracking-[0.2em] text-roadText-dim">legend</span> route is cyan/white, amber is high-risk, orange-red is critical, cyan vector is camera heading.
              </div>
            </div>
          </div>

          <TimelinePanel
            currentTime={currentTime}
            durationSec={durationSec}
            events={sortedEvents}
            playing={playing}
            selectedEventId={selectedEvent?.id ?? null}
            onEventSelect={chooseEvent}
            onHighestRisk={jumpToHighestRisk}
            onPlayToggle={() => setPlaying((value) => !value)}
            onTimeChange={(time) => {
              setCurrentTime(time);
              setPlaying(false);
            }}
          />
        </div>

        <aside className="space-y-5">
          <EventDetailPanel event={selectedEvent} projectedEvent={selectedProjectedEvent} />
          <DangerSegmentsPanel payload={payload} selectedEvent={selectedEvent} />
          <PayloadStateCard payload={payload} state={fetchState} />
        </aside>
      </section>
    </ReplayShell>
  );
}

function ReplayShell({ rideId, fetchState, children }: { rideId: string; fetchState: ReplayFetchState; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-5 py-6 sm:px-8 lg:px-10">
      <header className="border-b border-line pb-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-amber">guardian road replay</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-roadText sm:text-4xl">Safety reconstruction console</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-roadText-muted">
              Ride route, hazard events, danger segments, object tracks, and the raw API state from <span className="font-mono text-telemetry">GET /api/replay/{rideId}</span>.
            </p>
          </div>
          <div className="grid gap-2 font-mono text-[10px] uppercase tracking-[0.22em] sm:grid-cols-2 lg:min-w-96">
            <span className="border border-line-strong px-3 py-2 text-roadText-muted">ride <span className="text-telemetry">{rideId}</span></span>
            <span className={`border px-3 py-2 ${fetchState.ok ? "border-telemetry/50 text-telemetry" : "border-critical/60 text-critical"}`}>
              api {fetchState.status ?? "network"} {fetchState.ok ? "ready" : "failed"}
            </span>
          </div>
        </div>
      </header>
      {children}
    </main>
  );
}

function TimelinePanel({
  currentTime,
  durationSec,
  events,
  playing,
  selectedEventId,
  onEventSelect,
  onHighestRisk,
  onPlayToggle,
  onTimeChange,
}: {
  currentTime: number;
  durationSec: number;
  events: HazardEvent[];
  playing: boolean;
  selectedEventId: string | null;
  onEventSelect: (event: HazardEvent) => void;
  onHighestRisk: () => void;
  onPlayToggle: () => void;
  onTimeChange: (time: number) => void;
}) {
  return (
    <section className="border border-line bg-surface">
      <div className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-roadText-muted">route / event timeline</p>
          <p className="mt-1 font-mono text-xs text-telemetry">{formatTime(currentTime)} / {formatTime(durationSec)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onPlayToggle} className="min-h-11 border border-amber bg-amber px-4 py-2 font-mono text-[10px] uppercase tracking-[0.22em] text-void transition-colors duration-150 hover:bg-orange">
            {playing ? "pause" : "play"}
          </button>
          <button type="button" onClick={onHighestRisk} className="min-h-11 border border-line-strong px-4 py-2 font-mono text-[10px] uppercase tracking-[0.22em] text-roadText transition-colors duration-150 hover:border-amber hover:text-amber">
            highest risk
          </button>
        </div>
      </div>

      <div className="space-y-4 p-4">
        <div className="relative h-12 border border-line bg-void px-3 py-2">
          <input
            aria-label="Replay timeline scrubber"
            type="range"
            min={0}
            max={Math.max(durationSec, 1)}
            step={timelineStepSeconds}
            value={Math.min(currentTime, Math.max(durationSec, 1))}
            onChange={(event) => onTimeChange(Number(event.currentTarget.value))}
            className="absolute left-3 right-3 top-1/2 z-10 h-1 -translate-y-1/2 appearance-none bg-line-strong accent-amber"
          />
          {events.map((event) => {
            const left = durationSec > 0 ? (event.t / durationSec) * 100 : 0;
            return (
              <button
                key={event.id}
                type="button"
                onClick={() => onEventSelect(event)}
                className={`absolute top-1/2 z-20 h-6 w-2 -translate-x-1/2 -translate-y-1/2 border ${event.id === selectedEventId ? "border-roadText bg-amber" : event.severity >= 90 ? "border-critical bg-critical" : "border-amber bg-amber/80"}`}
                style={{ left: `${Math.max(2, Math.min(98, left))}%` }}
                aria-label={`Jump to ${formatHazardType(event.type)} at ${formatTime(event.t)}`}
              />
            );
          })}
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          {events.map((event) => (
            <button
              key={event.id}
              type="button"
              onClick={() => onEventSelect(event)}
              className={`border p-3 text-left transition-colors duration-150 ${event.id === selectedEventId ? "border-amber bg-surface-hot" : "border-line bg-void hover:border-line-strong"}`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-telemetry">{formatTime(event.t)}</span>
                <span className={`font-mono text-xs tabular-nums ${severityTextClass(event.severity)}`}>{Math.round(event.severity)}</span>
              </div>
              <p className="mt-2 text-sm font-medium text-roadText">{formatHazardType(event.type)}</p>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-roadText-muted">{event.spokenAlert}</p>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function EventDetailPanel({ event, projectedEvent }: { event: HazardEvent | null; projectedEvent: { meters: { x: number; z: number } } | null }) {
  if (!event) {
    return (
      <section className="border border-line bg-surface p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-roadText-muted">event detail</p>
        <p className="mt-3 text-sm text-roadText-muted">No event selected.</p>
      </section>
    );
  }

  return (
    <section className="border border-line bg-surface">
      <div className="border-b border-line px-4 py-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-roadText-muted">event detail</p>
        <div className="mt-2 flex items-start justify-between gap-3">
          <h2 className="text-xl font-semibold tracking-tight text-roadText">{formatHazardType(event.type)}</h2>
          <span className={`border px-2 py-1 font-mono text-xs tabular-nums ${severityBadgeClass(event.severity)}`}>{Math.round(event.severity)}</span>
        </div>
      </div>
      <div className="space-y-4 p-4">
        <p className="border-l-2 border-amber pl-3 text-sm leading-6 text-roadText">{event.spokenAlert}</p>
        <p className="text-sm leading-6 text-roadText-muted">{event.explanation}</p>
        <div className="grid grid-cols-2 gap-2 font-mono text-[10px] uppercase tracking-[0.18em]">
          <Fact label="event" value={event.id} tone="cyan" />
          <Fact label="time" value={formatTime(event.t)} />
          <Fact label="camera" value={event.camera} />
          <Fact label="confidence" value={`${Math.round(event.confidence * 100)}%`} />
          <Fact label="lat" value={event.lat.toFixed(5)} tone="cyan" />
          <Fact label="lng" value={event.lng.toFixed(5)} tone="cyan" />
          <Fact label="heading" value={`${Math.round(event.headingDeg)}°`} />
          <Fact label="speed" value={`${event.speedMps.toFixed(1)} m/s`} />
          {projectedEvent ? <Fact label="x/z meters" value={`${projectedEvent.meters.x.toFixed(1)} / ${projectedEvent.meters.z.toFixed(1)}`} tone="cyan" /> : null}
          {event.clipUrl ? <Fact label="clip" value={event.clipUrl} tone="cyan" /> : null}
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-roadText-muted">tracked objects</p>
          <div className="mt-2 space-y-2">
            {event.objects.length > 0 ? (
              event.objects.map((object) => (
                <div key={object.id} className="border border-line bg-void px-3 py-2">
                  <div className="flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.18em]">
                    <span className="text-telemetry">{object.type}</span>
                    <span className="text-roadText-muted">{Math.round(object.confidence * 100)}%</span>
                  </div>
                  <p className="mt-1 text-xs text-roadText-dim">
                    {object.distanceM ? `${object.distanceM.toFixed(1)}m away` : "distance n/a"}
                    {object.ttcSec ? ` · ttc ${object.ttcSec.toFixed(1)}s` : ""}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-xs text-roadText-dim">No tracked objects attached to this event.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function DangerSegmentsPanel({ payload, selectedEvent }: { payload: ReplayPayload; selectedEvent: HazardEvent | null }) {
  return (
    <section className="border border-line bg-surface">
      <div className="border-b border-line px-4 py-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-roadText-muted">danger segments</p>
        <p className="mt-1 text-xs text-roadText-dim">Clustered street risk from the replay payload.</p>
      </div>
      <div className="divide-y divide-line">
        {payload.dangerSegments.map((segment) => (
          <article key={segment.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-roadText">{segment.label}</h3>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-telemetry">{segment.id}</p>
              </div>
              <span className={`border px-2 py-1 font-mono text-xs tabular-nums ${severityBadgeClass(segment.score)}`}>{Math.round(segment.score)}</span>
            </div>
            <p className="mt-3 text-xs leading-5 text-roadText-muted">{segment.explanation}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {segment.topTypes.map((type) => (
                <span key={`${segment.id}-${type}`} className={`border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] ${selectedEvent?.type === type ? "border-amber text-amber" : "border-line-strong text-roadText-muted"}`}>
                  {formatHazardType(type)}
                </span>
              ))}
            </div>
            <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-roadText-dim">
              {segment.eventCount} events · last seen {new Date(segment.lastSeen).toLocaleString()}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function PayloadStateCard({ payload, state }: { payload: ReplayPayload | null; state: ReplayFetchState }) {
  return (
    <section className="border border-line bg-surface">
      <div className="border-b border-line px-4 py-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-roadText-muted">api payload state</p>
        <p className="mt-1 font-mono text-xs text-telemetry">GET {state.endpoint}</p>
      </div>
      <div className="space-y-3 p-4">
        <div className="grid grid-cols-2 gap-2 font-mono text-[10px] uppercase tracking-[0.18em]">
          <Fact label="http" value={state.status ? `${state.status} ${state.statusText}` : state.statusText} tone={state.ok ? "cyan" : "critical"} />
          <Fact label="received" value={new Date(state.receivedAt).toLocaleTimeString()} />
          <Fact label="ride" value={payload?.ride.id ?? "none"} tone="cyan" />
          <Fact label="events" value={String(payload?.events.length ?? 0)} />
          <Fact label="segments" value={String(payload?.dangerSegments.length ?? 0)} />
          <Fact label="generated" value={payload ? new Date(payload.generatedAt).toLocaleTimeString() : "n/a"} />
        </div>
        {state.error ? <p className="border border-critical/60 bg-void p-3 text-xs leading-5 text-critical">{state.error}</p> : null}
        <details className="border border-line bg-void">
          <summary className="cursor-pointer px-3 py-2 font-mono text-[10px] uppercase tracking-[0.22em] text-roadText-muted">inspect json</summary>
          <pre className="max-h-80 overflow-auto border-t border-line p-3 text-[11px] leading-5 text-roadText-muted">{JSON.stringify(payload ?? state, null, 2)}</pre>
        </details>
      </div>
    </section>
  );
}

function Metric({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "amber" | "cyan" }) {
  return (
    <div className="border border-line bg-void px-3 py-2">
      <p className="text-roadText-dim">{label}</p>
      <p className={`mt-1 text-sm tabular-nums ${tone === "amber" ? "text-amber" : tone === "cyan" ? "text-telemetry" : "text-roadText"}`}>{value}</p>
    </div>
  );
}

function Fact({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "cyan" | "critical" }) {
  return (
    <div className="border border-line bg-void px-3 py-2">
      <p className="text-roadText-dim">{label}</p>
      <p className={`mt-1 break-words text-xs normal-case tracking-normal tabular-nums ${tone === "cyan" ? "text-telemetry" : tone === "critical" ? "text-critical" : "text-roadText"}`}>{value}</p>
    </div>
  );
}

function getReplayDuration(payload?: ReplayPayload | null) {
  if (!payload) return 0;
  const routeEnd = payload.ride.route[payload.ride.route.length - 1]?.t ?? payload.ride.stats.durationSec;
  const eventEnd = payload.events.reduce((max, event) => Math.max(max, event.t), 0);
  return Math.max(routeEnd, eventEnd, payload.ride.stats.durationSec, 1);
}

function getHighestRiskEvent(events: HazardEvent[]) {
  return events.reduce<HazardEvent | null>((highest, event) => {
    if (!highest) return event;
    return event.severity > highest.severity ? event : highest;
  }, null);
}

function formatHazardType(type: string) {
  return type.replaceAll("_", " ");
}

function formatTime(seconds: number) {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const remaining = Math.floor(safeSeconds % 60);
  return `${minutes}:${remaining.toString().padStart(2, "0")}`;
}

function severityTextClass(score: number) {
  if (score >= 90) return "text-critical";
  if (score >= 70) return "text-amber";
  return "text-telemetry";
}

function severityBadgeClass(score: number) {
  if (score >= 90) return "border-critical/70 bg-critical/10 text-critical";
  if (score >= 70) return "border-amber/70 bg-surface-hot text-amber";
  return "border-telemetry/60 bg-void text-telemetry";
}

function markerClass(score: number, active: boolean) {
  if (active) return "border-roadText bg-amber text-void";
  if (score >= 90) return "border-critical text-critical hover:bg-critical hover:text-void";
  if (score >= 70) return "border-amber text-amber hover:bg-amber hover:text-void";
  return "border-telemetry text-telemetry hover:bg-telemetry hover:text-void";
}

const gridStyle: CSSProperties = {
  backgroundImage:
    "linear-gradient(rgba(148, 163, 184, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.06) 1px, transparent 1px)",
  backgroundSize: "32px 32px",
};
