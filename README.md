# Guardian Road

> Cyclists die from preventable collisions. Most never get a chance to file a report or warn the next rider. Guardian Road is a phone-mounted dashcam that detects close passes, doorings, and other road hazards in real time, saves a rolling clip on a voice command, and aggregates every event into geofenced danger zones the city can act on.

**HackDavis 2026** · Davis, CA

---

## What it does

A unified safety pipeline for shared roads. Every ride is tagged with a `RideMode` (`bike` · `scooter` · `car`) so the same perception loop and danger-segment store serves three sensor classes:

| # | Mode | Role |
|---|------|------|
| 01 | Bike | Rider-mounted detection of vehicles, pedestrians, door zones, blocked bike lanes |
| 02 | Scooter | Same pipeline at scooter speeds and on shared micro-mobility paths |
| 03 | Car | Dashcam mode warning drivers about cyclists, pedestrians, and unsafe passing |

Every detected hazard becomes a geotagged event with a saved clip, a 3D replay, and aggregated heatmap data for the city.

## How it works

The live demo path on the phone:

```
iPhone dual camera (AVCaptureMultiCamSession, front + rear)
  → frame throttle (single-flight, min-interval)
  → POST /api/perception/detect  (Next.js BFF)
  → Python YOLOv8 sidecar (Ultralytics, yolov8n.pt, FastAPI :8000)
  → bounding boxes drawn on the HUD
  → "save clip" voice command (SFSpeechRecognizer, on-device)
  → rolling buffer commits last N seconds to mp4
  → POST /api/media/upload          (clip → server filesystem)
  → POST /api/media/analyze-and-save (event → MongoDB Atlas, 2dsphere)
  → web records console + in-app gallery read /api/events
```

ARKit scene-depth (LiDAR on supported devices) feeds the on-device HUD distance readout — no server call.

The Next.js server is the single source of truth. The iOS app and the web records console consume the same `/api/*` contract — `src/lib/contracts.ts`.

## Stack

- **Native iOS** (`GuardianRoad/`) — SwiftUI dashcam built on `AVCaptureMultiCamSession` for picture-in-picture front+rear capture, an Apple Maps overlay with compass, expandable minimap, and turn-by-turn directions in imperial units, live YOLO frame inference, an `SFSpeechRecognizer` "save clip" voice command, and a clip gallery with full-screen playback.
- **Next.js web** (`src/app/`) — Backend APIs and dashboards. Records console, replay console, scenario lab, safety-report export.
- **Python YOLO sidecar** (`services/yolo/`) — FastAPI server running Ultralytics **YOLOv8-nano** (`yolov8n.pt`, 3.2M parameters, 8.7 GFLOPs, ~6 MB, 80 COCO classes, 640×640 input). 80 COCO labels are remapped server-side to four Guardian Road actor types (`pedestrian`, `bike`, `car/bus/truck`, `obstacle`).
- **R3F replay** (`src/components/replay/`) — `@react-three/fiber` scene reconstructing the ride along the GPS curve, with actors, lane markings, hazard markers, and timeline scrubbing.
- **Marketing site** (`web/`) — separate Next.js landing page (port 3001) telling the cyclist-safety story for non-judges.

## Data model (MongoDB)

Three collections, schema lives in `src/lib/contracts.ts` (no ORM, the type is the contract):

| Collection | Shape | Indexes |
|---|---|---|
| `rides` | `{ id, mode, startedAt, endedAt?, startLat, startLng, route[], stats }` | unique `id`, `{mode,id}`, `{startedAt:-1, id}` |
| `events` | `{ id, rideId, t, timestamp, type, severity, confidence, lat, lng, headingDeg, speedMps, camera, spokenAlert, explanation, clipUrl?, thumbnailUrl?, objects[], location }` | unique `id`, **2dsphere on `location`**, `{rideId,t}`, `{type,timestamp:-1}`, `{severity:-1, timestamp:-1}` |
| `danger_segments` | `{ id, label, centerLat, centerLng, score, eventCount, topTypes[], lastSeen, explanation, location }` | unique `id`, 2dsphere, `{score:-1, eventCount:-1, lastSeen:-1}` |

Every read uses `projection: { _id: 0 }`, so the wire format equals the TypeScript type — same shape on the phone, the server, and the dashboard. GeoJSON `location` is injected at write time so 2dsphere works without devs typing GeoJSON.

## Server-side integrations

These run server-side via Next route handlers and dashboard flows. They sit behind dashboard endpoints that operate on already-saved events; the live iOS detection loop only depends on YOLO and Mongo.

| Sponsor | Role | Endpoint |
|---|---|---|
| **MongoDB Atlas** | Ride + event persistence with geo indexing | all `/api/rides`, `/api/events`, `/api/danger-segments` |
| **YOLOv8** (Ultralytics) | Real-time object detection | `/api/perception/detect` → `services/yolo` |
| **Gemini** (1.5 Flash) | Optional vision cross-check on saved frames | `/api/ai/analyze-frame` |
| **Claude** (3.5 Sonnet) | Corridor safety report generation | `/api/ai/report` |
| **ElevenLabs** | TTS for hazard alerts | `/api/voice/alert` |

If a key is missing the server falls back gracefully: no Mongo → in-memory store, no Gemini → deterministic stub, no Claude → stub report, no ElevenLabs → 503 (iOS uses `AVSpeechSynthesizer`). Every external dependency is optional. The demo runs end-to-end with only Mongo and the YOLO sidecar live.

## Quick start

### 1. Backend (Next.js)

```bash
cp .env.example .env.local      # MONGODB_URI is the only one required
npm install
npm run dev
```

Open <http://localhost:3000>. Verify the wiring:

```bash
npm run demo:doctor
```

The doctor seeds `demo-ride-1`, then pings readiness, providers, replay, events, and danger segments.

### 2. YOLO sidecar (required for live detection)

```bash
cd services/yolo
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

First run downloads `yolov8n.pt` (~6 MB) into the working directory. Add to `.env.local`:

```
YOLO_SERVICE_URL=http://127.0.0.1:8000
```

### 3. Native iOS app

```bash
xcodegen generate
open GuardianRoad.xcodeproj
```

In Xcode → Signing & Capabilities → set your team and a unique bundle identifier. Plug in an iPhone or iPad and hit ▶ — camera and LiDAR don't run in the simulator.

The app reads its API URL from `GuardianRoad/Core/Perception/AppConfig.swift`. Set it to your Mac's LAN IP (or current ngrok URL) so the device can reach the backend:

```bash
ipconfig getifaddr en0
```

## Demo flow

1. **Start a ride** in the iOS app — GPS, dual cameras, and perception begin.
2. **Live detection** — YOLOv8 boxes render over the rear-camera feed at sub-100 ms LAN round-trip.
3. **Save a clip** — say "save clip" or tap the button. Rolling buffer commits the last few seconds to mp4.
4. **Server persists** — clip uploads, hazard event lands in MongoDB with a geo-indexed `location`.
5. **Open the gallery** in-app → tap any clip to play full-screen.
6. **Open the dashboard** at `/records` → see the same events on a map, scrub the 3D replay at `/replay/[rideId]`, generate a corridor safety report.

## Project layout

```
GuardianRoad/              Native iOS dashcam app (SwiftUI)
  Core/Camera/             AVCaptureMultiCamSession + rolling recorder
  Core/Navigation/         CoreLocation + MapKit routing
  Core/Perception/         YOLO client + ARKit scene-depth manager
  Core/Gallery/            Saved events client
  UI/                      DashcamView, NavigationOverlay, GalleryView

src/                       Next.js dashboard + API
  app/                     Pages + API routes
    api/                   rides, events, perception, ai, scenarios, media, voice
    records/               Records console
    replay/[rideId]/       3D replay page
  components/replay/       R3F scene + console
  components/records/      Records UI
  lib/                     ai, db, perception, scenarios, contracts

services/yolo/             Python YOLOv8 FastAPI sidecar
web/                       Marketing landing page (Next.js, :3001)
scripts/                   demo:doctor + scenarios:generate
```

## Tracks

**Primary** — Best Hack for Social Good · Best AI/ML Hack (Anthropic) · Best Use of Gemini API · Best Use of ElevenLabs · Best Use of MongoDB Atlas

**Secondary** — Best UI/UX Design (Figma) · Best Hardware Hack · Most Technically Challenging Hack · Best Use of DAC Materials · Best Use of Reconstruct · Hacker's Choice

## Acknowledgments

Davis is a bike town. Cyclists die in it anyway. We built this because we ride it.
