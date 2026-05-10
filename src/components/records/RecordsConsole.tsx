"use client";

import { useEffect, useMemo, useState } from "react";
import type { DangerSegment, HazardEvent, ReportExportPayload, Ride, SafetyReport } from "@/lib/contracts";
import { DangerSegmentList } from "@/components/records/DangerSegmentList";
import { EventDetailPanel } from "@/components/records/EventDetailPanel";
import { EventFeed } from "@/components/records/EventFeed";
import { EventFilters } from "@/components/records/EventFilters";
import { ReportPanel } from "@/components/records/ReportPanel";
import { DEFAULT_EVENT_FILTERS, filterEvents } from "@/lib/records/filter-events";
import { formatDuration, formatTime, riskLabel } from "@/lib/records/format";

const DEMO_RIDE_ID = "demo-ride-1";

type EventsResponse = { events: HazardEvent[] };
type DangerSegmentsResponse = { dangerSegments: DangerSegment[] };
type RideResponse = { ride: Ride };
type ReportResponse = { report: SafetyReport; provider?: string };
type ExportResponse = ReportExportPayload & { provider?: string };

type LoadState = "loading" | "ready" | "error";
type BusyAction = "report" | "export";

export function RecordsConsole() {
  const [events, setEvents] = useState<HazardEvent[]>([]);
  const [segments, setSegments] = useState<DangerSegment[]>([]);
  const [ride, setRide] = useState<Ride>();
  const [filters, setFilters] = useState(DEFAULT_EVENT_FILTERS);
  const [selectedEventId, setSelectedEventId] = useState<string>();
  const [selectedSegmentId, setSelectedSegmentId] = useState<string>();
  const [report, setReport] = useState<SafetyReport>();
  const [exportPayload, setExportPayload] = useState<ReportExportPayload>();
  const [provider, setProvider] = useState<string>();
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState<string>();
  const [reportError, setReportError] = useState<string>();
  const [busyAction, setBusyAction] = useState<BusyAction>();

  useEffect(() => {
    let cancelled = false;

    async function loadRecords() {
      setLoadState("loading");
      setLoadError(undefined);

      try {
        const [eventsResponse, segmentsResponse, rideResponse] = await Promise.all([
          fetchJson<EventsResponse>(`/api/events?rideId=${DEMO_RIDE_ID}`),
          fetchJson<DangerSegmentsResponse>("/api/danger-segments"),
          fetchJson<RideResponse>(`/api/rides/${DEMO_RIDE_ID}`),
        ]);

        if (cancelled) return;

        setEvents(eventsResponse.events);
        setSegments(segmentsResponse.dangerSegments);
        setRide(rideResponse.ride);

        const requestedEventId = new URLSearchParams(window.location.search).get("event");
        const requestedSegmentId = new URLSearchParams(window.location.search).get("segment");
        const nextEvent = requestedEventId && eventsResponse.events.some((event) => event.id === requestedEventId)
          ? requestedEventId
          : eventsResponse.events[0]?.id;
        const nextSegment = requestedSegmentId && segmentsResponse.dangerSegments.some((segment) => segment.id === requestedSegmentId)
          ? requestedSegmentId
          : segmentsResponse.dangerSegments[0]?.id;

        setSelectedEventId(nextEvent);
        setSelectedSegmentId(nextSegment);
        setLoadState("ready");
      } catch (error) {
        if (cancelled) return;
        setLoadState("error");
        setLoadError(error instanceof Error ? error.message : "Records API request failed.");
      }
    }

    void loadRecords();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredEvents = useMemo(() => filterEvents(events, filters, ride?.mode), [events, filters, ride?.mode]);
  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? filteredEvents[0],
    [events, filteredEvents, selectedEventId],
  );
  const selectedSegment = useMemo(
    () => segments.find((segment) => segment.id === selectedSegmentId) ?? segments[0],
    [segments, selectedSegmentId],
  );
  const maxSeverity = events.reduce((max, event) => Math.max(max, event.severity), 0);
  const maxSegmentScore = segments.reduce((max, segment) => Math.max(max, segment.score), 0);

  async function generateReport() {
    if (!selectedSegment) return;

    setBusyAction("report");
    setReportError(undefined);
    setExportPayload(undefined);

    try {
      const response = await fetchJson<ReportResponse>("/api/ai/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segmentId: selectedSegment.id }),
      });
      setReport(response.report);
      setProvider(response.provider);
    } catch (error) {
      setReportError(error instanceof Error ? error.message : "Report generation failed.");
    } finally {
      setBusyAction(undefined);
    }
  }

  async function exportReport() {
    if (!selectedSegment) return;

    setBusyAction("export");
    setReportError(undefined);

    try {
      const response = await fetchJson<ExportResponse>("/api/reports/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segmentId: selectedSegment.id, format: "pdf-text" }),
      });
      setReport(response.report);
      setExportPayload(response);
      setProvider(response.provider);
    } catch (error) {
      setReportError(error instanceof Error ? error.message : "Report export failed.");
    } finally {
      setBusyAction(undefined);
    }
  }

  async function copyReport() {
    const text = exportPayload?.document ?? (report ? reportToText(report) : "");
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      setReportError(undefined);
    } catch {
      setReportError("Clipboard permission was denied. Use the export link or select the preview text.");
    }
  }

  function selectSegment(segmentId: string) {
    setSelectedSegmentId(segmentId);
    setReport(undefined);
    setExportPayload(undefined);
    setProvider(undefined);
    setReportError(undefined);
  }

  return (
    <main className="min-h-screen px-4 py-6 text-roadText sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <header className="border border-line bg-void p-5 md:p-6">
          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-telemetry">Guardian Road / Records</p>
              <h1 className="mt-3 max-w-4xl text-4xl font-semibold tracking-[-0.04em] text-roadText md:text-6xl">
                Safety records console
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-roadText-muted">
                Evidence feed, danger-segment queue, and exportable civic report for the Davis demo ride.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:w-[560px]">
              <Metric label="Ride" value={ride?.id ?? DEMO_RIDE_ID} cyan />
              <Metric label="Events" value={events.length.toString()} />
              <Metric label="Max event risk" value={riskLabel(maxSeverity)} amber />
              <Metric label="Max segment" value={riskLabel(maxSegmentScore)} amber />
            </div>
          </div>

          <div className="mt-5 grid gap-2 border-t border-line pt-4 font-mono text-[11px] uppercase tracking-[0.16em] text-roadText-muted md:grid-cols-4">
            <p>
              Mode <span className="text-telemetry">{ride?.mode ?? "pending"}</span>
            </p>
            <p>
              Duration <span className="text-roadText">{ride ? formatDuration(ride.stats.durationSec) : "--"}</span>
            </p>
            <p>
              Distance <span className="text-roadText">{ride ? `${Math.round(ride.stats.distanceMeters)}m` : "--"}</span>
            </p>
            <p>
              Started <span className="text-roadText">{ride ? formatTime(ride.startedAt) : "--"}</span>
            </p>
          </div>
        </header>

        {loadState === "error" ? (
          <section className="border border-critical/50 bg-critical/10 p-5 text-critical">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em]">Records API offline</p>
            <p className="mt-2 text-sm">{loadError}</p>
            <p className="mt-3 font-mono text-xs text-roadText-muted">Expected demo sequence: POST /api/seed/demo, then GET /api/events and /api/danger-segments.</p>
          </section>
        ) : null}

        {loadState === "loading" ? (
          <section className="border border-line bg-surface p-8 text-sm text-roadText-muted">
            Loading seeded records from <span className="font-mono text-telemetry">/api/events</span> and{" "}
            <span className="font-mono text-telemetry">/api/danger-segments</span>.
          </section>
        ) : null}

        <EventFilters filters={filters} events={events} rideMode={ride?.mode} onChange={setFilters} />

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
          <EventFeed events={filteredEvents} selectedEventId={selectedEvent?.id} onSelect={setSelectedEventId} />
          <EventDetailPanel event={selectedEvent} />
        </div>

        <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
          <DangerSegmentList segments={segments} selectedSegmentId={selectedSegment?.id} onSelect={selectSegment} />
          <ReportPanel
            segment={selectedSegment}
            report={report}
            exportPayload={exportPayload}
            provider={provider}
            busyAction={busyAction}
            error={reportError}
            onGenerateReport={generateReport}
            onExportReport={exportReport}
            onCopy={copyReport}
          />
        </div>
      </div>
    </main>
  );
}

async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, { ...init, cache: "no-store" });
  const body = await response.json().catch(() => undefined) as { error?: string; message?: string } | undefined;

  if (!response.ok) {
    throw new Error(body?.error ?? body?.message ?? `${response.status} ${response.statusText}`);
  }

  return body as T;
}

function reportToText(report: SafetyReport) {
  return [
    report.title,
    "",
    report.summary,
    "",
    "Evidence:",
    ...report.evidence.map((item) => `- ${item}`),
    "",
    "Recommended fixes:",
    ...report.recommendedFixes.map((item) => `- ${item}`),
  ].join("\n");
}

type MetricProps = {
  label: string;
  value: string;
  cyan?: boolean;
  amber?: boolean;
};

function Metric({ label, value, cyan = false, amber = false }: MetricProps) {
  const color = cyan ? "text-telemetry" : amber ? "text-amber" : "text-roadText";

  return (
    <div className="border border-line bg-surface p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-roadText-dim">{label}</p>
      <p className={`mt-1 truncate font-mono text-sm ${color}`}>{value}</p>
    </div>
  );
}
