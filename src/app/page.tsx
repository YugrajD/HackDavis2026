import Link from "next/link";
import { EndpointBoard } from "@/components/shell/EndpointBoard";
import { DemoControlPanel } from "@/components/shell/DemoControlPanel";

const sponsorCapabilities = [
  ["MongoDB Atlas", "persistence + geo index"],
  ["Gemini", "frame analysis"],
  ["Claude", "report generation"],
  ["ElevenLabs", "voice alerts"],
  ["YOLO sidecar", "perception"],
];

const demoStats = [
  ["events", "6"],
  ["segments", "3"],
  ["distance", "560m"],
  ["max risk", "94"],
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-5 py-8 sm:px-8 lg:px-12">
      <header className="flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-amber">guardian road</p>
          <h1 className="text-3xl font-semibold tracking-tight text-roadText sm:text-4xl">Davis shared-road safety operations</h1>
          <p className="max-w-2xl text-sm leading-6 text-roadText-muted">
            Phones become hazard sensors. Events stream into Atlas, perception runs on a YOLO sidecar, Gemini classifies risk, Claude generates incident reports, ElevenLabs voices the alert.
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <span className="border border-amber/60 bg-surface-hot px-3 py-1 font-mono text-[10px] uppercase tracking-[0.3em] text-amber">demo ops · live</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-roadText-dim">build · hackdavis 2026</span>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-6">
          <div className="border border-line bg-surface p-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-roadText-muted">primary actions</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-roadText">Bring a sensor online</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-roadText-muted">
              Open the capture sensor on a phone or laptop. Start a ride, capture a hazard frame, and the pipeline writes a structured event with audio alert.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/capture"
                className="inline-flex min-h-[44px] items-center border border-amber bg-amber px-5 py-2 font-mono text-xs uppercase tracking-[0.22em] text-void transition-colors duration-150 ease-out hover:bg-orange"
              >
                Open capture sensor
              </Link>
              <Link
                href="/records"
                className="inline-flex min-h-[44px] items-center border border-line-strong px-5 py-2 font-mono text-xs uppercase tracking-[0.22em] text-roadText transition-colors duration-150 ease-out hover:border-amber/60 hover:text-amber"
              >
                Records console
              </Link>
              <Link
                href="/replay/demo-ride-1"
                className="inline-flex min-h-[44px] items-center border border-line-strong px-5 py-2 font-mono text-xs uppercase tracking-[0.22em] text-roadText transition-colors duration-150 ease-out hover:border-amber/60 hover:text-amber"
              >
                Replay console
              </Link>
            </div>
          </div>

          <div className="border border-line bg-surface">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-roadText-muted">demo ride</p>
              <p className="font-mono text-xs text-telemetry">demo-ride-1</p>
            </div>
            <div className="grid grid-cols-2 divide-x divide-line border-b border-line sm:grid-cols-4">
              {demoStats.map(([label, value]) => (
                <div key={label} className="px-4 py-4">
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-roadText-dim">{label}</p>
                  <p className={`mt-1 text-2xl font-semibold tabular-nums ${label === "max risk" ? "text-amber" : "text-roadText"}`}>{value}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 divide-x divide-line sm:grid-cols-5">
              {sponsorCapabilities.map(([name, role]) => (
                <div key={name} className="px-4 py-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-telemetry">{name}</p>
                  <p className="mt-1 text-[11px] leading-tight text-roadText-muted">{role}</p>
                </div>
              ))}
            </div>
          </div>

          <DemoControlPanel />
        </div>

        <EndpointBoard />
      </section>

      <footer className="mt-auto flex flex-col gap-2 border-t border-line pt-4 text-[11px] text-roadText-dim sm:flex-row sm:items-center sm:justify-between">
        <p className="font-mono uppercase tracking-[0.22em]">civic safety telemetry · davis</p>
        <p className="font-mono uppercase tracking-[0.22em]">amber = action · cyan = telemetry · orange = severity</p>
      </footer>
    </main>
  );
}
