# Guardian Road

> Phones become road safety sensors. Mount on a bike, scooter, or dashboard — Guardian Road detects hazards in real time, voices alerts, and gives cities the data to fix dangerous streets.

**HackDavis 2026** · Davis, CA

---

## What it does

A unified safety pipeline for shared roads, running across three sensor modes:

| Type | Mode | Role |
|------|--------|------|
| **01** | Bike | Rider-mounted detection of vehicles, pedestrians, door zones, blocked bike lanes |
| **02** | Scooter | Same pipeline, tuned for scooter speeds and shared micro-mobility paths |
| **03** | Car | Dashcam mode warning drivers about cyclists, pedestrians, and unsafe passing |

Every detected hazard becomes a **geotagged event** with a saved video clip, a spoken alert, a 3D replay, and aggregated heatmap data the city can act on.

## The pipeline

```
camera + GPS + IMU
  → on-device YOLO detection
  → cloud frame analysis (Gemini)
  → spoken alert (ElevenLabs)
  → saved event (MongoDB Atlas)
  → records dashboard
  → 3D replay (Three.js / R3F)
  → Davis danger map
  → city safety report (Claude)
```

## Stack

**Native iOS** (`GuardianRoad/`) — SwiftUI dashcam app with multicam picture-in-picture, full Apple Maps navigation overlay (compass, minimap, turn-by-turn in imperial units), live YOLO frame inference, voice command (`"save clip"`), and a clip gallery with full-screen playback.

**Next.js web** (`src/app/`) — Backend APIs and dashboards. Records console, replay console, scenario generator, safety report exports.

**Python YOLO sidecar** (`services/yolo/`) — FastAPI server running YOLOv8 for real-time perception. Falls back gracefully when offline.

**Three.js replay** (`src/components/replay/`) — R3F scene reconstructing rides as a road ribbon following the GPS curve, with bike + car actors, lane markings, hazard markers, and timeline scrubbing.

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
cp .env.example .env.local
# Fill in API keys (or leave blank for stub fallbacks)
npm install
npm run dev
```

Open <http://localhost:3000>.

Verify everything is wired:

```bash
npm run demo:doctor
```

### 2. YOLO sidecar (optional, for live detection)

```bash
cd services/yolo
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

Then add to `.env.local`:

```
YOLO_SERVICE_URL=http://127.0.0.1:8000
```

### 3. Native iOS app

```bash
xcodegen generate
open GuardianRoad.xcodeproj
```

In Xcode → Signing & Capabilities → set your team and a unique bundle identifier (e.g. `com.yourname.guardianroad`). Plug in an iPhone or iPad and hit ▶.

The app reads `apiBase` from `AppConfig.swift` — set it to your Mac's LAN IP so the device can reach the backend over Wi-Fi:

```bash
ipconfig getifaddr en0
```

## Project layout

```
GuardianRoad/              Native iOS dashcam app (SwiftUI)
  Core/Camera/             Multicam capture + rolling recorder
  Core/Navigation/         CoreLocation heading + MapKit routing
  Core/Perception/         YOLO client, scene depth manager
  Core/Voice/              SFSpeechRecognizer "save clip" voice command
  Core/Gallery/            Saved events client
  UI/                      DashcamView, NavigationOverlay, GalleryView

src/                       Next.js web app
  app/                     Pages + API routes
    api/                   Rides, events, perception, AI, scenarios
    capture/               Browser-based capture sensor
    records/               Records console
    replay/[rideId]/       3D replay page
  components/replay/       Three.js scene + console
  components/records/      Records UI
  lib/                     AI, db, perception, scenarios, contracts

apps/mobile/               Expo React Native app (Expo Go)

services/yolo/             Python YOLOv8 FastAPI sidecar

scripts/                   Smoke tests, demo doctor, scenario gen
```

## Demo flow

1. **Start a ride** in the iOS app (red recording dot) → GPS + camera + perception begin
2. **Hazards trigger automatically** when YOLO detects a high-risk scene → voice alert + saved clip
3. **Or say `"save clip"`** to manually capture the current frame
4. **Open the gallery** → tap any clip to play full-screen
5. **On the web dashboard**, view the records console, the 3D replay of the ride, and Claude's generated safety report for the corridor

## Docs

- `AGENTS.md` — file ownership and coordination
- `docs/PROJECT_BRIEF.md` — product brief and demo arc
- `docs/API_CONTRACT.md` — shared data contract
- `docs/BACKEND_WIRED_RUNBOOK.md` — full endpoint matrix and demo commands
- `docs/YOLO_MOBILE_RUNBOOK.md` — Next + YOLO sidecar over LAN
- `docs/SPONSOR_SETUP.md` — Atlas / Gemini / Anthropic / ElevenLabs setup
- `docs/FRONTEND_POLISH_PLAN.md` — UI polish plan

## Tracks

**Primary:**

1. Best Hack for Social Good
2. Best AI/ML Hack — sponsored by Anthropic
3. Best Use of Gemini API
4. Best Use of ElevenLabs
5. Best Use of MongoDB Atlas

**Secondary:**

- Best UI/UX Design — sponsored by Figma
- Best Hardware Hack
- Most Technically Challenging Hack
- Best Use of DAC Materials
- Best use of Reconstruct
- Hacker's Choice

---

Built at HackDavis 2026.
