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

export const HAZARD_TYPES = [
  "close_pass",
  "vehicle_approach",
  "pedestrian_conflict",
  "pothole",
  "road_obstruction",
  "blocked_bike_lane",
  "door_zone",
  "hard_brake",
  "intersection_conflict",
] as const satisfies readonly HazardType[];

export const ACTOR_TYPES = ["rider", "car", "truck", "bus", "bike", "scooter", "pedestrian", "cone", "obstacle"] as const satisfies readonly ActorType[];
export const VEHICLE_ACTOR_TYPES = ["car", "truck", "bus"] as const satisfies readonly ActorType[];
export const VULNERABLE_ACTOR_TYPES = ["pedestrian", "bike", "scooter"] as const satisfies readonly ActorType[];
export const RIDE_MODES = ["bike", "scooter", "car"] as const satisfies readonly RideMode[];
export const CAMERA_ROLES = ["front", "rear", "dashcam"] as const satisfies readonly CameraRole[];

export const PROVIDER_NAMES = {
  gemini: "gemini",
  perception: "perception",
  stub: "stub",
  claude: "claude",
  elevenLabs: "elevenlabs",
  deterministicScenarioLab: "deterministic-scenario-lab",
} as const;

export const FRAME_ANALYSIS_PROVIDERS = [PROVIDER_NAMES.gemini, PROVIDER_NAMES.perception, PROVIDER_NAMES.stub] as const;

export const SEVERITY_MIN = 0;
export const SEVERITY_MAX = 100;
export const RISK_SCORE_MIN = SEVERITY_MIN;
export const RISK_SCORE_MAX = SEVERITY_MAX;
export const CONFIDENCE_MIN = 0;
export const CONFIDENCE_MAX = 1;

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

export type AppendRideRouteRequest = RoutePoint | RoutePoint[] | { point?: RoutePoint; points?: RoutePoint[] };

export type AppendRideRouteResponse = {
  ride: Ride;
  appended: number;
  persisted: "memory" | "mongodb";
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
> &
  Partial<Pick<HazardEvent, "rideId">>;

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

export type ScenarioJobStatus = "queued" | "running" | "succeeded" | "failed";

export type ScenarioJobResult = ScenarioResponse | { provider: "deterministic-scenario-lab"; scenarios: ScenarioResponse[] };

export type ScenarioJob = {
  id: string;
  status: ScenarioJobStatus;
  createdAt: string;
  updatedAt: string;
  statusUrl: string;
  provider: "deterministic-scenario-lab";
  input: ScenarioPrompt;
  result?: ScenarioJobResult;
  error?: string;
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

export type YoloProviderStatus = {
  configured: boolean;
  available: boolean;
  check: "health" | "failed-health" | "not-configured";
  serviceHost?: string;
  error?: string;
};

export type ProviderStatusResponse = {
  status: "ready" | "degraded";
  generatedAt: string;
  providers: {
    mongodb: {
      configured: boolean;
      available: boolean;
      mode: "mongodb" | "memory" | "memory-fallback";
      check: "ping" | "failed-ping" | "not-configured";
      error?: string;
    };
    gemini: { configured: boolean; available: boolean; check: "configuration"; fallback: "stub" };
    claude: { configured: boolean; available: boolean; check: "configuration"; fallback: "stub" };
    elevenLabs: { configured: boolean; available: boolean; check: "configuration"; fallback: "native-tts" };
    yolo: YoloProviderStatus;
    uploadStorage: {
      configured: boolean;
      available: boolean;
      writable: boolean;
      relativePath: string;
      check: "write-probe";
      error?: string;
    };
    localFallback: {
      configured: true;
      available: true;
      persistence: "memory";
      frameAnalysis: "stub";
      reports: "stub";
      voice: "native-tts";
      scenarios: "deterministic-scenario-lab";
    };
  };
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
    yolo: YoloProviderStatus;
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

### `POST /api/rides/:rideId/route`

Appends one or many replay route points to an existing ride and recalculates `ride.stats.durationSec`, `distanceMeters`, `maxRisk`, and `eventCount`. The memory store and MongoDB Atlas path use the same response envelope.

Request options:

```json
{ "point": { "t": 4, "lat": 38.54491, "lng": -121.7402, "speedMps": 4.8, "headingDeg": 87 } }
```

```json
{ "points": [{ "t": 4, "lat": 38.54491, "lng": -121.7402, "speedMps": 4.8, "headingDeg": 87 }] }
```

Response:

```json
{ "ride": {}, "appended": 1, "persisted": "memory" }
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

### `POST /api/perception/detect`

Runs **server-side COCO YOLOv8** via a Python sidecar. Configure **`YOLO_SERVICE_URL`** in `.env.local` (for example `http://127.0.0.1:8000` on the dev machine, or `http://<LAN-ip>:8000` when the phone must reach the laptop on Wi‑Fi). Next.js proxies the frame to that service. `imageBase64` accepts the same decoded image limit as stored thumbnails: 4MB, plus JSON/base64 overhead.

Request:

```json
{
  "imageBase64": "data:image/jpeg;base64,...",
  "imageMimeType": "image/jpeg"
}
```

Response (200):

```json
{
  "detections": [
    { "id": "coco-2-0", "label": "car", "confidence": 0.87, "bbox": [0.1, 0.2, 0.5, 0.7], "description": "COCO car" }
  ],
  "width": 1280,
  "height": 720
}
```

Returns **503** when `YOLO_SERVICE_URL` is unset or the sidecar is unreachable, with `detections: []` and an explanatory `note`.

### `POST /api/media/analyze-and-save`

LureLore-inspired one-shot media pipeline. It accepts a frame plus optional stored media URLs, analyzes through Gemini when configured, persists a `HazardEvent` to MongoDB or memory, and returns the saved event. `imageBase64` uses the same decoded image limit as `/api/media/upload` thumbnails: 4MB, plus JSON/base64 overhead.

Set **`useYolo`: true** to run YOLO detection (same sidecar as `/api/perception/detect`) when **`perception` is omitted**—the server fills `perception` from `FrameObservation` via `analyzeFrameObservation`, then merges with Gemini when `GEMINI_API_KEY` is set: **tracks and risk-aligned fields from YOLO**, **spoken alert and explanation text from Gemini** when available.

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
  "useYolo": true,
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
{ "event": {}, "persisted": "memory", "provider": "gemini", "perception": {}, "message": "…" }
```

Optional **`yoloNote`** is included when YOLO was requested but the sidecar failed.

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

Returns events sorted newest-first by `timestamp`, then `t`, then `id`. Optional filters may be added: `type`, `minSeverity`, `mode`, `camera`.

Response:

```json
{ "events": [] }
```

### `GET /api/events/near?lat=...&lng=...&radiusM=...`

Returns nearby events sorted newest-first by `timestamp`, then `t`, then `id`. Mongo geospatial queries can replace the in-memory Haversine implementation without changing the envelope.

Response:

```json
{ "events": [] }
```

### `GET /api/replay/:rideId`

The main replay contract. Replay owner should only need this endpoint. Replay `events` are sorted by timeline `t` ascending, then `timestamp`, then `id`.

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

### `GET /api/providers/status`

Reports sanitized configured/available status for MongoDB, Gemini, Claude, ElevenLabs, YOLO, upload storage, and local fallback paths. It never returns secret values. Remote AI providers use configuration checks only; MongoDB uses a ping check, YOLO uses a short `GET /health` check when `YOLO_SERVICE_URL` is configured, and upload storage uses a local write probe. YOLO reports only the parsed `serviceHost`, never the raw URL.

Response:

```json
{
  "status": "ready",
  "generatedAt": "2026-05-09T00:00:00.000Z",
  "providers": {
    "mongodb": { "configured": false, "available": false, "mode": "memory", "check": "not-configured" },
    "gemini": { "configured": false, "available": false, "check": "configuration", "fallback": "stub" },
    "claude": { "configured": false, "available": false, "check": "configuration", "fallback": "stub" },
    "elevenLabs": { "configured": false, "available": false, "check": "configuration", "fallback": "native-tts" },
    "yolo": { "configured": false, "available": false, "check": "not-configured" },
    "uploadStorage": { "configured": true, "available": true, "writable": true, "relativePath": "public/generated/uploads", "check": "write-probe" },
    "localFallback": {
      "configured": true,
      "available": true,
      "persistence": "memory",
      "frameAnalysis": "stub",
      "reports": "stub",
      "voice": "native-tts",
      "scenarios": "deterministic-scenario-lab"
    }
  }
}
```

### `GET /api/health/readiness`

Reports backend readiness without returning secret values. It checks Mongo connectivity, Gemini/Anthropic/ElevenLabs key presence, YOLO sidecar health when `YOLO_SERVICE_URL` is configured, local upload directory writability, and current seeded data counts when available. A configured but unreachable MongoDB, configured but failed YOLO health check, or unwritable upload directory returns `503` with `status: "degraded"`.

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
    "yolo": { "configured": false, "available": false, "check": "not-configured" },
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

### `POST /api/scenarios/jobs`

Creates an in-memory scenario generation job for Mirage-style polling. It accepts the same request body as `POST /api/scenarios` and returns `202 Accepted` with `Location` set to the job status URL. No external service is required; the current worker uses the deterministic scenario generator.

Request:

```json
{ "prompt": "blocked bike lane with cones near campus", "mode": "bike", "seed": 42 }
```

Response:

```json
{
  "id": "scenario-job-...",
  "status": "queued",
  "statusUrl": "http://localhost:3000/api/scenarios/jobs/scenario-job-...",
  "provider": "deterministic-scenario-lab",
  "input": { "prompt": "blocked bike lane with cones near campus", "mode": "bike", "seed": 42 }
}
```

### `GET /api/scenarios/jobs/:jobId`

Polls the in-memory scenario job. `status` is `queued`, `running`, `succeeded`, or `failed`. A succeeded job includes `result`, using the same single or batch response shape as `POST /api/scenarios`; a failed job includes `error`.

Response:

```json
{
  "id": "scenario-job-...",
  "status": "succeeded",
  "statusUrl": "http://localhost:3000/api/scenarios/jobs/scenario-job-...",
  "provider": "deterministic-scenario-lab",
  "input": { "prompt": "blocked bike lane with cones near campus" },
  "result": { "scenario": {}, "hazardDraft": {}, "replayPayload": {}, "provider": "deterministic-scenario-lab" }
}
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

ShipSense-inspired export helper. It generates a report for a danger segment, persists the generated export under `public/generated/reports`, and returns the export payload for civic handoff. Supported formats: `markdown`, `html`, `csv`, and `pdf-text` plain text formatted like a PDF report. Request may include `segment` and `events` directly for scenario or offline exports; otherwise `segmentId` selects seeded or persisted backend data. Documented seeded IDs survive recomputation by exact ID or seeded label/top-types/location fallback.

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
  "exportUrl": "/generated/reports/seg-russell-olive-guardian-road-report.txt",
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
