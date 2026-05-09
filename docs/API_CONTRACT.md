# API Contract

This file defines the shared backend contract. Replay and records should not invent separate shapes.

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
  "camera": "front"
}
```

Response:

```json
{
  "type": "close_pass",
  "severity": 88,
  "confidence": 0.91,
  "spokenAlert": "Vehicle closing fast on your left.",
  "explanation": "A vehicle is approaching close to the rider's left side.",
  "objects": [],
  "provider": "stub"
}
```

### `POST /api/ai/report`

Inputs a danger segment and related events. Returns a civic safety report.

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
    "recommendedFixes": []
  },
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
