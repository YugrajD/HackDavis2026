# Guardian Road Frontend Polish Plan

This is the handoff plan for Claude or any frontend-focused agent. It assumes the backend, Expo mobile capture, YOLO sidecar proxy, provider status, report export, scenario jobs, and smoke scripts are already wired. The frontend task is to make the product feel like a serious shared-road safety command center without breaking backend contracts or friends' ownership areas.

## Design direction

Use a dark operations-console language inspired by the Refero Styles patterns that best fit Guardian Road:

- **Conway**: shadowless dark operations grid, sparse high-contrast information, one orange/amber accent.
- **Fey**: deep-space observatory control panel, crisp white text, restrained data visualization, blue/cyan only for telemetry.
- **Incident / Standards**: utilitarian incident-response clarity, sharp typography, high-contrast panels, vivid orange for action or risk.
- **Avoid** generic SaaS polish: no purple, no blurple, no glowy gradient blobs, no decorative icon grids, no over-rounded nested cards, no emoji UI, no generic marketing copy.

Guardian Road should feel like a civic safety operations board: asphalt-dark, precise, dense, alert-aware, and technically credible.

## Ownership boundaries

Safe frontend-owned paths:

- `src/app/page.tsx`
- `src/app/layout.tsx`
- `src/app/globals.css`
- `tailwind.config.ts`
- `src/app/capture/page.tsx`
- `src/components/shell/**` if new shared shell components are needed
- docs under `docs/**`

Do **not** edit without explicit owner approval:

- `src/app/replay/**`
- `src/components/replay/**`
- `src/lib/replay/**`
- `src/components/three/**`
- `src/app/records/**`
- `src/components/records/**`
- `src/lib/records/**`
- `src/app/api/**`
- `src/lib/db/**`
- `src/lib/ai/**`
- `src/lib/contracts.ts`

Global CSS and Tailwind token changes can affect replay/records once those pages exist, so keep globals restrained and validate that nothing broad like `button { ... }` breaks future pages.

## Target visual system

### Palette

Replace the current soft cyan glow with near-black surfaces and a subtle grid.

```css
--gr-void: #050608;
--gr-asphalt: #080a0d;
--gr-surface: #0c1116;
--gr-surface-raised: #111820;
--gr-surface-hot: #17120b;
--gr-line: #1f2a33;
--gr-line-strong: #33424d;
--gr-text: #e8edf0;
--gr-text-muted: #9aa6ad;
--gr-text-dim: #5f6b74;
--gr-amber: #f59e0b;
--gr-orange: #f97316;
--gr-critical: #fb4e1b;
--gr-telemetry: #22d3ee;
--gr-grid: rgba(148, 163, 184, 0.07);
```

Rules:

- Amber/orange means warning, primary action, or risk.
- Critical red/orange means high severity only.
- Cyan means telemetry, API, coordinates, provider status, machine-readable IDs.
- Off-white text on near-black surfaces, never gray-on-gray for primary content.
- No full-page radial glow. Use a subtle operations grid and hard panel borders.

### Typography

Current Geist/system setup is acceptable for body and mono labels. Use hierarchy rather than extra font dependencies unless there is time.

- Display headings: large, tight tracking, off-white, no gradient text.
- Labels: monospace, uppercase, small, wide tracking.
- Metrics: tabular numbers via `font-variant-numeric: tabular-nums`.
- Copy: specific and operational. Avoid broad phrases like "empower", "AI-powered", "seamless", "next generation".

### Components

- Panels: hard 1px border, dark fill, low or no shadow.
- Buttons: rectangular/pill hybrid is okay, but fewer pills. Primary action in amber; secondary ghost with border.
- Tables/rows: dense rows with method, endpoint, owner, status, and href.
- Status: text labels beat colored dots. If a color indicator is used, pair with text.
- Motion: 150-200ms ease-out for hover/focus. Transform/opacity only.

## Commit plan

Keep these as separate commits so review and rollback stay easy.

### Commit 1: `frontend: define operations design tokens`

Files:

- `tailwind.config.ts`
- `src/app/globals.css`

Work:

- Add Guardian Road color tokens to Tailwind.
- Add CSS variables under `:root`.
- Replace body background with near-black + subtle operations grid:

```css
body {
  background:
    linear-gradient(rgba(148, 163, 184, 0.055) 1px, transparent 1px),
    linear-gradient(90deg, rgba(148, 163, 184, 0.045) 1px, transparent 1px),
    radial-gradient(circle at 50% -20%, rgba(245, 158, 11, 0.08), transparent 26rem),
    var(--gr-asphalt);
  background-size: 48px 48px, 48px 48px, auto, auto;
}
```

- Add global visible focus state with amber outline.
- Add selection color using amber/telemetry.

Checks:

```bash
npm run typecheck
npm run build
git diff --check
```

### Commit 2: `shell: tighten document metadata and chrome`

Files:

- `src/app/layout.tsx`
- `src/app/globals.css`

Work:

- Update metadata:
  - Title: `Guardian Road — Safety Ops`
  - Description: `Shared-road hazard sensing, live capture, replay data, danger segments, and civic safety reports for Davis streets.`
- Set body class if useful: `bg-asphalt text-roadText antialiased`.
- Keep global styles minimal. Do not style every `button` globally beyond focus/accessibility basics.

Checks:

```bash
npm run typecheck
npm run build
```

### Commit 3: `home: redesign as operations control room`

Files:

- `src/app/page.tsx`
- Optional new component: `src/components/shell/EndpointBoard.tsx`

Work:

Rebuild `/` as the judge/operator control room.

Must include:

- Masthead: `GUARDIAN ROAD`, concise one-line description, current mode `DEMO OPS`.
- Primary CTAs:
  - `/capture` as amber primary: `Open capture sensor`
  - `/api/replay/demo-ride-1`: `Replay API`
  - `/api/events?rideId=demo-ride-1`: `Events API`
- Demo ride panel:
  - ride ID `demo-ride-1`
  - events `6`
  - segments `3`
  - distance `560m`
  - max risk `94`
- Endpoint board with live API links:
  - `GET /api/replay/demo-ride-1`
  - `GET /api/events?rideId=demo-ride-1`
  - `GET /api/danger-segments`
  - `GET /api/providers/status`
  - `GET /api/health/readiness`
  - `POST /api/seed/demo` should be displayed as a command, not a link, unless implemented as a client button.
- Sponsor capability strip:
  - MongoDB Atlas persistence
  - Gemini frame analysis
  - Claude report generation
  - ElevenLabs voice alerts
  - YOLO sidecar perception

Style:

- Dense panels, hard borders, monochrome text.
- Amber for primary CTA and risk labels.
- Cyan only for endpoint paths, provider names, and telemetry labels.
- No decorative icons.

Checks:

```bash
npm run typecheck
npm run build
```

Manual:

- Open `/`.
- Confirm no links point to missing `/replay` or `/records` pages unless those pages exist.
- Confirm all API links resolve or are intentionally POST-only text.

### Commit 4: `capture: polish sensor console UI`

Files:

- `src/app/capture/page.tsx`

Work:

Visual-only pass. Do not change API calls, hooks, worker logic, camera lifecycle, ride lifecycle, geolocation, or capture behavior unless a visual refactor forces a tiny accessibility fix.

Polish targets:

- Video/canvas area becomes an operations viewport:
  - top rail with selected camera, active ride, provider/worker status
  - thin border, subtle grid/scan overlay using CSS only
  - no glowy card background
- Status message becomes an `aria-live="polite"` console line.
- Controls become a compact sensor panel:
  - Start ride / End ride
  - Camera role
  - Worker perception seed
  - Capture hazard
- Telemetry display:
  - ride ID
  - route point count if already available in state
  - last provider
  - severity
  - event ID or hazard type
- Preserve touch target size for mobile.

Checks:

```bash
npm run typecheck
npm run build
```

Manual:

- `/capture` loads.
- Permission UI still works.
- Camera selector still restarts stream.
- Capture still calls backend.

### Commit 5: `frontend: add demo control preflight panel`

Files:

- `src/app/page.tsx`
- Optional: `src/components/shell/DemoControlPanel.tsx`

Work:

Add client-side controls only if they can be isolated safely.

Features:

- `Check providers` button calls `GET /api/providers/status`.
- `Check readiness` button calls `GET /api/health/readiness`.
- `Seed demo` button calls `POST /api/seed/demo`.
- Show degraded provider reasons without leaking secrets.
- Show YOLO status as `not configured`, `down`, or `ready`.
- Keep failures readable: wrong server, JSON error, network error.

Implementation guidance:

- If adding interactivity, create a client component under `src/components/shell/DemoControlPanel.tsx` and import it into `page.tsx`.
- Avoid changing backend endpoints.
- Do not poll constantly; manual buttons are enough.

Checks:

```bash
npm run typecheck
npm run build
npm run smoke:api
```

Manual:

- Run `npm run dev`.
- Click check providers/readiness.
- Click seed demo.
- Confirm page still renders if server returns degraded provider status.

### Commit 6: `frontend: responsive accessibility pass`

Files:

- `src/app/page.tsx`
- `src/app/capture/page.tsx`
- `src/app/globals.css`

Work:

- Keyboard focus visible on every link, button, select, and input.
- `aria-live` for async status/error messages.
- No color-only disabled states.
- 44px minimum touch targets on mobile.
- 390px mobile layout has no horizontal overflow.
- 1440px desktop layout uses space without sprawling.
- Respect `prefers-reduced-motion` for any transform/opacity transition.

Checks:

```bash
npm run typecheck
npm run build
npm run mobile:typecheck
```

Manual browser QA:

- `/` at 390px, 768px, 1440px.
- `/capture` at 390px and 1440px.
- Tab through all controls.
- Confirm focus is visible.

## Claude handoff prompt

Use this prompt if pasting into Claude:

```text
You are working in /Users/aktanazat/projects/HackDavis2026 on Guardian Road, a HackDavis shared-road safety system. Read AGENTS.md first. Implement frontend polish only, in small commits. Do not touch replay-owned paths, records-owned paths, backend API routes, db/ai libraries, or shared contracts.

Use docs/FRONTEND_POLISH_PLAN.md as the source of truth. Visual target: Conway/Fey/Incident/Standards-style dark operations console from Refero Styles. Near-black operations grid, off-white text, amber/orange warning/action, cyan only for telemetry and API labels. No purple, no glowy gradients, no emoji UI, no decorative icon grids, no generic SaaS copy.

Commit sequence:
1. frontend: define operations design tokens
2. shell: tighten document metadata and chrome
3. home: redesign as operations control room
4. capture: polish sensor console UI
5. frontend: add demo control preflight panel
6. frontend: responsive accessibility pass

After every commit run npm run typecheck and npm run build. For commits touching controls or API status, also run npm run smoke:api. Keep git status clean and push small commits.
```

## Final verification before frontend handoff is done

Run:

```bash
npm run typecheck
npm run build
npm run mobile:typecheck
npm run smoke:api
npm run demo:doctor
```

Optional if a server is already running:

```bash
API_BASE_URL=http://localhost:3000 npm run smoke:report
API_BASE_URL=http://localhost:3000 npm run smoke:api:errors
API_BASE_URL=http://localhost:3000 npm run smoke:mobile
```

Done means:

- `/` no longer feels like a generic landing page; it is a functional demo control room.
- `/capture` feels like a sensor console and still works.
- No friend-owned replay/records paths were edited.
- All links on `/` either resolve or are clearly shown as API commands.
- The visual language matches Guardian Road: civic safety, shared-road telemetry, command-center confidence.
