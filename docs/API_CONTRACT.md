# API Contract

This file defines the shared backend contract. Replay and records should not invent separate shapes.

Backend routes for this contract are wired. Use `docs/BACKEND_WIRED_RUNBOOK.md` for the endpoint matrix, local demo commands, environment keys, and remaining-work list.

## TypeScript contract

The source of truth lives in `src/lib/contracts.ts` and is mirrored here for cross-team reference.

```ts
export type HazardType =
  | "close_pass"
  | "vehicle_approach"
  | "pedestrian_conflict"
  | "pothole"
  | "road_obstruction"
  | "blocked_bike_lane"
  | "door_zone"
  | "hard_brake"
  | "intersection_conflict";

export type ActorType =
  | "rider"
  | "car"
  | "truck"
  | "bus"
  | "bike"
  | "scooter"
  | "pedestrian"
  | "cone"
  | "obstacle";

export type RideMode = "bike" | "scooter" | "car";
export type CameraRole = "front" | "rear" | "dashcam";

export type RoutePoint = {
  t: number;
  lat: number;
  lng: number;
  speedMps: number;
  headingDeg: number;
};

export type Ride = {
  id: string;
  mode: RideMode;
  startedAt: string;
  endedAt?: string;
  startLat: number;
  startLng: number;
  route: RoutePoint[];
  stats: {
    durationSec: number;
    distanceMeters: number;
    maxRisk: number;
    eventCount: number;
  };
};

export type TrackedObject = {
  id: string;
  type: ActorType;
  confidence: number;
  bbox?: [number, number, number, number];
  position?: { x: number; y: number; z: number };
  velocity?: { x: number; y: number; z: number };
  distanceM?: number;
  ttcSec?: number;
};

export type RelativeLocation = "ahead" | "behind" | "left" | "right" | "center" | "unknown";

export type FrameDetection = {
  id?: string;
  label: string;
  description?: string;
  confidence: number;
  bbox?: [number, number, number, number];
  depthM?: number;
  relativeLocation?: RelativeLocation;
};

export type FrameObservation = {
  frameId: string;
  capturedAt: string;
  camera: CameraRole;
  lat?: number;
  lng?: number;
  speedMps?: number;
  headingDeg?: number;
  width?: number;
  height?: number;
  detections: FrameDetection[];
};

export type TrackState = TrackedObject & {
  label?: string;
  description?: string;
  relativeLocation?: RelativeLocation;
  riskScore: number;
  lastFrameId: string;
  lastSeenAt: string;
};

export type PerceptionRisk = {
  type: HazardType;
  severity: number;
  confidence: number;
  spokenAlert: string;
  explanation: string;
  primaryObjectId?: string;
  reasons: string[];
};

export type HazardEventDraft = Pick<
  HazardEvent,
  "type" | "severity" | "confidence" | "spokenAlert" | "explanation" | "objects" | "camera" | "lat" | "lng" | "headingDeg" | "speedMps" | "timestamp" | "t"
>;

export type PerceptionResult = {
  frameId: string;
  capturedAt: string;
  workerVersion: "guardian-road-perception-v1";
  tracks: TrackState[];
  risk: PerceptionRisk;
  hazardDraft: HazardEventDraft;
};

export type HazardEvent = {
  id: string;
  rideId: string;
  t: number;
  timestamp: string;
  type: HazardType;
  severity: number;
  confidence: number;
  lat: number;
  lng: number;
  headingDeg: number;
  speedMps: number;
  camera: CameraRole;
  spokenAlert: string;
  explanation: string;
  clipUrl?: string;
  thumbnailUrl?: string;
  objects: TrackedObject[];
};

export type DangerSegment = {
  id: string;
  label: string;
  centerLat: number;
  centerLng: number;
  score: number;
  eventCount: number;
  topTypes: HazardType[];
  lastSeen: string;
  explanation: string;
};

export type UploadedMedia = {
  kind: "thumbnail" | "clip";
  url: string;
  bytes: number;
  contentType: string;
};

export type MediaUploadResponse = {
  clipUrl?: string;
  thumbnailUrl?: string;
  stored: UploadedMedia[];
  persisted: "public/generated" | "data/uploads";
};

export type ReplayPayload = {
  ride: Ride;
  events: HazardEvent[];
  dangerSegments: DangerSegment[];
  generatedAt: string;
};

export type ScenarioPrompt = {
  prompt?: string;
  prompts?: string[];
  mode?: RideMode;
  camera?: CameraRole;
  lat?: number;
  lng?: number;
  seed?: number;
};

export type ScenarioTimelineItem = Pick<
  HazardEvent,
  "t" | "timestamp" | "type" | "severity" | "confidence" | "lat" | "lng" | "spokenAlert" | "explanation" | "headingDeg" | "speedMps" | "objects"
>;

export type RoadScenario = {
  id: string;
  title: string;
  prompt: string;
  seed: number;
  mode: RideMode;
  camera: CameraRole;
  origin: { lat: number; lng: number };
  route: RoutePoint[];
  timeline: ScenarioTimelineItem[];
  reconstructionHints: {
    splatPrompt: string;
    cameraPath: Array<{ t: number; x: number; y: number; z: number; yawDeg: number }>;
    riskZones: Array<{ t: number; radiusM: number; color: "amber" | "red" }>;
  };
  generatedAt: string;
};

export type ScenarioResponse = {
  scenario: RoadScenario;
  hazardDraft: HazardEventDraft & { rideId: string };
  replayPayload: ReplayPayload;
  provider: "deterministic-scenario-lab";
};

export type SafetyReport = {
  title: string;
  summary: string;
  evidence: string[];
  recommendedFixes: string[];
  generatedAt: string;
  segmentId: string;
  eventIds: string[];
};

export type ReportExportFormat = "markdown" | "html" | "csv" | "pdf-text";

export type ReportExportPayload = {
  report: SafetyReport;
  segment: DangerSegment;
  format: ReportExportFormat;
  document: string;
  filename: string;
  contentType: string;
  generatedAt: string;
  events: Array<Pick<HazardEvent, "id" | "timestamp" | "type" | "severity" | "lat" | "lng" | "camera" | "explanation">>;
};

export type AnalyzeFrameResponse = Pick<HazardEvent, "type" | "severity" | "confidence" | "spokenAlert" | "explanation" | "objects"> & {
  provider: "gemini" | "perception" | "stub";
  perception?: PerceptionResult;
  note?: string;
};

export type AnalyzeAndSaveMediaResponse = {
  event: HazardEvent;
  persisted: "memory" | "mongodb";
  provider: "gemini" | "perception" | "stub";
  perception?: PerceptionResult;
  message: string;
};

export type ReadinessResponse = {
  status: "ready" | "degraded";
  generatedAt: string;
  integrations: {
    mongo: {
      configured: boolean;
      connected: boolean;
      mode: "mongodb" | "memory" | "memory-fallback";
      error?: string;
    };
    gemini: { configured: boolean };
    anthropic: { configured: boolean };
    elevenLabs: { configured: boolean };
    uploads: {
      configured: boolean;
      writable: boolean;
      relativePath: string;
      error?: string;
    };
  };
  data: {
    source: "mongodb" | "memory";
    rides: number;
    events: number;
    dangerSegments: number;
    demoRide: { id: string; present: boolean; eventCount: number };
  };
};
```

## Required endpoints

### `GET /api/rides`

Returns all known rides.

Response:

```json
{ "rides": [] }
```

### `POST /api/rides`

Creates a ride.

Request:

```json
{
  "mode": "bike",
  "startLat": 38.5449,
  "startLng": -121.7405
}
```

Response:

```json
{ "ride": {}, "persisted": "memory" }
```

### `GET /api/rides/:rideId`

Returns one ride.

Response:

```json
{ "ride": {} }
```

### `PATCH /api/rides/:rideId/end`

Ends ride and recalculates stats.

Response:

```json
{ "ride": {} }
```

### `POST /api/events`

Creates one hazard event. Clients may include `clipUrl` and `thumbnailUrl` from `/api/media/upload`.

Response:

```json
{ "event": {}, "persisted": "memory" }
```

### `POST /api/media/upload`

Uploads one frame/thumbnail and/or one clip. The local demo backend stores files under `public/generated/uploads` and returns public URLs that can be attached to `HazardEvent.clipUrl` and `HazardEvent.thumbnailUrl`.

JSON request options:

```json
{
  "imageBase64": "data:image/jpeg;base64,...",
  "clipBase64": "data:video/webm;base64,..."
}
```

Multipart request options:

```txt
frame | image | thumbnail: image file or base64 image
clip | video: video file or base64 video
```

Response:

```json
{
  "clipUrl": "/generated/uploads/clip-...webm",
  "thumbnailUrl": "/generated/uploads/thumbnail-...jpg",
  "stored": [
    { "kind": "thumbnail", "url": "/generated/uploads/thumbnail-...jpg", "bytes": 12345, "contentType": "image/jpeg" }
  ],
  "persisted": "public/generated"
}
```

### `POST /api/media/analyze-and-save`

LureLore-inspired one-shot media pipeline. It accepts a frame plus optional stored media URLs, analyzes through Gemini when configured, persists a `HazardEvent` to MongoDB or memory, and returns the saved event.

Request:

```json
{
  "imageBase64": "data:image/jpeg;base64,...",
  "rideId": "demo-ride-1",
  "lat": 38.5449,
  "lng": -121.7405,
  "speedMps": 5.6,
  "headingDeg": 90,
  "camera": "front",
  "thumbnailUrl": "/generated/uploads/thumbnail.jpg",
  "clipUrl": "/generated/uploads/clip.webm",
  "perception": {
    "frameId": "capture-1",
    "capturedAt": "2026-05-09T00:00:00.000Z",
    "workerVersion": "guardian-road-perception-v1",
    "tracks": [],
    "risk": { "type": "close_pass", "severity": 88, "confidence": 0.91, "spokenAlert": "Vehicle passing close.", "explanation": "Local tracker estimated close-pass risk.", "reasons": [] },
    "hazardDraft": {}
  }
}
```

Response:

```json
{ "event": {}, "persisted": "memory", "provider": "gemini", "perception": {} }
```

### `POST /api/events/batch`

Creates many hazard events.

Request:

```json
{ "events": [] }
```

Response:

```json
{ "events": [], "persisted": "memory" }
```

### `GET /api/events?rideId=...`

Returns events. Optional filters may be added: `type`, `minSeverity`, `mode`, `camera`.

Response:

```json
{ "events": [] }
```

### `GET /api/events/near?lat=...&lng=...&radiusM=...`

Returns nearby events. Mongo geospatial queries can replace the in-memory Haversine implementation without changing the envelope.

Response:

```json
{ "events": [] }
```

### `GET /api/replay/:rideId`

The main replay contract. Replay owner should only need this endpoint.

Response:

```json
{
  "ride": {},
  "events": [],
  "dangerSegments": [],
  "generatedAt": "2026-05-09T00:00:00.000Z"
}
```

### `GET /api/danger-segments?bbox=...`

Returns dangerous street/area segments for the map and records dashboard.

Response:

```json
{ "dangerSegments": [] }
```

### `GET /api/db/status`

Reports whether MongoDB Atlas is configured and reachable. If not configured, the app uses the memory-backed demo store.

Response:

```json
{ "configured": false, "connected": false, "mode": "memory" }
```

### `GET /api/health/readiness`

Reports backend readiness without returning secret values. It checks Mongo connectivity, Gemini/Anthropic/ElevenLabs key presence, local upload directory writability, and current seeded data counts when available. A configured but unreachable MongoDB or unwritable upload directory returns `503` with `status: "degraded"`.

Response:

```json
{
  "status": "ready",
  "generatedAt": "2026-05-09T00:00:00.000Z",
  "integrations": {
    "mongo": { "configured": false, "connected": false, "mode": "memory" },
    "gemini": { "configured": false },
    "anthropic": { "configured": false },
    "elevenLabs": { "configured": false },
    "uploads": { "configured": true, "writable": true, "relativePath": "public/generated/uploads" }
  },
  "data": {
    "source": "memory",
    "rides": 1,
    "events": 6,
    "dangerSegments": 3,
    "demoRide": { "id": "demo-ride-1", "present": true, "eventCount": 6 }
  }
}
```

### `POST /api/seed/demo`

Creates or resets polished demo data.

Response:

```json
{ "rideId": "demo-ride-1", "eventCount": 6, "segmentCount": 3 }
```

### `POST /api/ai/analyze-frame`

Inputs a frame and context. Returns structured hazard JSON.

Request:

```json
{
  "imageBase64": "...",
  "lat": 38.5449,
  "lng": -121.7405,
  "speedMps": 5.6,
  "headingDeg": 90,
  "camera": "front",
  "perception": {
    "frameId": "capture-1",
    "tracks": [],
    "risk": {},
    "hazardDraft": {}
  }
}
```

`perception` is optional. Browser clients can send the PathSense-style worker output when local tracking/depth/TTC is available; Gemini uses it as a prior, and the deterministic backend can save it directly when no API key is configured.

Response:

```json
{
  "type": "close_pass",
  "severity": 88,
  "confidence": 0.91,
  "spokenAlert": "Vehicle closing fast on your left.",
  "explanation": "A vehicle is approaching close to the rider's left side.",
  "objects": [],
  "provider": "perception",
  "perception": {}
}
```

### `GET /api/scenarios`

Mirage-inspired Scenario Lab helper. Returns deterministic preset scenarios for prompt-to-road-danger demos. Each item includes a scenario, compatible hazard-event draft, and replay payload.

Response:

```json
{
  "provider": "deterministic-scenario-lab",
  "presets": ["rear camera close pass on Russell Boulevard"],
  "scenarios": [{ "scenario": {}, "hazardDraft": {}, "replayPayload": {}, "provider": "deterministic-scenario-lab" }]
}
```

### `POST /api/scenarios`

Turns a short road-safety prompt into a deterministic replay/perception scenario, compatible hazard-event draft, and replay payload. Same `prompt` + `seed` returns the same IDs, timestamps, route, event draft, and hotspot. Send `prompts` for a batch of up to 12 scenarios.

Request:

```json
{ "prompt": "rear camera close pass on Russell Boulevard", "mode": "bike", "camera": "rear", "seed": 42 }
```

Batch request:

```json
{ "prompts": ["blocked bike lane with cones near campus", "parked car door zone on a narrow street"] }
```

Response:

```json
{ "scenario": {}, "hazardDraft": {}, "replayPayload": {}, "provider": "deterministic-scenario-lab" }
```

Batch response:

```json
{ "provider": "deterministic-scenario-lab", "scenarios": [] }
```

### `POST /api/ai/report`

Inputs a danger segment and related events. Returns a civic safety report. Seeded demo segment IDs, including `seg-russell-olive`, remain valid after danger-segment recomputation; the backend resolves documented IDs by exact ID first, then by seeded label/top-types/location match.

Request:

```json
{ "segmentId": "seg-russell-olive" }
```

Response:

```json
{
  "report": {
    "title": "...",
    "summary": "...",
    "evidence": [],
    "recommendedFixes": [],
    "generatedAt": "2026-05-09T16:26:32.000Z",
    "segmentId": "seg-russell-olive",
    "eventIds": []
  },
  "provider": "stub"
}
```

### `POST /api/reports/export`

ShipSense-inspired export helper. It generates a report for a danger segment and returns an export payload for civic handoff. Supported formats: `markdown`, `html`, `csv`, and `pdf-text` plain text formatted like a PDF report. Request may include `segment` and `events` directly for scenario or offline exports; otherwise `segmentId` selects seeded or persisted backend data. Documented seeded IDs survive recomputation by exact ID or seeded label/top-types/location fallback.

Request:

```json
{ "segmentId": "seg-russell-olive", "format": "pdf-text" }
```

Response:

```json
{
  "report": {},
  "segment": {},
  "format": "pdf-text",
  "document": "GUARDIAN ROAD CIVIC SAFETY REPORT\n...",
  "filename": "seg-russell-olive-guardian-road-report.txt",
  "contentType": "text/plain; charset=utf-8",
  "generatedAt": "2026-05-09T16:26:32.000Z",
  "events": [],
  "provider": "stub"
}
```

### `POST /api/voice/alert`

Inputs text and returns an ElevenLabs-generated audio URL when wired. Until then, `audioUrl` is `null` and clients should use native TTS.

Response:

```json
{ "text": "Road hazard ahead.", "audioUrl": null, "provider": "stub" }
```

## Danger score formula

Initial formula:

```txt
score =
  avgSeverity * 0.45
+ eventCountBonus * 0.25
+ recentBonus * 0.15
+ repeatTypeBonus * 0.15
```

Where:

```ts
eventCountBonus = Math.min(100, eventCount * 12);
recentBonus = eventWithinLastHour ? 100 : eventWithinLastDay ? 60 : 20;
repeatTypeBonus = topTypeCount >= 3 ? 100 : 40;
```

Color bands:

- 0-25: green
- 26-50: yellow
- 51-75: orange
- 76-100: red

## MongoDB storage note

Store geospatial locations like this:

```js
location: {
  type: "Point",
  coordinates: [lng, lat]
}
```

Indexes:

```js
events.createIndex({ location: "2dsphere" })
events.createIndex({ rideId: 1, t: 1 })
danger_segments.createIndex({ location: "2dsphere" })
```
