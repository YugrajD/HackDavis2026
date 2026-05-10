# Guardian Road

> Cyclists die from preventable collisions. Most never get a chance to file a report or warn the next rider. Guardian Road is a phone-mounted dashcam that detects close passes, doorings, and other road hazards in real time, voices the alert, saves a 60-second clip, and aggregates them into geofenced danger zones the city can act on.

**HackDavis 2026** · Davis, CA

---

## What it does

A unified safety pipeline for shared roads, running across three sensor modes:

| # | Mode | Role |
|---|------|------|
| 01 | Bike | Rider-mounted detection of vehicles, pedestrians, door zones, blocked bike lanes |
| 02 | Scooter | Same pipeline, retuned for scooter speeds and shared micro-mobility paths |
| 03 | Car | Dashcam mode warning drivers about cyclists, pedestrians, and unsafe passing |

Every detected hazard becomes a geotagged event with a saved clip, a spoken alert, a 3D replay, and aggregated heatmap data for the city.

## How it works

```
camera + GPS + IMU
  → on-device YOLO detection
  → cloud frame analysis (Gemini)
  → spoken alert (ElevenLabs)
  → saved event (MongoDB Atlas, 2dsphere index)
  → records dashboard
  → 3D replay (Three.js / R3F)
  → Davis danger map
  → city safety report (Claude)
```

The Next.js server is the single source of truth. The iOS app and the web records console consume the same `/api/*` contract — `src/lib/contracts.ts`.

## Stack

- **Native iOS** (`GuardianRoad/`) — SwiftUI dashcam with multicam picture-in-picture, Apple Maps navigation overlay (compass, minimap, turn-by-turn imperial), live YOLO frame inference, voice command ("save clip"), and a clip gallery with full-screen playback.
- **Next.js web** (`src/app/`) — Backend APIs and dashboards. Records console, replay console, scenario generator, safety-report export.
- **Python YOLO sidecar** (`services/yolo/`) — FastAPI server running YOLOv8 for real-time perception. Degrades gracefully when offline.
- **Three.js replay** (`src/components/replay/`) — R3F scene reconstructing the ride as a road ribbon along the GPS curve, with actors, lane markings, hazard markers, and timeline scrubbing.

## Sponsor integrations

| Sponsor | Role |
|---------|------|
| **MongoDB Atlas** | Ride + event persistence with geo indexing |
| **Gemini** | Vision frame analysis |
| **Claude** | City corridor safety report generation |
| **ElevenLabs** | Real-time voice hazard alerts |
| **YOLO** | On-device perception |

## Quick start

### 1. Backend (Next.js)

```bash
cp .env.example .env.local      # MONGODB_URI, GEMINI_API_KEY, ANTHROPIC_API_KEY, ELEVENLABS_API_KEY
npm install
npm run dev
```

Open <http://localhost:3000>. Verify the wiring:

```bash
npm run demo:doctor
```

The doctor seeds `demo-ride-1`, then pings readiness, providers, replay, events, and danger segments.

### 2. YOLO sidecar (optional, for live detection)

```bash
cd services/yolo
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

Add to `.env.local`:

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

1. **Start a ride** in the iOS app (red recording dot) — GPS, camera, and perception begin.
2. **Hazards trigger automatically** when YOLO detects a high-risk scene → voice alert + saved clip.
3. **Or say "save clip"** to capture the current frame.
4. **Open the gallery** → tap any clip to play full-screen.
5. **On the web dashboard**, view the records console, the 3D replay of the ride, and Claude's generated safety report for the corridor.

## Project layout

```
GuardianRoad/              Native iOS dashcam app (SwiftUI)
  Core/Camera/             Multicam capture + rolling recorder
  Core/Navigation/         CoreLocation heading + MapKit routing
  Core/Perception/         YOLO client, scene depth manager
  Core/Gallery/            Saved events client
  UI/                      DashcamView, NavigationOverlay, GalleryView

src/                       Next.js web app
  app/                     Pages + API routes
    api/                   Rides, events, perception, AI, scenarios
    records/               Records console
    replay/[rideId]/       3D replay page
  components/replay/       Three.js scene + console
  components/records/      Records UI
  lib/                     AI, db, perception, scenarios, contracts

services/yolo/             Python YOLOv8 FastAPI sidecar
scripts/                   Demo doctor + scenario generator
```

## Tracks

**Primary** — Best Hack for Social Good · Best AI/ML Hack (Anthropic) · Best Use of Gemini API · Best Use of ElevenLabs · Best Use of MongoDB Atlas

**Secondary** — Best UI/UX Design (Figma) · Best Hardware Hack · Most Technically Challenging Hack · Best Use of DAC Materials · Best Use of Reconstruct · Hacker's Choice

## Acknowledgments

Davis is a bike town. Cyclists die in it anyway. We built this because we ride it.
