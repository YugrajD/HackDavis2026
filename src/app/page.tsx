import Link from "next/link";

const endpoints = [
  { label: "Replay payload", method: "GET", href: "/api/replay/demo-ride-1" },
  { label: "Events feed", method: "GET", href: "/api/events?rideId=demo-ride-1" },
  { label: "Danger segments", method: "GET", href: "/api/danger-segments" },
  { label: "DB status", method: "GET", href: "/api/db/status" },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8 text-slate-100 sm:px-10 lg:px-12">
      <nav className="flex items-center justify-between border-b border-white/10 pb-5">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.32em] text-cyanline">Guardian Road</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Davis shared-road safety cockpit</h1>
        </div>
        <div className="hidden gap-3 text-sm text-slate-300 sm:flex">
          <Link className="rounded-full border border-white/15 px-4 py-2 hover:border-cyanline/70" href="/capture">
            Capture
          </Link>
          <Link className="rounded-full border border-white/15 px-4 py-2 hover:border-cyanline/70" href="/replay/demo-ride-1">
            Replay placeholder
          </Link>
          <Link className="rounded-full border border-white/15 px-4 py-2 hover:border-cyanline/70" href="/records">
            Records placeholder
          </Link>
        </div>
      </nav>

      <section className="grid flex-1 items-center gap-8 py-16 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <p className="mb-5 inline-flex rounded-full border border-cyanline/40 bg-cyanline/10 px-3 py-1 font-mono text-xs uppercase tracking-[0.22em] text-cyanline">
            seeded demo spine online
          </p>
          <h2 className="max-w-3xl text-5xl font-semibold tracking-[-0.04em] text-white sm:text-7xl">
            Phones become road safety sensors.
          </h2>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            Guardian Road collects rider and dashcam hazards, stores structured events, powers a 3D reconstruction, and turns repeated risk into Davis danger segments.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link className="rounded-full bg-cyanline px-5 py-3 text-sm font-semibold text-slate-950" href="/capture">
              Open capture sensor
            </Link>
            <Link className="rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white hover:border-warning/70" href="/api/replay/demo-ride-1">
              Inspect replay JSON
            </Link>
            <Link className="rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white hover:border-warning/70" href="/api/events?rideId=demo-ride-1">
              Inspect event feed
            </Link>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-panel/80 p-5 shadow-2xl shadow-black/30">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-slate-400">demo ride</p>
              <h3 className="mt-1 text-xl font-semibold">demo-ride-1</h3>
            </div>
            <span className="rounded-full bg-critical/15 px-3 py-1 font-mono text-sm text-red-200">max risk 94</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["events", "6"],
              ["segments", "3"],
              ["distance", "560m"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
                <p className="mt-2 text-2xl font-semibold">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 space-y-3">
            {endpoints.map((endpoint) => (
              <Link
                key={endpoint.href}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm hover:border-cyanline/60"
                href={endpoint.href}
              >
                <span>{endpoint.label}</span>
                <span className="font-mono text-xs text-slate-400">{endpoint.method}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
