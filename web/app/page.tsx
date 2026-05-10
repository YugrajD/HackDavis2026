import ScrollVideo from "./ScrollVideo";

type Feature = {
  tag: string;
  title: string;
  body: string;
  bg: string;
  fg: string;
  swatch: string;
};

const features: Feature[] = [
  {
    tag: "01 / detect",
    title: "Hazards spotted before you can react.",
    body: "Front and rear cameras run in parallel through a YOLOv8 perception loop with LiDAR scene-depth fusion. Close passes, doorings, blocked bike lanes, and pedestrian conflicts get flagged in real time.",
    bg: "bg-deep-forest",
    fg: "text-paper-white",
    swatch: "bg-harvest-gold",
  },
  {
    tag: "02 / alert",
    title: "A voice you can actually hear over wind.",
    body: "ElevenLabs speaks a short, tuned warning the moment a hazard crosses threshold. Say \"save clip\" and the rolling 60-second buffer is locked, uploaded, and added to your gallery.",
    bg: "bg-sage-mist",
    fg: "text-graphite",
    swatch: "bg-indigo-punch",
  },
  {
    tag: "03 / archive",
    title: "Evidence with GPS, heading, and speed attached.",
    body: "Every saved clip lands in MongoDB Atlas with a 2dsphere geo index, a thumbnail, and full telemetry. Replay any ride in 3D from the records console; export the report as a PDF.",
    bg: "bg-desert-rose",
    fg: "text-graphite",
    swatch: "bg-terracotta",
  },
  {
    tag: "04 / aggregate",
    title: "Repeated near-misses become a danger zone.",
    body: "When the same corridor lights up across riders, the records console aggregates events into geofenced danger segments and Claude generates a corridor safety report city traffic engineers can actually use.",
    bg: "bg-paper-white",
    fg: "text-graphite",
    swatch: "bg-deep-forest",
  },
];

export default function Page() {
  return (
    <main className="min-h-screen bg-canvas text-graphite">
      {/* Nav */}
      <header className="sticky top-0 z-20 bg-canvas/85 backdrop-blur border-b border-graphite/8">
        <nav className="max-w-[1280px] mx-auto px-6 md:px-10 h-[72px] flex items-center justify-between">
          <a href="#" className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-indigo-punch" />
            <span className="font-mono text-[13px] tracking-[-0.04em]">
              guardian road / v0.1
            </span>
          </a>
          <div className="hidden md:flex items-center gap-8 text-[15px] tracking-[0.02em] font-light">
            <a href="#features" className="hover:text-indigo-punch transition">Product</a>
            <a href="#how" className="hover:text-indigo-punch transition">How it works</a>
            <a
              href="https://github.com/YugrajD/HackDavis2026"
              target="_blank"
              rel="noreferrer"
              className="hover:text-indigo-punch transition"
            >
              GitHub
            </a>
          </div>
          <a
            href="https://github.com/YugrajD/HackDavis2026"
            target="_blank"
            rel="noreferrer"
            className="hidden sm:inline-flex items-center rounded-[100px] border border-ink-black px-5 py-2 text-[14px] hover:bg-ink-black hover:text-paper-white transition"
          >
            GitHub
          </a>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative">
        <div className="max-w-[1280px] mx-auto px-6 md:px-10 pt-20 md:pt-28 pb-20 md:pb-28">
          <div className="grid grid-cols-12 gap-6 items-end">
            <div className="col-span-12 lg:col-span-8">
              <p className="font-mono text-[12px] uppercase tracking-[0.08em] text-ash-gray mb-8">
                hackdavis · 2026
              </p>
              <h1 className="font-display text-[44px] sm:text-[64px] md:text-[88px] lg:text-[120px] leading-[0.94] tracking-[-0.03em]">
                Cyclists die.
                <br />
                Cities don&apos;t hear about it.
              </h1>
            </div>
            <div className="col-span-12 lg:col-span-4">
              <p className="text-[16px] leading-[1.54] text-graphite/80 max-w-md">
                Guardian Road is a phone-mounted hazard dashcam for bikes,
                scooters, and cars. It detects close passes in real time,
                speaks the alert, saves a clip, and gives the city the
                heatmap to fix the street.
              </p>
              <div className="mt-8 flex items-center gap-3 flex-wrap">
                <a
                  href="#features"
                  className="rounded-[100px] border border-ink-black text-ink-black px-6 py-[14px] text-[14px] hover:bg-ink-black hover:text-paper-white transition"
                >
                  See product
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Scroll-triggered videos */}
      <section className="bg-canvas">
        <div className="max-w-[1280px] mx-auto px-6 md:px-10 pb-[72px] md:pb-[120px]">
          <div className="flex items-end justify-between flex-wrap gap-6 mb-10">
            <div>
              <p className="font-mono text-[12px] uppercase tracking-[0.08em] text-ash-gray mb-4">
                / live demo
              </p>
              <h2 className="font-display text-[40px] md:text-[64px] leading-[0.94] tracking-[-0.03em] max-w-2xl">
                See it on the road.
              </h2>
            </div>
            <p className="max-w-sm text-[16px] leading-[1.54] text-graphite/70">
              Two clips straight from an iPhone. The left shows the app in
              motion; the right shows the depth-aware feed mid-ride, with
              the multicam preview and live YOLO overlay.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative rounded-[12px] overflow-hidden border border-graphite/10 bg-graphite mx-auto w-full" style={{ maxWidth: 420 }}>
              <ScrollVideo src="/demo.mov" className="w-full h-auto block" />
              <span className="absolute top-4 left-4 font-mono text-[12px] uppercase tracking-[0.08em] text-paper-white/90 bg-graphite/60 backdrop-blur px-3 py-1.5 rounded-[100px]">
                app preview
              </span>
            </div>
            <div className="relative rounded-[12px] overflow-hidden border border-graphite/10 bg-graphite mx-auto w-full" style={{ maxWidth: 420 }}>
              <ScrollVideo src="/preview.mov" className="w-full h-auto block" />
              <span className="absolute top-4 left-4 font-mono text-[12px] uppercase tracking-[0.08em] text-paper-white/90 bg-graphite/60 backdrop-blur px-3 py-1.5 rounded-[100px]">
                on the road
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section id="features" className="bg-canvas">
        <div className="max-w-[1280px] mx-auto px-6 md:px-10 pb-[72px] md:pb-[120px]">
          <div className="flex items-end justify-between flex-wrap gap-6 mb-16">
            <div>
              <p className="font-mono text-[12px] uppercase tracking-[0.08em] text-ash-gray mb-4">
                / product
              </p>
              <h2 className="font-display text-[40px] md:text-[64px] leading-[0.94] tracking-[-0.03em] max-w-2xl">
                One pipeline, three sensor classes.
              </h2>
            </div>
            <p className="max-w-sm text-[16px] leading-[1.54] text-graphite/70">
              Bike, scooter, or car — the same perception loop, voice layer,
              and danger-segment store. Detection in the moment, evidence
              after the fact, and aggregated insight for the people who set
              the speed limits.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {features.map((f) => (
              <article
                key={f.tag}
                className={`relative ${f.bg} ${f.fg} rounded-[12px] p-10 md:p-16 min-h-[420px] flex flex-col justify-between border border-graphite/5`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[12px] uppercase tracking-[0.08em] opacity-70">
                    {f.tag}
                  </span>
                  <span className={`w-3 h-3 rounded-full ${f.swatch}`} />
                </div>
                <div className="mt-16">
                  <h3 className="font-display text-[28px] md:text-[40px] leading-[1.0] tracking-[-0.02em] max-w-[20ch]">
                    {f.title}
                  </h3>
                  <p className="mt-6 text-[16px] leading-[1.54] max-w-[40ch] opacity-90">
                    {f.body}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="bg-canvas">
        <div className="max-w-[1280px] mx-auto px-6 md:px-10 pb-[120px]">
          <div className="bg-sage-mist rounded-[12px] p-10 md:p-[64px]">
            <p className="font-mono text-[12px] uppercase tracking-[0.08em] text-graphite/60 mb-6">
              / how it works
            </p>
            <h2 className="font-display text-[40px] md:text-[64px] leading-[0.94] tracking-[-0.03em] max-w-3xl">
              Mount. Ride. Replay.
            </h2>
            <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-10">
              {[
                {
                  n: "01",
                  t: "Mount and start a ride",
                  b: "Bar-mount on a bike or scooter; vent-mount in a car. Pick a ride mode and the perception loop begins. Pro iPhones light up the LiDAR depth pill automatically.",
                },
                {
                  n: "02",
                  t: "Hazards trigger themselves",
                  b: "YOLO + Gemini score the scene. When severity crosses threshold the rolling 60-second clip is saved, ElevenLabs voices the alert, and the event lands in MongoDB Atlas. Or just say \"save clip.\"",
                },
                {
                  n: "03",
                  t: "Replay, report, repeat",
                  b: "Open the records console for the 3D ride replay, the danger-zone heatmap, and the corridor safety report Claude writes for the city.",
                },
              ].map((s) => (
                <div key={s.n}>
                  <span className="font-mono text-[12px] tracking-[-0.04em] text-graphite/50">
                    {s.n}
                  </span>
                  <h3 className="mt-3 text-[20px] font-light tracking-[-0.01em]">
                    {s.t}
                  </h3>
                  <p className="mt-3 text-[16px] leading-[1.54] text-graphite/70">
                    {s.b}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-graphite/10 bg-canvas">
        <div className="max-w-[1280px] mx-auto px-6 md:px-10 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="font-mono text-[12px] tracking-[-0.04em] text-graphite/60">
            © 2026 guardian road · built at uc davis · hackdavis 2026
          </div>
          <a
            href="https://github.com/YugrajD/HackDavis2026"
            target="_blank"
            rel="noreferrer"
            className="font-mono text-[12px] tracking-[-0.04em] text-graphite/60 hover:text-indigo-punch"
          >
            github.com/YugrajD/HackDavis2026
          </a>
        </div>
      </footer>
    </main>
  );
}
