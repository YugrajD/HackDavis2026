# API Contract

This file defines the shared backend contract. Replay and records should not invent separate shapes.

## TypeScript contract

The source of truth should live in `src/lib/contracts.ts` once the app is scaffolded.

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

export type ReplayPayload = {
  ride: Ride;
  events: HazardEvent[];
  dangerSegments: DangerSegment[];
  generatedAt: string;
};
```

## Required endpoints

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
{ "ride": {} }
```

### `GET /api/rides/:rideId`

Returns one ride.

### `PATCH /api/rides/:rideId/end`

Ends ride and recalculates stats.

### `POST /api/events`

Creates one hazard event.

### `POST /api/events/batch`

Creates many hazard events.

### `GET /api/events?rideId=...`

Returns events. Optional filters may be added: `type`, `minSeverity`, `mode`, `camera`.

### `GET /api/events/near?lat=...&lng=...&radiusM=...`

Returns nearby events using Mongo geospatial query.

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
  "objects": []
}
```

### `POST /api/ai/report`

Inputs a danger segment and related events. Returns a civic safety report.

### `POST /api/voice/alert`

Inputs text and returns an ElevenLabs-generated audio URL.

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
