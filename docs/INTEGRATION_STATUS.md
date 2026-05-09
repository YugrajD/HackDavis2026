# Integration Status

Update this whenever a shared contract changes or someone is blocked.

## Current owner map

| Area | Owner | Paths | Status |
|---|---|---|---|
| Backend/API | Aktan/backend owner | `src/app/api/**`, `src/lib/db/**`, `src/lib/contracts.ts` | Seed API and stubs online |
| 3D Replay | Replay friend | `src/app/replay/**`, `src/components/replay/**` | Unblocked by `/api/replay/demo-ride-1` |
| Records | Records friend | `src/app/records/**`, `src/components/records/**` | Unblocked by `/api/events`, `/api/danger-segments`, `/api/ai/report` |
| Shell/design/docs | Orchestrator | `src/app/page.tsx`, `src/components/shell/**`, `docs/**` | Shell scaffolded |

## Shared contract changes

- Initial contract is mirrored in `src/lib/contracts.ts` for app code.
- Added explicit response envelopes for rides, events, danger segments, reports, and voice alerts.
- Added memory-backed API stubs for ride creation/end, event creation/batch/nearby, frame analysis, report generation, and voice alerts.

## Current integration assumptions

- Demo ride ID: `demo-ride-1`.
- Replay should load `/api/replay/demo-ride-1`.
- Records should load `/api/events?rideId=demo-ride-1` and `/api/danger-segments`.
- Seed endpoint should be `/api/seed/demo`.

## Blockers

None for replay or records. Both can build from seeded API responses now.

## Decisions

- Build seeded demo data first so replay and records can proceed independently.
- Keep demo API stubs backed by `src/lib/db/store.ts` and `src/lib/seed/demo-data.ts` until MongoDB persistence lands.
- MongoDB Atlas is the target database for sponsor alignment.
- Mirage MIT-licensed code may be reused with attribution. Other inspiration repos are pattern references unless license is clarified.
