# Integration Status

Update this whenever a shared contract changes or someone is blocked.

## Current owner map

| Area | Owner | Paths | Status |
|---|---|---|---|
| Backend/API | Aktan/backend owner | `src/app/api/**`, `src/lib/db/**`, `src/lib/contracts.ts` | Not scaffolded yet |
| 3D Replay | Replay friend | `src/app/replay/**`, `src/components/replay/**` | Waiting for seed API |
| Records | Records friend | `src/app/records/**`, `src/components/records/**` | Waiting for seed API |
| Shell/design/docs | Orchestrator | `src/app/page.tsx`, `src/components/shell/**`, `docs/**` | Docs started |

## Shared contract changes

None yet. Initial contract is in `docs/API_CONTRACT.md`.

## Current integration assumptions

- Demo ride ID: `demo-ride-1`.
- Replay should load `/api/replay/demo-ride-1`.
- Records should load `/api/events?rideId=demo-ride-1` and `/api/danger-segments`.
- Seed endpoint should be `/api/seed/demo`.

## Blockers

None yet.

## Decisions

- Build seeded demo data first so replay and records can proceed independently.
- MongoDB Atlas is the target database for sponsor alignment.
- Mirage MIT-licensed code may be reused with attribution. Other inspiration repos are pattern references unless license is clarified.
