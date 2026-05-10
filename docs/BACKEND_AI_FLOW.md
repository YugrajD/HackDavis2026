# Backend and AI Flow

Guardian Road has two backend jobs:

1. Turn camera frames and ride telemetry into structured road-safety events.
2. Turn repeated events into replay payloads, danger segments, reports, and voice alerts.

The backend is built so every sponsor integration can fail independently without breaking the demo. If MongoDB, Gemini, Claude, ElevenLabs, or YOLO is missing, the same API shape still returns a useful fallback response. Adding keys upgrades the provider path; it does not require UI or contract changes.

## Runtime pieces

### Next.js API server

The Next app owns all public API routes under `src/app/api/**`. These routes validate input, call provider helpers, write to the repository layer, and return stable JSON contracts from `src/lib/contracts.ts`.

Important routes:

| Route | Job |
| --- | --- |
| `POST /api/media/upload` | Store image/clip evidence under generated local files. |
| `POST /api/media/analyze-and-save` | Main camera ingest path: optional YOLO, optional Gemini, persist event. |
| `POST /api/ai/analyze-frame` | Analyze one frame without saving an event. |
| `POST /api/events` | Save a direct hazard event. |
| `GET /api/replay/:rideId` | Return the ride, ordered events, and danger segments for replay UI. |
| `GET /api/danger-segments` | Return clustered danger map segments. |
| `POST /api/ai/report` | Generate a civic safety report for a segment. |
| `POST /api/reports/export` | Export the report as markdown, HTML, CSV, or PDF-like text. |
| `POST /api/voice/alert` | Generate ElevenLabs audio or return text fallback. |
| `GET /api/providers/status` | Show which integrations are configured and available without leaking secrets. |
| `GET /api/health/readiness` | Demo readiness check: database, providers, storage, seeded counts. |

### Repository layer

The repository lives in `src/lib/db/**`.

- If `MONGODB_URI` is not set, it uses an in-memory store.
- If MongoDB is configured and healthy, it uses Atlas collections.
- The API response includes `persisted: "memory" | "mongodb"` where useful, so the UI can explain what happened.

Core entities:

- `Ride`: mode, route points, start/end times, aggregate stats.
- `HazardEvent`: one detected hazard with location, time, type, severity, explanation, alert text, media URLs, and objects.
- `DangerSegment`: a clustered danger area computed from events.
- `ReplayPayload`: ride + timeline events + danger segments.

### Generated file storage

Local demo media and report exports are written under `public/generated/**` and ignored by git.

- Uploads: `public/generated/uploads/**`
- Reports: `public/generated/reports/**`
- Scenarios: `public/generated/scenarios/**`

This is correct for local judging. A real deployment should switch to object storage because serverless filesystems are ephemeral.

## Main capture flow

The web and Expo capture clients follow the same backend path.

1. Start or reuse a ride.
2. Capture a frame and current telemetry.
3. Upload the compressed frame evidence with `POST /api/media/upload`.
4. Analyze and save the event with `POST /api/media/analyze-and-save`.
5. Append the route point with `POST /api/rides/:rideId/route`.
6. Generate or return a voice alert with `POST /api/voice/alert`.
7. End the ride with `PATCH /api/rides/:rideId/end`.

Simplified sequence:

```txt
Phone/Web camera
  -> /api/media/upload
      -> local generated media URL
  -> /api/media/analyze-and-save
      -> YOLO sidecar if useYolo=true and YOLO_SERVICE_URL is set
      -> Gemini if GEMINI_API_KEY is set and imageBase64 exists
      -> deterministic fallback if providers are missing or fail
      -> repository.createEvent()
      -> danger segment recompute/update
  -> /api/rides/:rideId/route
  -> /api/voice/alert
      -> ElevenLabs if key is set
      -> text/native-speech fallback otherwise
```

## What YOLO does

YOLO is the fast object detector. It answers concrete visual questions:

- Is there a car, truck, bus, bike, pedestrian, cone, or obstruction in the frame?
- Where is the object in the image?
- What confidence does the detector have?

In this project the Python sidecar in `services/yolo/**` exposes:

- `GET /health`
- `POST /detect`

The Next backend calls it through `src/lib/perception/yolo-client.ts`, then converts detections into Guardian Road perception state with `src/lib/perception/yolo-perception.ts` and `src/lib/perception/frame-pipeline.ts`.

YOLO is useful because it is deterministic, local, fast when warm, and explainable as object detection. It gives the system grounded geometry and object tracks instead of relying only on a multimodal language model.

YOLO does **not** fully solve the hazard problem. A bounding box is not enough to decide whether the rider needs a voice alert.

## What Gemini does

Gemini is the multimodal reasoning layer in `src/lib/ai/hazard-analysis.ts`.

When `GEMINI_API_KEY` is set and the request includes `imageBase64`, the backend sends Gemini:

- the camera frame,
- latitude and longitude,
- speed,
- heading,
- camera role,
- optional local perception/YOLO summary.

Gemini returns structured JSON matching the hazard schema:

```ts
{
  type: HazardType;
  severity: number;       // 0-100
  confidence: number;     // 0-1
  spokenAlert: string;    // short rider-safe warning
  explanation: string;    // human-readable evidence
  objects: TrackedObject[];
}
```

The backend normalizes Gemini output so it always fits Guardian Road contracts. If Gemini times out, returns invalid JSON, or is missing, the backend falls back to local perception or deterministic stub analysis.

## Why we use Gemini if YOLO already detects objects

YOLO detects objects. Gemini explains hazards.

That distinction matters. Guardian Road is not just an object detector; it is a road-safety decision system. The UI and reports need a typed hazard, a severity score, a short voice warning, and an explanation that a rider, driver, judge, or city planner can understand.

Concrete examples:

| Situation | YOLO sees | Gemini adds |
| --- | --- | --- |
| Car behind rider | `car` bounding box | "Vehicle closing from behind", severity, short alert, explanation. |
| Truck near bike lane | `truck` box, maybe lane context absent | Interprets whether it is a close pass, lane blockage, or harmless parked vehicle. |
| Cone or debris | `cone` or `obstacle` | Decides whether it blocks the rider path and writes a useful warning. |
| Intersection frame | cars/pedestrians/bikes | Infers conflict risk from camera role, heading, speed, and scene context. |
| Bad YOLO result | no detections or service down | Gemini can still reason from the image, or fallback keeps the demo running. |

The best path is hybrid:

1. YOLO provides object grounding and bounding boxes.
2. The local perception pipeline turns detections into tracks and rough risk.
3. Gemini uses that perception as a prior, checks the image, and writes better alert/report language.
4. The backend preserves YOLO geometry when both are available, while using Gemini for spoken alert and explanation copy.

This hybrid approach is stronger for sponsor judging:

- **Gemini track**: real multimodal frame understanding and structured JSON output.
- **AI/ML track**: YOLO object detection plus risk scoring.
- **Social good track**: warnings and reports are understandable by humans, not just bounding boxes.
- **Demo reliability**: either provider can fail and the event pipeline still works.

## Provider priority in `/api/media/analyze-and-save`

The backend chooses providers in this order:

1. If `useYolo=true` and YOLO is configured, call YOLO to create a local `PerceptionResult`.
2. If Gemini is configured and an image is present, call Gemini.
3. If both Gemini and YOLO perception exist:
   - keep YOLO/local perception type, severity, confidence, and objects,
   - use Gemini for better `spokenAlert` and `explanation`.
4. If Gemini fails but perception exists, save provider `perception`.
5. If neither provider is available, save provider `stub`.

The response can include `yoloNote` when YOLO was requested but unavailable. That lets the UI explain degraded mode without blocking capture.

## Claude report flow

Claude is used for civic reporting, not frame detection.

Route:

```txt
POST /api/ai/report
```

Input:

- `segmentId`, or
- a provided danger segment and events.

Flow:

1. Load the danger segment.
2. Load related events.
3. Ask Claude to write a safety report if `ANTHROPIC_API_KEY` is set.
4. Fall back to deterministic report text if Claude is missing or fails.
5. Return a stable `SafetyReport` contract.

Claude’s job is to turn structured event evidence into a planner-readable summary:

- what happened,
- where it happened,
- why it matters,
- recommended fixes,
- evidence event IDs.

## ElevenLabs voice flow

Route:

```txt
POST /api/voice/alert
```

Input:

```json
{ "text": "Vehicle closing from behind." }
```

Flow:

1. If `ELEVENLABS_API_KEY` is set, call ElevenLabs text-to-speech.
2. Return an audio URL/data payload for playback.
3. If missing or failed, return text fallback so Expo/web can use native speech.

This keeps the live safety loop working even without the sponsor key.

## MongoDB Atlas flow

MongoDB is the durable event/ride/danger segment store.

When configured:

- rides are stored in `rides`,
- hazard events in `events`,
- danger segments in `danger_segments`.

The backend maintains indexes for common queries and geospatial lookup. Demo endpoints can still run without MongoDB, but Atlas turns the project into a real records system instead of a local-only prototype.

## Danger segment flow

Danger segments convert many point events into map-level risk.

Inputs:

- event locations,
- hazard types,
- severity,
- timestamps.

Process:

1. Cluster nearby events.
2. Score each cluster by severity, count, and recency.
3. Pick top hazard types.
4. Generate stable IDs for known demo corridors where possible.
5. Return sorted danger segments for records/reporting/replay.

Used by:

- `GET /api/danger-segments`,
- `GET /api/replay/:rideId`,
- `POST /api/ai/report`,
- `POST /api/reports/export`.

## Scenario jobs

Scenario jobs are deterministic demo generators for replay/report testing.

Routes:

- `GET /api/scenarios`
- `POST /api/scenarios`
- `POST /api/scenarios/jobs`
- `GET /api/scenarios/jobs/:jobId`

They mimic long-running generation without needing external infrastructure. They are useful for showing how Guardian Road could generate replayable safety scenarios from prompts.

## Fallback matrix

| Missing/failing service | Backend behavior | Demo impact |
| --- | --- | --- |
| MongoDB | Uses memory store | Demo works, data is process-local. |
| Gemini | Uses YOLO perception or stub | Detection still saves events, less semantic reasoning. |
| YOLO | Uses Gemini or stub, includes `yoloNote` | Live object detection degrades, capture still works. |
| Claude | Uses deterministic report writer | Reports still generate. |
| ElevenLabs | Returns text/native-speech fallback | Alerts still play through browser/Expo speech if implemented. |
| Upload directory | Readiness shows degraded | Media evidence may fail; event pipeline can still save text data. |

## How to verify the whole backend

Start the app:

```bash
npm run dev
```

Then run:

```bash
npm run demo:doctor
npm run smoke:api
npm run smoke:api:errors
npm run smoke:report
npm run smoke:yolo
npm run smoke:mobile
```

Provider status:

```bash
curl http://localhost:3000/api/providers/status
```

Readiness:

```bash
curl http://localhost:3000/api/health/readiness
```

Seed demo data:

```bash
curl -X POST http://localhost:3000/api/seed/demo
```

Inspect replay payload:

```bash
curl http://localhost:3000/api/replay/demo-ride-1
```

## Environment variables

Root `.env.local`:

```env
MONGODB_URI=
MONGODB_DB=guardian-road
GEMINI_API_KEY=
GEMINI_MODEL=gemini-1.5-flash
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-3-5-sonnet-latest
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM
ELEVENLABS_MODEL_ID=eleven_multilingual_v2
ELEVENLABS_OUTPUT_FORMAT=mp3_44100_128
NEXT_PUBLIC_APP_URL=http://localhost:3000
YOLO_SERVICE_URL=http://127.0.0.1:8000
```

Expo mobile `.env`:

```env
EXPO_PUBLIC_API_BASE_URL=http://YOUR_LAPTOP_LAN_IP:3000
```

The phone talks to Next.js over Wi-Fi. Next.js talks to YOLO through `YOLO_SERVICE_URL`, usually `127.0.0.1:8000` when both run on the laptop.

## Demo story

The clearest judging story is:

1. A rider or dashcam captures a frame.
2. YOLO grounds visible road actors.
3. Gemini interprets the frame and writes a short safety alert.
4. The backend saves a geotagged event to MongoDB.
5. Repeated events form a danger segment.
6. Claude turns the danger segment into a civic safety report.
7. ElevenLabs speaks immediate warnings.
8. Replay and records pages consume the same structured API.

That is the point of the architecture: one capture event feeds immediate safety, persistent records, map-level risk, 3D replay, and civic reporting.
