# Integration Status

Update this whenever a shared contract changes or someone is blocked.

## Backend wired handoff

Backend is ready for friends and judges. The complete endpoint matrix, env keys, runbook, repo reuse permission note, and remaining-work list live in `docs/BACKEND_WIRED_RUNBOOK.md`.

Use this sequence for demos. Terminal A:

```bash
cp .env.example .env.local
npm install
npm run dev
```

Terminal B:

```bash
curl -X POST http://localhost:3000/api/seed/demo
curl http://localhost:3000/api/replay/demo-ride-1
curl 'http://localhost:3000/api/events?rideId=demo-ride-1'
curl http://localhost:3000/api/danger-segments
```

No vendor key is required for the local demo. Real `MONGODB_URI`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, and `ELEVENLABS_API_KEY` remain secrets in `.env.local` only.

## Current owner map

| Area | Owner | Paths | Status |
|---|---|---|---|
| Backend/API | Aktan/backend owner | `src/app/api/**`, `src/lib/db/**`, `src/lib/contracts.ts` | Wired for demo; see `docs/BACKEND_WIRED_RUNBOOK.md` |
| 3D Replay | Replay friend | `src/app/replay/**`, `src/components/replay/**` | Unblocked by `/api/replay/demo-ride-1` |
| Records | Records friend | `src/app/records/**`, `src/components/records/**` | Unblocked by `/api/events`, `/api/danger-segments`, `/api/ai/report`, `/api/reports/export` |
| Shell/design/docs | Orchestrator | `src/app/page.tsx`, `src/components/shell/**`, `docs/**` | Shell scaffolded |
| Mobile (Expo) | Orchestrator / team | `apps/mobile/**` | Wi‑Fi capture → same APIs as web; set `EXPO_PUBLIC_API_BASE_URL` to laptop LAN |

## Shared contract changes

- Initial contract is mirrored in `src/lib/contracts.ts` for app code.
- Added explicit response envelopes for rides, events, danger segments, reports, and voice alerts.
- Added memory-backed API stubs for ride creation/end, event creation/batch/nearby, frame analysis, report generation, and voice alerts.
- Added `/api/media/upload` for frame/clip evidence stored under `public/generated/uploads`, returning `clipUrl` and `thumbnailUrl` for hazard events.
- Added reuse ports/helpers: `/api/scenarios`, `/api/media/analyze-and-save`, `/api/reports/export`, a Spark/Three `SplatViewer`, perception worker helpers, hotspot utilities, and report exporters.
- Added `POST /api/rides/:rideId/route` so live capture can append route points to memory or Mongo-backed rides and refresh replay stats.
- Added PathSense-style perception contracts for frame detections, local tracks, risk payloads, and worker output. `/api/ai/analyze-frame` and `/api/media/analyze-and-save` now accept optional `perception` payloads and can return provider `perception` when Gemini is not configured.
- Added Wi‑Fi / LAN **YOLOv8 (COCO)** path: Python sidecar under `services/yolo`, env `YOLO_SERVICE_URL`, Next proxy `POST /api/perception/detect`, and `useYolo` on `POST /api/media/analyze-and-save` (optional `yoloNote` on error). Expo client lives in `apps/mobile` with `EXPO_PUBLIC_API_BASE_URL`.
- Backend readiness pass added JSON error envelopes, bounded JSON bodies, stricter media MIME/signature checks, route parameter safeguards, and deployment notes in `docs/BACKEND_DEPLOYMENT.md`.
- Scenario/report wiring pass added deterministic `/api/scenarios` GET/POST payloads, replay-ready scenario output, shared report/export contracts, and `/api/reports/export` `pdf-text` output.
- Report/export now preserve documented seeded segment IDs after danger-segment recomputation. Known demo clusters get stable IDs during recompute, and `segmentId` lookup falls back by seeded label, top hazard types, and location.

## Current integration assumptions

- Demo ride ID: `demo-ride-1`.
- Replay should load `/api/replay/demo-ride-1`.
- Records should load `/api/events?rideId=demo-ride-1` and `/api/danger-segments`.
- Seed endpoint should be `/api/seed/demo`.
- Capture ingestion page is `/capture`; it posts a frame to `/api/media/upload`, runs the browser perception worker, sends frame + media URLs + worker output to `/api/media/analyze-and-save`, and asks `/api/voice/alert` for alert audio or native TTS fallback.

## Blockers

None for replay or records. Both can build from seeded API responses now.

Remaining work is limited to secrets and friends UI:

- Add real Atlas/Gemini/Claude/ElevenLabs keys to `.env.local` for sponsor-backed live paths.
- Build replay-owned UI under `src/app/replay/**`, `src/components/replay/**`, and `src/lib/replay/**`.
- Build records-owned UI under `src/app/records/**`, `src/components/records/**`, and `src/lib/records/**`.

## Decisions

- Build seeded demo data first so replay and records can proceed independently.
- Keep demo API stubs backed by `src/lib/db/store.ts` and `src/lib/seed/demo-data.ts` until MongoDB persistence lands.
- MongoDB Atlas is the target database for sponsor alignment.
- Mirage MIT-licensed code may be reused with attribution. PathSense, LureLore, and ShipSense owners approved reuse for this hackathon project; attribution is tracked in `NOTICE.md`.
