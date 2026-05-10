import Link from "next/link";

const navItems = [
  ["Capture", "#capture"],
  ["Intelligence", "#intelligence"],
  ["Replay", "#replay"],
  ["Reports", "#reports"],
];

const stats = [
  ["live sensors", "2", "front + rear cameras stay active"],
  ["risk events", "6", "seeded Davis demo ride"],
  ["danger segments", "3", "Atlas geospatial memory"],
  ["max risk", "94", "YOLO + depth + Gemini scoring"],
];

const demoVideos = [
  {
    title: "Native iPhone capture",
    detail: "Dual camera, main-preview depth, rolling save, and hazard trigger.",
    tag: "demo-video-01.mp4",
  },
  {
    title: "Safety replay",
    detail: "Route, events, risk bursts, and evidence frames in one timeline.",
    tag: "demo-video-02.mp4",
  },
  {
    title: "Civic report",
    detail: "MongoDB records become exportable street-safety evidence.",
    tag: "demo-video-03.mp4",
  },
];

const pipeline = [
  ["01", "Phones see", "Native camera capture keeps front and rear feeds live, then sends the main view into perception."],
  ["02", "AI scores", "YOLO detects road actors. Depth and Gemini add context when the scene gets crowded or dark."],
  ["03", "Atlas remembers", "Events land as geospatial safety records, grouped by ride, route, and danger segment."],
  ["04", "Cities act", "Replay and reports turn clips into evidence a transportation team can review."],
];

const sponsorStack = ["MongoDB Atlas", "Gemini", "YOLO", "Claude", "ElevenLabs", "Native iOS"];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f3f0e8] text-[#171714]">
      <section className="relative min-h-screen overflow-hidden bg-[#171714] text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(241,184,91,0.32),transparent_24rem),linear-gradient(100deg,rgba(18,22,16,0.86)_0%,rgba(18,22,16,0.56)_42%,rgba(18,22,16,0.1)_76%),linear-gradient(180deg,rgba(0,0,0,0.02),rgba(0,0,0,0.62)),linear-gradient(135deg,#5f6148_0%,#2d3327_38%,#c9b690_64%,#47392b_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-[42vh] bg-[linear-gradient(165deg,transparent_0_42%,rgba(255,255,255,0.72)_42.2%_45%,transparent_45.2%),linear-gradient(180deg,rgba(20,18,14,0),rgba(20,18,14,0.92)),repeating-linear-gradient(90deg,rgba(255,255,255,0.1)_0_1px,transparent_1px_72px)] opacity-80" />
        <div className="absolute bottom-[-7rem] right-[-6rem] h-[24rem] w-[62rem] rounded-tl-[8rem] border-t border-white/20 bg-[#e8e2d5]/88 shadow-2xl shadow-black/40 max-lg:right-[-24rem] max-md:hidden" />
        <div className="absolute bottom-[6.4rem] right-[6rem] h-3 w-[18rem] rounded-full bg-red-600/90 blur-[1px] max-lg:hidden" />
        <div className="absolute right-[4.5rem] top-[31vh] hidden h-[24rem] w-[13rem] rounded-[2rem] border border-white/20 bg-black/54 p-3 shadow-2xl backdrop-blur md:block">
          <div className="relative h-full overflow-hidden rounded-[1.4rem] bg-[#111]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_55%_20%,rgba(255,255,255,0.2),transparent_11rem),linear-gradient(160deg,#3c4a38,#11160f_52%,#0c0d0b)]" />
            <div className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-[#171714]">live</div>
            <div className="absolute inset-x-5 bottom-16 h-40 rounded-[1.4rem] border border-[#f3a41a]/70 bg-black/28">
              <div className="absolute left-1/2 top-0 h-full w-px bg-[#f3a41a]/80" />
              <div className="absolute left-6 top-8 h-8 w-16 rounded border border-cyan-200/80" />
              <div className="absolute right-5 top-20 h-11 w-20 rounded border border-cyan-200/80" />
            </div>
            <div className="absolute inset-x-5 bottom-5 flex items-center justify-between rounded-full bg-white/92 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#171714]">
              <span>LiDAR</span>
              <span className="text-[#c16d00]">1.8m</span>
            </div>
          </div>
        </div>

        <header className="relative z-20 mx-auto flex w-[calc(100%-2rem)] max-w-7xl items-center justify-between rounded-[1.55rem] bg-white px-5 py-4 text-[#171714] shadow-xl shadow-black/16 sm:mt-6 sm:px-8">
          <Link href="/" className="font-mono text-xl font-black uppercase tracking-[0.34em]">Guardian Road</Link>
          <nav className="hidden items-center gap-8 text-sm font-semibold lg:flex">
            {navItems.map(([label, href]) => (
              <a key={label} href={href} className="transition-colors hover:text-[#9c5e10]">{label}</a>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/capture" className="rounded-full bg-[#f2a10c] px-5 py-3 text-sm font-bold text-black transition hover:bg-[#ffb12b]">Open demo</Link>
            <Link href="/records" className="hidden rounded-full bg-[#efeee9] px-5 py-3 text-sm font-bold sm:inline-flex">Records</Link>
          </div>
        </header>

        <div className="relative z-10 mx-auto flex min-h-[calc(100vh-6rem)] max-w-7xl flex-col justify-end px-5 pb-14 pt-24 sm:px-8 lg:px-10">
          <div className="max-w-4xl">
            <p className="mb-5 font-mono text-[11px] font-bold uppercase tracking-[0.42em] text-[#f2a10c]">HackDavis 2026 · shared-road safety intelligence</p>
            <h1 className="text-[clamp(4.5rem,12vw,10.5rem)] font-black leading-[0.84] tracking-[-0.08em]">
              Roads that watch out for everyone.
            </h1>
            <p className="mt-8 max-w-2xl text-lg font-medium leading-7 text-white/86 sm:text-xl">
              Guardian Road turns phones into AI dashcams for cyclists, scooters, and cars. The camera sees hazards, Atlas remembers where they happen, and the demo turns every event into replayable evidence.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link href="/capture" className="inline-flex min-h-[56px] items-center rounded-full bg-white px-8 text-base font-bold text-black transition hover:bg-[#f2a10c]">Launch capture</Link>
              <Link href="/replay/demo-ride-1" className="inline-flex min-h-[56px] items-center rounded-full border border-white/80 px-8 text-base font-bold text-white transition hover:bg-white hover:text-black">Watch replay</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-10">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map(([label, value, note]) => (
            <div key={label} className="rounded-[1.75rem] bg-white p-6 shadow-sm ring-1 ring-black/5">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-[#827967]">{label}</p>
              <p className="mt-4 text-6xl font-black tracking-[-0.08em] text-[#171714]">{value}</p>
              <p className="mt-3 text-sm font-medium leading-5 text-[#615a4d]">{note}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="capture" className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:px-10">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.35fr] lg:items-end">
          <div>
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.34em] text-[#9c5e10]">native sensor</p>
            <h2 className="mt-4 text-5xl font-black leading-[0.9] tracking-[-0.06em] sm:text-7xl">Demo videos go here.</h2>
            <p className="mt-6 max-w-md text-base font-medium leading-7 text-[#615a4d]">
              Drop final clips into the page later. The layout already sells the story: capture, understand, replay, report.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {demoVideos.map((video, index) => (
              <article key={video.title} className="group overflow-hidden rounded-[2rem] bg-[#171714] text-white shadow-xl shadow-black/10">
                <div className="relative aspect-[4/5] overflow-hidden bg-[linear-gradient(145deg,#5b624b,#171714_48%,#a4814f)]">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.24),transparent_10rem),linear-gradient(180deg,transparent,rgba(0,0,0,0.72))]" />
                  <div className="absolute left-5 top-5 rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-black">0{index + 1}</div>
                  <div className="absolute left-5 right-5 top-1/2 h-28 -translate-y-1/2 rounded-[1.5rem] border border-white/28 bg-black/22 p-3 backdrop-blur-sm">
                    <div className="h-full rounded-[1rem] border border-[#f2a10c]/70 bg-black/24">
                      <div className="mx-auto mt-9 h-10 w-10 rounded-full bg-white/92 text-center text-2xl leading-10 text-black transition group-hover:scale-105">›</div>
                    </div>
                  </div>
                  <p className="absolute bottom-5 left-5 right-5 font-mono text-[10px] uppercase tracking-[0.22em] text-white/70">public/demo/{video.tag}</p>
                </div>
                <div className="p-5">
                  <h3 className="text-xl font-black tracking-[-0.03em]">{video.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/72">{video.detail}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="intelligence" className="mt-10 bg-[#171714] py-20 text-white">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[1fr_1.05fr] lg:px-10">
          <div>
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.34em] text-[#f2a10c]">how it works</p>
            <h2 className="mt-4 text-5xl font-black leading-[0.9] tracking-[-0.06em] sm:text-7xl">A safety network from phones already on the road.</h2>
          </div>
          <div className="divide-y divide-white/12 rounded-[2rem] bg-white/7 ring-1 ring-white/10">
            {pipeline.map(([number, title, body]) => (
              <div key={title} className="grid gap-4 p-6 sm:grid-cols-[5rem_1fr]">
                <p className="font-mono text-sm font-black text-[#f2a10c]">{number}</p>
                <div>
                  <h3 className="text-2xl font-black tracking-[-0.04em]">{title}</h3>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-white/68">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="replay" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10">
        <div className="overflow-hidden rounded-[2.5rem] bg-white shadow-sm ring-1 ring-black/5">
          <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
            <div className="min-h-[32rem] bg-[radial-gradient(circle_at_50%_12%,rgba(242,161,12,0.2),transparent_18rem),linear-gradient(135deg,#2f372d,#11140f)] p-6 text-white sm:p-8">
              <div className="h-full rounded-[2rem] border border-white/12 bg-black/24 p-5">
                <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.22em] text-white/60">
                  <span>replay · demo-ride-1</span>
                  <span>risk 94</span>
                </div>
                <div className="relative mt-8 h-[22rem] overflow-hidden rounded-[1.5rem] bg-[#0c110c]">
                  <div className="absolute left-1/2 top-0 h-full w-[16rem] -translate-x-1/2 border-x border-[#f2a10c]/24 bg-[#f2a10c]/6" />
                  <div className="absolute left-[18%] top-[18%] h-28 w-44 rounded-[1.25rem] border border-cyan-200/80" />
                  <div className="absolute right-[14%] top-[38%] h-24 w-40 rounded-[1.25rem] border border-cyan-200/80" />
                  <div className="absolute left-[34%] bottom-[16%] h-20 w-32 rounded-[1.25rem] border border-[#f2a10c] bg-[#f2a10c]/12" />
                  <div className="absolute bottom-6 left-6 right-6 h-2 rounded-full bg-white/12">
                    <div className="h-full w-[64%] rounded-full bg-[#f2a10c]" />
                  </div>
                </div>
              </div>
            </div>
            <div className="p-8 sm:p-10 lg:p-12">
              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.34em] text-[#9c5e10]">judge flow</p>
              <h2 className="mt-4 text-5xl font-black leading-[0.92] tracking-[-0.06em]">One demo, three proofs.</h2>
              <p className="mt-5 text-base font-medium leading-7 text-[#615a4d]">Show the phone seeing a hazard, open the replay, then export the record. The page is built so the pitch can move like a product launch instead of a settings screen.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/replay/demo-ride-1" className="rounded-full bg-[#171714] px-6 py-4 text-sm font-bold text-white">Replay console</Link>
                <Link href="/records" className="rounded-full bg-[#ece7dc] px-6 py-4 text-sm font-bold text-[#171714]">Records console</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="reports" className="mx-auto max-w-7xl px-5 pb-20 sm:px-8 lg:px-10">
        <div className="flex flex-col gap-8 rounded-[2.5rem] bg-[#e7dfcf] p-8 sm:p-10 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.34em] text-[#9c5e10]">sponsor stack</p>
            <h2 className="mt-3 max-w-2xl text-4xl font-black leading-[0.95] tracking-[-0.05em] sm:text-6xl">Built for social good, backed by real infrastructure.</h2>
          </div>
          <div className="grid min-w-[18rem] gap-2 sm:grid-cols-2">
            {sponsorStack.map((item) => (
              <div key={item} className="rounded-full bg-white px-5 py-3 text-center text-sm font-black text-[#171714] shadow-sm">{item}</div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
