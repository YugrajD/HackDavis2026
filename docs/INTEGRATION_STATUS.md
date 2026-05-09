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
- Added `/api/media/upload` for frame/clip evidence stored under `public/generated/uploads`, returning `clipUrl` and `thumbnailUrl` for hazard events.
- Added reuse ports/helpers: `/api/scenarios`, `/api/media/analyze-and-save`, `/api/reports/export`, a Spark/Three `SplatViewer`, perception worker helpers, hotspot utilities, and report exporters.
- Backend readiness pass added JSON error envelopes, bounded JSON bodies, stricter media MIME/signature checks, route parameter safeguards, and deployment notes in `docs/BACKEND_DEPLOYMENT.md`.

## Current integration assumptions

- Demo ride ID: `demo-ride-1`.
- Replay should load `/api/replay/demo-ride-1`.
- Records should load `/api/events?rideId=demo-ride-1` and `/api/danger-segments`.
- Seed endpoint should be `/api/seed/demo`.
- Capture ingestion page is `/capture`; it posts a frame to `/api/media/upload`, analyzes it through `/api/ai/analyze-frame`, saves the returned event through `/api/events`, and asks `/api/voice/alert` for alert audio or native TTS fallback.

## Blockers

None for replay or records. Both can build from seeded API responses now.

## Decisions

- Build seeded demo data first so replay and records can proceed independently.
- Keep demo API stubs backed by `src/lib/db/store.ts` and `src/lib/seed/demo-data.ts` until MongoDB persistence lands.
- MongoDB Atlas is the target database for sponsor alignment.
- Mirage MIT-licensed code may be reused with attribution. PathSense, LureLore, and ShipSense owners approved reuse for this hackathon project; attribution is tracked in `NOTICE.md`.
