"use client";

import { useState } from "react";

type CheckState = "idle" | "running" | "ok" | "warn" | "error";

type CheckResult = {
  state: CheckState;
  message: string;
  detail?: string;
};

const initial: CheckResult = { state: "idle", message: "not run" };

export function DemoControlPanel() {
  const [providers, setProviders] = useState<CheckResult>(initial);
  const [readiness, setReadiness] = useState<CheckResult>(initial);
  const [seed, setSeed] = useState<CheckResult>(initial);

  async function checkProviders() {
    setProviders({ state: "running", message: "fetching" });
    try {
      const res = await fetch("/api/providers/status", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setProviders({ state: "error", message: `http ${res.status}`, detail: typeof json.error === "string" ? json.error : undefined });
        return;
      }
      const detail = summariseProviders(json);
      const degraded = detail.degraded.length > 0;
      setProviders({
        state: degraded ? "warn" : "ok",
        message: degraded ? `${detail.degraded.length} degraded` : "all providers ready",
        detail: detail.summary,
      });
    } catch (error) {
      setProviders({ state: "error", message: errorMessage(error) });
    }
  }

  async function checkReadiness() {
    setReadiness({ state: "running", message: "probing" });
    try {
      const res = await fetch("/api/health/readiness", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setReadiness({ state: "error", message: `http ${res.status}`, detail: typeof json.error === "string" ? json.error : undefined });
        return;
      }
      const ready = json?.ready === true || json?.status === "ready";
      setReadiness({
        state: ready ? "ok" : "warn",
        message: ready ? "ready" : "not ready",
        detail: typeof json?.detail === "string" ? json.detail : JSON.stringify(json).slice(0, 160),
      });
    } catch (error) {
      setReadiness({ state: "error", message: errorMessage(error) });
    }
  }

  async function seedDemo() {
    setSeed({ state: "running", message: "seeding" });
    try {
      const res = await fetch("/api/seed/demo", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSeed({ state: "error", message: `http ${res.status}`, detail: typeof json.error === "string" ? json.error : undefined });
        return;
      }
      setSeed({
        state: "ok",
        message: "seeded",
        detail: typeof json?.message === "string" ? json.message : `events ${json?.events ?? "?"} · segments ${json?.segments ?? "?"}`,
      });
    } catch (error) {
      setSeed({ state: "error", message: errorMessage(error) });
    }
  }

  return (
    <div className="border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-roadText-muted">preflight controls</p>
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-roadText-dim">manual</p>
      </div>
      <div className="grid gap-px bg-line sm:grid-cols-3">
        <ControlCell title="providers" result={providers} onRun={checkProviders} runLabel="Check providers" />
        <ControlCell title="readiness" result={readiness} onRun={checkReadiness} runLabel="Check readiness" />
        <ControlCell title="seed demo" result={seed} onRun={seedDemo} runLabel="Seed demo" />
      </div>
    </div>
  );
}

function ControlCell({ title, result, onRun, runLabel }: { title: string; result: CheckResult; onRun: () => void; runLabel: string }) {
  return (
    <div className="flex min-h-[160px] flex-col justify-between bg-surface p-4">
      <div>
        <div className="flex items-center justify-between">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-roadText-dim">{title}</p>
          <StateLabel state={result.state} />
        </div>
        <p className="mt-3 font-mono text-xs text-roadText" aria-live="polite">{result.message}</p>
        {result.detail ? <p className="mt-2 break-words font-mono text-[11px] leading-snug text-roadText-muted">{result.detail}</p> : null}
      </div>
      <button
        type="button"
        onClick={onRun}
        disabled={result.state === "running"}
        className="mt-3 inline-flex min-h-[44px] items-center justify-center border border-line-strong px-3 py-2 font-mono text-[11px] uppercase tracking-[0.22em] text-roadText transition-colors duration-150 ease-out hover:border-amber/60 hover:text-amber disabled:cursor-not-allowed disabled:opacity-60"
      >
        {result.state === "running" ? "running" : runLabel}
      </button>
    </div>
  );
}

function StateLabel({ state }: { state: CheckState }) {
  const map: Record<CheckState, { text: string; color: string }> = {
    idle: { text: "idle", color: "text-roadText-dim" },
    running: { text: "running", color: "text-telemetry" },
    ok: { text: "ok", color: "text-roadText" },
    warn: { text: "warn", color: "text-amber" },
    error: { text: "error", color: "text-critical" },
  };
  const entry = map[state];
  return <span className={`font-mono text-[10px] uppercase tracking-[0.3em] ${entry.color}`}>{entry.text}</span>;
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "request failed";
}

function summariseProviders(payload: unknown): { degraded: string[]; summary: string } {
  if (!payload || typeof payload !== "object") return { degraded: [], summary: "" };
  const obj = payload as Record<string, unknown>;
  const providersField = (obj.providers ?? obj) as Record<string, unknown>;
  const degraded: string[] = [];
  const lines: string[] = [];

  for (const [name, raw] of Object.entries(providersField)) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const status = String(item.status ?? item.state ?? (item.ok ? "ready" : "unknown"));
    if (status !== "ready" && status !== "ok" && status !== "configured") degraded.push(name);
    lines.push(`${name}: ${status}`);
  }

  return { degraded, summary: lines.join(" · ") };
}
