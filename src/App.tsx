import { useCallback, useEffect, useMemo, useState } from "react";
import type { HazardEvent } from "./lib/contracts";
import { demoReplay } from "./lib/seed/demoReplay";
import { formatReplayTime, clampTime } from "./lib/replay/interpolate";
import { getNearestEvent, prepareReplay, colorForSeverity } from "./lib/replay/scene";
import { ReplayScene } from "./components/replay/ReplayScene";

const playbackRate = 1.4;

export function App() {
  const payload = demoReplay;
  const prepared = useMemo(() => prepareReplay(payload), [payload]);
  const [currentTime, setCurrentTime] = useState(prepared.highestRiskEvent.t);
  const [selectedEventId, setSelectedEventId] = useState(prepared.highestRiskEvent.id);
  const [isPlaying, setIsPlaying] = useState(false);

  const selectedEvent =
    payload.events.find((event) => event.id === selectedEventId) ?? prepared.highestRiskEvent;
  const activeEvent = getNearestEvent(payload.events, currentTime);

  const setReplayTime = useCallback(
    (nextTime: number) => {
      setCurrentTime(clampTime(payload.ride.route, nextTime));
    },
    [payload.ride.route]
  );

  const selectEvent = useCallback(
    (eventId: string, jumpToEvent: boolean) => {
      const event = payload.events.find((candidate) => candidate.id === eventId);
      if (!event) return;
      setSelectedEventId(eventId);

      if (jumpToEvent) {
        setIsPlaying(false);
        setReplayTime(event.t);
      }
    },
    [payload.events, setReplayTime]
  );

  useEffect(() => {
    if (!isPlaying) return;

    let animationFrame = 0;
    let lastFrameAt = performance.now();

    const tick = (now: number) => {
      const deltaSeconds = Math.min(0.08, (now - lastFrameAt) / 1000);
      lastFrameAt = now;

      setCurrentTime((previousTime) => {
        const nextTime = previousTime + deltaSeconds * playbackRate;
        return nextTime > prepared.maxTime ? prepared.minTime : nextTime;
      });

      animationFrame = requestAnimationFrame(tick);
    };

    animationFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrame);
  }, [isPlaying, prepared.maxTime, prepared.minTime]);

  return (
    <main className="app-shell">
      <section className="scene-shell" aria-label="Guardian Road 3D replay scene">
        <ReplayScene
          payload={payload}
          prepared={prepared}
          currentTime={currentTime}
          selectedEventId={selectedEventId}
          onSelectEvent={(eventId) => selectEvent(eventId, true)}
        />
      </section>

      <aside className="inspector-panel" aria-label="Replay inspector">
        <div className="brand-lockup">
          <span className="brand-mark" />
          <div>
            <p className="eyebrow">Guardian Road</p>
            <h1>3D Safety Replay</h1>
          </div>
        </div>

        <div className="metric-grid">
          <Metric label="Events" value={String(payload.ride.stats.eventCount)} />
          <Metric label="Max Risk" value={String(payload.ride.stats.maxRisk)} />
          <Metric label="Distance" value={`${payload.ride.stats.distanceMeters} m`} />
          <Metric label="Mode" value={payload.ride.mode.toUpperCase()} />
        </div>

        <section className="selected-event" aria-label="Selected event">
          <div className="section-title-row">
            <span>Selected Event</span>
            <button
              className="icon-button text-button"
              type="button"
              onClick={() => selectEvent(prepared.highestRiskEvent.id, true)}
            >
              Highest Risk
            </button>
          </div>
          <EventDetail event={selectedEvent} />
        </section>

        <section className="event-list-section" aria-label="Hazard events">
          <div className="section-title-row">
            <span>Hazard Timeline</span>
            <span className="subtle-label">{payload.events.length} saved</span>
          </div>
          <div className="event-list">
            {payload.events.map((event) => (
              <button
                key={event.id}
                type="button"
                className={[
                  "event-row",
                  event.id === selectedEventId ? "is-selected" : "",
                  event.id === activeEvent?.id ? "is-current" : ""
                ]
                  .filter(Boolean)
                  .join(" ")}
                data-event-id={event.id}
                onClick={() => selectEvent(event.id, true)}
              >
                <span className="risk-dot" style={{ background: colorForSeverity(event.severity) }} />
                <span className="event-copy">
                  <strong>{formatHazardType(event.type)}</strong>
                  <span>
                    {formatReplayTime(event.t)} · {event.camera} ·{" "}
                    {Math.round(event.confidence * 100)}%
                  </span>
                </span>
                <span className="event-score">{event.severity}</span>
              </button>
            ))}
          </div>
        </section>
      </aside>

      <section className="timeline-panel" aria-label="Replay timeline">
        <button
          className="play-button"
          type="button"
          aria-label={isPlaying ? "Pause replay" : "Play replay"}
          onClick={() => setIsPlaying((playing) => !playing)}
        >
          {isPlaying ? "Pause" : "Play"}
        </button>
        <div className="time-readout">
          <strong>{formatReplayTime(currentTime)}</strong>
          <span>/ {formatReplayTime(prepared.maxTime)}</span>
        </div>
        <input
          type="range"
          min={prepared.minTime}
          max={prepared.maxTime}
          value={currentTime}
          step={0.1}
          onChange={(event) => {
            setIsPlaying(false);
            setReplayTime(Number(event.currentTarget.value));
          }}
        />
        <div className="timeline-flags" aria-hidden="true">
          {payload.events.map((event) => (
            <button
              key={event.id}
              type="button"
              className={event.id === selectedEventId ? "timeline-flag is-selected" : "timeline-flag"}
              style={{
                left: `${((event.t - prepared.minTime) / (prepared.maxTime - prepared.minTime)) * 100}%`,
                background: colorForSeverity(event.severity)
              }}
              title={formatHazardType(event.type)}
              onClick={() => selectEvent(event.id, true)}
            />
          ))}
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function EventDetail({ event }: { event: HazardEvent }) {
  return (
    <div className="event-detail">
      <div className="detail-header">
        <div>
          <span
            className="severity-pill"
            style={{ borderColor: colorForSeverity(event.severity), color: colorForSeverity(event.severity) }}
          >
            Risk {event.severity}
          </span>
          <h2>{formatHazardType(event.type)}</h2>
        </div>
        <strong className="detail-time">{formatReplayTime(event.t)}</strong>
      </div>

      <p className="spoken-alert">{event.spokenAlert}</p>
      <p className="detail-explanation">{event.explanation}</p>

      <div className="fact-grid">
        <Fact label="Camera" value={event.camera} />
        <Fact label="Confidence" value={`${Math.round(event.confidence * 100)}%`} />
        <Fact label="Speed" value={`${event.speedMps.toFixed(1)} m/s`} />
        <Fact label="Objects" value={String(event.objects.length)} />
      </div>

      <div className="object-stack">
        {event.objects.map((object) => {
          const distance = object.distanceM ? `${object.distanceM.toFixed(1)} m` : "tracked";
          const ttc = object.ttcSec ? ` · TTC ${object.ttcSec.toFixed(1)}s` : "";

          return (
            <div key={object.id} className="object-row">
              <strong>{object.type}</strong>
              <span>
                {Math.round(object.confidence * 100)}% · {distance}
                {ttc}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatHazardType(type: string): string {
  return type.replaceAll("_", " ");
}
