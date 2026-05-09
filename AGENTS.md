# Guardian Road Agent Instructions

Project: **Guardian Road**, HackDavis 2026.

Guardian Road turns phones into shared-road safety sensors. Bike/scooter phones warn riders. Car-mounted phones act as AI dashcams. Both produce geotagged hazard events that feed a records dashboard, 3D safety replay, Davis danger map, and civic safety reports.

## Non-negotiable coordination rules

1. Do not edit another owner's files without asking in Discord first.
2. Keep all shared types in `src/lib/contracts.ts`. If you need to change the contract, update `docs/API_CONTRACT.md` in the same PR/commit.
3. Backend owns all API route behavior and seed data. Frontend/replay/records should consume the API, not hardcode divergent data shapes.
4. Build against seeded demo data first. Live camera/AI can attach later without blocking replay or records.
5. No secrets in git. Use `.env.local`; commit only `.env.example`.
6. Prefer small commits with a clear scope: `backend: add events API`, `replay: render route tube`, `records: add event feed`.
7. If blocked, add a note to `docs/INTEGRATION_STATUS.md` with owner, blocker, and requested contract change.

## Ownership boundaries

### Backend owner
Owned paths:
- `src/app/api/**`
- `src/lib/db/**`
- `src/lib/ai/**`
- `src/lib/geo/**`
- `src/lib/seed/**`
- `src/lib/contracts.ts`
- `.env.example`
- `docs/API_CONTRACT.md`

Responsibilities:
- MongoDB Atlas models and geospatial indexes.
- `/api/rides`, `/api/events`, `/api/replay`, `/api/danger-segments`, `/api/seed/demo`.
- Gemini hazard analysis endpoint.
- Claude report endpoint.
- ElevenLabs alert endpoint.
- Seed demo ride that replay and records can use immediately.

### 3D Replay owner
Owned paths:
- `src/app/replay/**`
- `src/components/replay/**`
- `src/lib/replay/**`
- `src/components/three/**`

Responsibilities:
- Three.js / React Three Fiber safety replay.
- Timeline scrubber.
- Route tube, rider object, camera cones, hazard rings, ghost trajectories.
- Consume only `GET /api/replay/:rideId` and shared types from `src/lib/contracts.ts`.

### Records owner
Owned paths:
- `src/app/records/**`
- `src/components/records/**`
- `src/lib/records/**`

Responsibilities:
- Event feed, filters, event detail, danger segment list, report export UI.
- Consume `/api/events`, `/api/danger-segments`, `/api/rides/:rideId`, `/api/ai/report`.

### Orchestrator / shared UI owner
Owned paths:
- `src/app/page.tsx`
- `src/app/layout.tsx`
- `src/app/globals.css`
- `src/components/shell/**`
- `docs/**` unless otherwise scoped

Responsibilities:
- App shell, navigation, landing/control room, design system, integration status.

## Working contract

Read these before coding:
- `docs/PROJECT_BRIEF.md`
- `docs/API_CONTRACT.md`
- `docs/FRIEND_TASKS.md`
- `docs/REUSE_PLAN.md`
- `docs/INTEGRATION_STATUS.md`

## Design direction

Dark mobility cockpit. Asphalt black, white/cyan geometry, amber warning, red critical. No generic purple gradients, no emoji UI, no decorative icon grids. UI should feel like a safety/control system, not a fitness app.

## Track targets

Primary:
1. Best Hack for Social Good
2. Best AI/ML Hack, sponsored by Anthropic
3. Best Use of Gemini API
4. Best Use of ElevenLabs
5. Best Use of MongoDB Atlas

Secondary:
- Best UI/UX Design, sponsored by Figma
- Best Hardware Hack
- Most Technically Challenging Hack
- Best Use of DAC Materials
- Best use of Reconstruct
- Hacker's Choice
