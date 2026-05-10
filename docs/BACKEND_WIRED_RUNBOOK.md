# Backend Wired Runbook

Guardian Road's backend is wired for the HackDavis demo. Replay, records, capture, scenario, report, media, voice, and database-status routes all return stable JSON envelopes from `src/lib/contracts.ts`. The app works with no secrets by using the memory store and deterministic/stub AI providers; adding secrets or `YOLO_SERVICE_URL` turns on MongoDB Atlas, Gemini, Claude, ElevenLabs, and YOLO paths without changing client contracts.

## Wired API surface

Use `http://localhost:3000` as the local base URL.

| Surface | Endpoint | Status | Used by |
|---|---|---|---|
| Seed data | `POST /api/seed/demo` | Wired; resets demo ride, events, and danger segments | Everyone before demo |
| Rides | `GET /api/rides`, `POST /api/rides`, `GET /api/rides/:rideId`, `POST /api/rides/:rideId/route`, `PATCH /api/rides/:rideId/end` | Wired; memory or Mongo persistence | Capture, replay, records |
| Events | `GET /api/events`, `POST /api/events`, `POST /api/events/batch`, `GET /api/events/near` | Wired; filters by ride/type/severity/mode/camera | Records, capture, map |
| Replay | `GET /api/replay/:rideId` | Wired; main replay payload | 3D replay |
| Danger segments | `GET /api/danger-segments` | Wired; recomputed from events with stable seeded IDs | Records, map, reports |
| Media evidence | `POST /api/media/upload` | Wired; local uploads under `public/generated/uploads` | Capture, records |
| YOLO detect (proxy) | `POST /api/perception/detect` | Wired; proxies to Python sidecar when `YOLO_SERVICE_URL` is set; 503 with `note` when unset | Mobile, tools |
| Analyze and save | `POST /api/media/analyze-and-save` | Wired; optional `useYolo` runs COCO YOLO when perception omitted; Gemini when keyed (objects from YOLO, rider copy from Gemini when both) | Capture, mobile |
| Frame analysis | `POST /api/ai/analyze-frame` | Wired; Gemini when keyed, perception/stub fallback otherwise | Capture |
| Reports | `POST /api/ai/report`, `POST /api/reports/export` | Wired; Claude when keyed, deterministic report fallback otherwise; exports persist under `public/generated/reports` | Records, judges |
| Voice alerts | `POST /api/voice/alert` | Wired; ElevenLabs when keyed, `audioUrl: null` fallback otherwise | Capture/rider mode |
| Scenario Lab | `GET /api/scenarios`, `POST /api/scenarios`, `POST /api/scenarios/jobs`, `GET /api/scenarios/jobs/:jobId` | Wired; deterministic prompt-to-road-danger output plus in-memory job polling | Demo/judges |
| DB status | `GET /api/db/status` | Wired; reports Atlas configuration and connection | Demo sanity check |
| Provider status | `GET /api/providers/status` | Wired; reports sanitized configured/available status for Atlas, Gemini, Claude, ElevenLabs, YOLO, uploads, and local fallback | Demo sanity check |

The demo ride ID is `demo-ride-1`. Replay friends should load `/api/replay/demo-ride-1`. Records friends should load `/api/events?rideId=demo-ride-1`, `/api/danger-segments`, and `/api/ai/report`.

## Environment keys

Copy `.env.example` to `.env.local`. Do not commit `.env.local` or real keys.

| Key | Required for local demo? | Enables |
|---|---:|---|
| `MONGODB_URI` | No | MongoDB Atlas persistence and geospatial queries |
| `MONGODB_DB` | No | Database name; defaults to `guardian-road` |
| `GEMINI_API_KEY` | No | Gemini frame hazard analysis |
| `GEMINI_MODEL` | No | Gemini model; defaults to `gemini-1.5-flash` |
| `ANTHROPIC_API_KEY` | No | Claude safety reports |
| `ANTHROPIC_MODEL` | No | Claude model; defaults to `claude-3-5-sonnet-latest` |
| `ELEVENLABS_API_KEY` | No | Hosted alert audio generation |
| `ELEVENLABS_VOICE_ID` | No | ElevenLabs voice; defaults to Rachel sample ID |
| `ELEVENLABS_MODEL_ID` | No | ElevenLabs model; defaults to `eleven_multilingual_v2` |
| `ELEVENLABS_OUTPUT_FORMAT` | No | ElevenLabs audio format; defaults to `mp3_44100_128` |
| `NEXT_PUBLIC_APP_URL` | No | Public app URL for local links; defaults in `.env.example` to `http://localhost:3000` |
| `YOLO_SERVICE_URL` | No | Python FastAPI sidecar (`services/yolo`), e.g. `http://127.0.0.1:8000` or `http://<LAN-ip>:8000` so the Next server can proxy detection for phones on Wi‑Fi; readiness reports only the parsed host |

With no keys, the backend still runs the full demo arc through memory persistence plus deterministic/stub providers. Judges can see the contract and UI flow without waiting on vendor accounts.

## Demo runbook

Terminal A:

```bash
cp .env.example .env.local
npm install
npm run dev
```

Terminal B:

```bash
npm run demo:doctor
curl http://localhost:3000/api/db/status
curl http://localhost:3000/api/providers/status
curl http://localhost:3000/api/replay/demo-ride-1
curl 'http://localhost:3000/api/events?rideId=demo-ride-1'
curl -X POST http://localhost:3000/api/rides/demo-ride-1/route \
  -H 'content-type: application/json' \
  -d '{"point":{"t":445,"lat":38.54499,"lng":-121.73555,"speedMps":4.2,"headingDeg":88}}'
curl http://localhost:3000/api/danger-segments
curl -X POST http://localhost:3000/api/ai/report \
  -H 'content-type: application/json' \
  -d '{"segmentId":"seg-russell-olive"}'
curl -X POST http://localhost:3000/api/reports/export \
  -H 'content-type: application/json' \
  -d '{"segmentId":"seg-russell-olive","format":"pdf-text"}'
# response includes exportUrl, for example /generated/reports/seg-russell-olive-guardian-road-report.txt
JOB_ID=$(curl -s -X POST http://localhost:3000/api/scenarios/jobs \
  -H 'content-type: application/json' \
  -d '{"prompt":"blocked bike lane with cones near campus","seed":42}' | node -pe 'JSON.parse(require("node:fs").readFileSync(0, "utf8")).id')
curl http://localhost:3000/api/scenarios/jobs/$JOB_ID
```

Optional full smoke check:

```bash
npm run typecheck
npm run build
npm run smoke:api
npm run smoke:report
npm run smoke:yolo
```

`npm run demo:doctor` checks an already-running server at `API_BASE_URL` (default `http://localhost:3000`). It seeds the demo, reads readiness and provider status, validates `/api/replay/demo-ride-1`, `/api/events?rideId=demo-ride-1`, and `/api/danger-segments`, then prints fixes for missing seeded data, unwritable uploads, degraded MongoDB, and unset or unreachable YOLO. `npm run smoke:api` starts a temporary Next server if `API_BASE_URL` is not set, seeds demo data, exercises readiness/provider status plus replay/events/media/report/scenario endpoints, verifies the persisted report `exportUrl`, and stops the server. `npm run smoke:report` exercises `/api/ai/report` and `/api/reports/export` against `GUARDIAN_ROAD_BASE_URL`, then `API_BASE_URL`, then `http://localhost:3000`; it preserves `GUARDIAN_ROAD_BASE_URL` for existing report-export workflows. `npm run smoke:yolo` checks provider YOLO readiness plus `POST /api/perception/detect` when a Next server is reachable; it exits 0 with a skip note when the server is down or `YOLO_SERVICE_URL` is unset.

## Repo reuse permission note

Mirage is MIT licensed, so Mirage-derived viewer/scenario architecture can be copied with attribution. PathSense, LureLore, and ShipSense did not expose top-level licenses when inspected, but their owners approved Guardian Road reuse for this hackathon project. Keep any copied or closely adapted patterns attributed in `NOTICE.md`; do not import assets or large code blocks from unlicensed repos unless the permission remains clear.

## Exactly what remains

Backend contracts are no longer the blocker. The remaining work is:

1. **Secrets:** add real hackathon keys in `.env.local` for Atlas, Gemini, Claude, and ElevenLabs. These are operational secrets, not code changes, and must stay out of git.
2. **Friends UI:** build the 3D replay UI under replay-owned paths and the records dashboard under records-owned paths. Both should consume the endpoints above and the shared types from `src/lib/contracts.ts`.
3. **Demo polish:** run the seed command before presenting, then show capture or curl-created events flowing into records, replay, danger segments, and report export.

Do not add replay or records UI inside docs/backend work. If a contract change becomes necessary, update `src/lib/contracts.ts`, `docs/API_CONTRACT.md`, and `docs/INTEGRATION_STATUS.md` in the same commit.
