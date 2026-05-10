import AsciiHero from "./AsciiHero";
import Logo from "./Logo";
import ScrollVideo from "./ScrollVideo";

type Feature = {
  tag: string;
  title: string;
  body: string;
};

const features: Feature[] = [
  {
    tag: "01 / detect",
    title: "Hazards spotted before you can react.",
    body:
      "AVCaptureMultiCamSession runs front + rear simultaneously, frames stream to a YOLOv8 sidecar, and ARKit scene-depth fuses LiDAR distance into the risk score. Close passes, doorings, blocked bike lanes, pedestrian conflicts — flagged in real time.",
  },
  {
    tag: "02 / alert",
    title: "A voice you can hear over wind.",
    body:
      "AVSpeechSynthesizer speaks the tuned warning on-device the moment severity crosses threshold — no cloud round-trip, no audio latency. The rolling 60-second clip is locked, uploaded, and added to the gallery.",
  },
  {
    tag: "03 / archive",
    title: "Evidence with GPS, heading, and speed attached.",
    body:
      "Every saved clip lands in MongoDB Atlas with a 2dsphere geo index, a thumbnail, and full telemetry — speed, heading, severity, ride mode. Replay the ride in 3D from the records console; export the corridor report.",
  },
  {
    tag: "04 / aggregate",
    title: "Repeated near-misses become a danger zone.",
    body:
      "When the same corridor lights up across riders, events aggregate into geofenced danger segments — a heatmap city traffic engineers can actually act on, and a per-corridor incident report.",
  },
];

const steps = [
  {
    n: "01",
    t: "Mount and start a ride",
    b: "Bar-mount on a bike or scooter; vent-mount in a car. Pick a ride mode and the multicam perception loop begins.",
  },
  {
    n: "02",
    t: "Hazards trigger themselves",
    b: "YOLO scores each frame, LiDAR boosts the risk in tight passes, and AVSpeechSynthesizer voices the alert when severity crosses threshold. Or just say \"save clip.\"",
  },
  {
    n: "03",
    t: "Replay, report, repeat",
    b: "Open the records console for the 3D ride replay, the danger-zone heatmap, and the corridor incident report.",
  },
];

const stack = [
  { name: "MongoDB Atlas", role: "Hazard events + clips, 2dsphere geo index" },
  { name: "YOLOv8 sidecar", role: "Real-time perception over Wi-Fi" },
  { name: "ARKit / LiDAR", role: "Scene-depth fusion in low light" },
  { name: "AVFoundation", role: "AVCaptureMultiCamSession dashcam" },
  { name: "Speech frameworks", role: "SFSpeechRecognizer + AVSpeechSynthesizer, on-device" },
  { name: "MapKit", role: "Apple Maps overlay with imperial turn-by-turn" },
];

export default function Page() {
  return (
    <main className="min-h-screen bg-deep-space pt-20 text-polar-white">
      {/* Liquid-glass nav */}
      <header className="pointer-events-none fixed inset-x-0 top-4 z-30 flex justify-center px-4">
        <nav className="pointer-events-auto flex items-center gap-3">
          <a
            href="#"
            aria-label="Semicolon"
            className="liquid-glass flex h-12 w-12 items-center justify-center rounded-full transition-transform duration-200 hover:scale-105"
          >
            <Logo size={26} />
          </a>

          <div
            className="nav-pill liquid-glass hidden h-12 items-center gap-7 rounded-full px-7 md:flex"
            data-augen-pill
          >
            <a
              href="#pipeline"
              className="nav-link text-[14px] font-light tracking-[-0.011em] text-polar-white"
            >
              Pipeline
            </a>
            <a
              href="#product"
              className="nav-link text-[14px] font-light tracking-[-0.011em] text-polar-white"
            >
              Product
            </a>
            <a
              href="#flow"
              className="nav-link text-[14px] font-light tracking-[-0.011em] text-polar-white"
            >
              Flow
            </a>
            <a
              href="https://github.com/YugrajD/HackDavis2026"
              target="_blank"
              rel="noreferrer"
              className="nav-link inline-flex items-center gap-1.5 text-[14px] font-light tracking-[-0.011em] text-polar-white"
            >
              GitHub
              <span aria-hidden className="text-[12px]">↗</span>
            </a>
          </div>

          <a
            href="https://github.com/YugrajD/HackDavis2026"
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub"
            className="liquid-glass flex h-12 w-12 items-center justify-center rounded-full text-polar-white/85 transition-colors duration-150 hover:text-polar-white md:hidden"
          >
            ↗
          </a>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-dark-carbon/60">
        <div className="relative mx-auto max-w-[1320px] px-6 pt-6 pb-10 md:px-10 md:pt-10">
          <div className="flex flex-col items-center text-center">
            <h1 className="font-display max-w-[20ch] text-[44px] font-light leading-[0.95] tracking-[-0.03em] text-polar-white sm:text-[64px] md:text-[88px] lg:text-[104px]">
              Cyclists die.
              <br />
              <span className="text-ash-gray">Cities don&apos;t hear about it.</span>
            </h1>

            <p className="mt-8 max-w-xl text-[15px] leading-[1.55] text-ash-gray md:text-[16px]">
              Semicolon is a native iOS hazard dashcam for bikes, scooters, and cars.
              Multicam capture, LiDAR-aware perception, on-device voice — the clip, the
              GPS, and the heatmap the city actually needs.
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <a
                href="#pipeline"
                className="inline-flex items-center gap-2 rounded-lg bg-polar-white px-5 py-3 font-mono text-[13px] uppercase tracking-[0.06em] text-deep-space transition hover:bg-amber-glow"
              >
                See the pipeline
                <span aria-hidden>↘</span>
              </a>
              <a
                href="https://github.com/YugrajD/HackDavis2026"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-dark-carbon bg-transparent px-5 py-3 font-mono text-[13px] uppercase tracking-[0.06em] text-polar-white transition hover:border-amber-glow hover:text-amber-glow"
              >
                Read the code
                <span aria-hidden>↗</span>
              </a>
            </div>
          </div>
        </div>

        {/* Full-bleed ASCII art band */}
        <div className="relative border-t border-dark-carbon/60 bg-midnight-void">
          <div className="mx-auto max-w-[1320px] px-6 py-10 md:px-10 md:py-14">
            <div className="mb-4 flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.08em] text-ash-gray">
              <span>// pov.ascii — front camera, demo-ride-1</span>
              <span className="hidden sm:inline">38.5441 N  121.7351 W  5.6 m/s</span>
            </div>
            <div className="flex justify-center overflow-x-auto">
              <AsciiHero />
            </div>
            <div className="mt-3 flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.08em] text-ash-gray">
              <span><span className="text-amber-glow">[!]</span> approaching hazard</span>
              <span>severity threshold 56</span>
            </div>
          </div>
        </div>
      </section>

      {/* Pipeline */}
      <section id="pipeline" className="border-b border-dark-carbon/60">
        <div className="mx-auto max-w-[1320px] px-6 py-20 md:px-10 md:py-[96px]">
          <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ash-gray">
                / pipeline
              </p>
              <h2 className="font-display mt-3 max-w-[18ch] text-[36px] leading-[0.98] tracking-[-0.03em] md:text-[56px]">
                One pipeline.
                <br />
                <span className="text-ash-gray">Three sensor classes.</span>
              </h2>
            </div>
            <p className="max-w-md text-[15px] leading-[1.55] text-ash-gray">
              Bike, scooter, or car — the same perception loop, voice layer, and
              danger-segment store. Detection in the moment, evidence after the fact,
              aggregated insight for the people who set the speed limits.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-px bg-dark-carbon md:grid-cols-3">
            {[
              { n: "01", mode: "Bike", body: "Rider-mounted detection of vehicles, pedestrians, door zones, blocked bike lanes." },
              { n: "02", mode: "Scooter", body: "Same pipeline at scooter speeds and on shared micro-mobility paths." },
              { n: "03", mode: "Car", body: "Dashcam mode warning drivers about cyclists, pedestrians, unsafe passing." },
            ].map((row) => (
              <div key={row.n} className="bg-deep-space p-8 md:p-10">
                <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ash-gray">{row.n}</span>
                <h3 className="font-display mt-12 text-[28px] leading-[1.0] tracking-[-0.02em]">
                  {row.mode}
                </h3>
                <p className="mt-3 max-w-[34ch] text-[14px] leading-[1.55] text-ash-gray">
                  {row.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo videos */}
      <section className="border-b border-dark-carbon/60 bg-midnight-void">
        <div className="mx-auto max-w-[1320px] px-6 py-20 md:px-10 md:py-[96px]">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ash-gray">
                / on the road
              </p>
              <h2 className="font-display mt-3 max-w-[18ch] text-[36px] leading-[0.98] tracking-[-0.03em] md:text-[56px]">
                Recorded mid-ride.
              </h2>
            </div>
            <p className="max-w-sm text-[15px] leading-[1.55] text-ash-gray">
              Two clips straight from an iPhone. The left shows the app in motion;
              the right shows the depth-aware feed with the multicam preview and
              live YOLO overlay.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="relative mx-auto flex h-[60vh] w-full items-center justify-center overflow-hidden rounded-lg border border-dark-carbon bg-deep-space">
              <ScrollVideo src="/demo.mov" className="h-full w-full object-contain" />
              <span className="absolute left-4 top-4 rounded-md border border-dark-carbon bg-deep-space/85 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-polar-white backdrop-blur">
                app preview
              </span>
            </div>
            <div className="relative mx-auto flex h-[60vh] w-full items-center justify-center overflow-hidden rounded-lg border border-dark-carbon bg-deep-space">
              <ScrollVideo src="/preview.mov" className="h-full w-full object-contain" />
              <span className="absolute left-4 top-4 rounded-md border border-dark-carbon bg-deep-space/85 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-polar-white backdrop-blur">
                on the road
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="product" className="border-b border-dark-carbon/60">
        <div className="mx-auto max-w-[1320px] px-6 py-20 md:px-10 md:py-[96px]">
          <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ash-gray">
                / product
              </p>
              <h2 className="font-display mt-3 max-w-[18ch] text-[36px] leading-[0.98] tracking-[-0.03em] md:text-[56px]">
                Detect. Alert.
                <br />
                <span className="text-ash-gray">Archive. Aggregate.</span>
              </h2>
            </div>
            <p className="max-w-md text-[15px] leading-[1.55] text-ash-gray">
              Four small pieces that add up to one calm, capable safety co-pilot
              for everyone sharing the road.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-px bg-dark-carbon md:grid-cols-2">
            {features.map((f) => (
              <article key={f.tag} className="bg-deep-space p-8 md:p-12">
                <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ash-gray">
                  {f.tag}
                </span>
                <h3 className="font-display mt-10 max-w-[18ch] text-[26px] leading-[1.05] tracking-[-0.02em] md:text-[34px]">
                  {f.title}
                </h3>
                <p className="mt-4 max-w-[42ch] text-[14px] leading-[1.55] text-ash-gray">
                  {f.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Stack */}
      <section className="border-b border-dark-carbon/60 bg-midnight-void">
        <div className="mx-auto max-w-[1320px] px-6 py-20 md:px-10 md:py-[96px]">
          <div className="mb-10">
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ash-gray">
              / stack
            </p>
            <h2 className="font-display mt-3 max-w-[22ch] text-[36px] leading-[0.98] tracking-[-0.022em] md:text-[56px]">
              Native iOS,
              <span className="text-ash-gray"> wired to one open server.</span>
            </h2>
          </div>

          <div className="overflow-hidden rounded-lg border border-dark-carbon">
            {stack.map((row, i) => (
              <div
                key={row.name}
                className={`flex items-center justify-between gap-6 px-6 py-5 md:px-8 ${
                  i !== stack.length - 1 ? "border-b border-dark-carbon" : ""
                }`}
              >
                <div className="flex items-center gap-4">
                  <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ash-gray">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-[18px] font-medium tracking-[-0.022em] text-polar-white md:text-[20px]">
                    {row.name}
                  </span>
                </div>
                <span className="text-right text-[13px] tracking-[-0.011em] text-ash-gray md:text-[14px]">
                  {row.role}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Flow */}
      <section id="flow" className="border-b border-dark-carbon/60">
        <div className="mx-auto max-w-[1320px] px-6 py-20 md:px-10 md:py-[96px]">
          <div className="mb-12">
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ash-gray">
              / flow
            </p>
            <h2 className="font-display mt-3 max-w-[18ch] text-[36px] leading-[0.98] tracking-[-0.03em] md:text-[56px]">
              Mount. Ride. Replay.
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-px bg-dark-carbon md:grid-cols-3">
            {steps.map((s) => (
              <div key={s.n} className="bg-deep-space p-8 md:p-10">
                <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ash-gray">
                  {s.n}
                </span>
                <h3 className="font-display mt-8 text-[22px] leading-[1.05] tracking-[-0.02em] md:text-[26px]">
                  {s.t}
                </h3>
                <p className="mt-3 max-w-[36ch] text-[14px] leading-[1.55] text-ash-gray">
                  {s.b}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-deep-space">
        <div className="mx-auto flex max-w-[1320px] flex-col items-start justify-between gap-4 px-6 py-12 md:flex-row md:items-center md:px-10">
          <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ash-gray">
            © 2026 semicolon / built at uc davis / hackdavis 2026
          </span>
          <a
            href="https://github.com/YugrajD/HackDavis2026"
            target="_blank"
            rel="noreferrer"
            className="font-mono text-[11px] uppercase tracking-[0.08em] text-ash-gray transition hover:text-amber-glow"
          >
            github.com/yugrajd/hackdavis2026 ↗
          </a>
        </div>
      </footer>
    </main>
  );
}
