import Link from "next/link";

type Endpoint = {
  method: "GET" | "POST" | "PATCH";
  path: string;
  label: string;
  href?: string;
};

const endpoints: Endpoint[] = [
  { method: "GET", path: "/api/replay/demo-ride-1", label: "replay payload", href: "/api/replay/demo-ride-1" },
  { method: "GET", path: "/api/events?rideId=demo-ride-1", label: "events feed", href: "/api/events?rideId=demo-ride-1" },
  { method: "GET", path: "/api/danger-segments", label: "danger segments", href: "/api/danger-segments" },
  { method: "GET", path: "/api/providers/status", label: "provider status", href: "/api/providers/status" },
  { method: "GET", path: "/api/health/readiness", label: "readiness probe", href: "/api/health/readiness" },
  { method: "POST", path: "/api/seed/demo", label: "seed demo dataset" },
];

export function EndpointBoard() {
  return (
    <div className="border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-roadText-muted">endpoint board</p>
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-roadText-dim">live</p>
      </div>
      <ul className="divide-y divide-line">
        {endpoints.map((endpoint) => {
          const row = (
            <div className="grid grid-cols-[64px_1fr_auto] items-center gap-3 px-4 py-3 transition-colors duration-150 ease-out hover:bg-surface-raised">
              <span className={`font-mono text-[11px] tracking-wider ${methodColor(endpoint.method)}`}>{endpoint.method}</span>
              <span className="truncate font-mono text-xs text-telemetry">{endpoint.path}</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-roadText-dim">{endpoint.label}</span>
            </div>
          );
          return (
            <li key={endpoint.path}>
              {endpoint.href ? (
                <Link href={endpoint.href} className="block focus-visible:bg-surface-raised">
                  {row}
                </Link>
              ) : (
                <div className="cursor-default">{row}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function methodColor(method: Endpoint["method"]) {
  if (method === "POST") return "text-amber";
  if (method === "PATCH") return "text-orange";
  return "text-roadText-muted";
}
