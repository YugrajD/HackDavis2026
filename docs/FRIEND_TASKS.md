# Friend Task Specs

This doc is written so each person can work independently without stepping on the others.

## Friend 1: 3D Safety Replay

### Owned paths

- `src/app/replay/**`
- `src/components/replay/**`
- `src/components/three/**`
- `src/lib/replay/**`

Do not edit backend routes except to request contract changes in `docs/INTEGRATION_STATUS.md`.

### Goal

Build the cinematic replay page. It should look like a serious road-safety reconstruction tool.

Input endpoint:

```txt
GET /api/replay/:rideId
```

Use `ReplayPayload` from `src/lib/contracts.ts`.

### Required scene elements

- Dark 3D ground plane.
- Route line or tube from `ride.route`.
- Moving rider/car object along route based on current timeline time.
- Camera cone/frustum showing front/rear/dashcam view direction.
- Hazard markers at event coordinates.
- Red/amber pulse rings at event times.
- Ghost object trajectories from `event.objects[].position` and `velocity`.
- Object labels: `car`, `pedestrian`, `obstacle`, etc.
- Timeline scrubber with play/pause.
- Event detail panel when marker is clicked.
- Button to jump to highest severity event.

### Coordinate conversion

Use this until backend provides projected coordinates:

```ts
export function latLngToMeters(lat: number, lng: number, originLat: number, originLng: number) {
  const R = 6378137;
  const dLat = (lat - originLat) * Math.PI / 180;
  const dLng = (lng - originLng) * Math.PI / 180;
  return {
    x: dLng * R * Math.cos(originLat * Math.PI / 180),
    z: -dLat * R,
  };
}
```

### Suggested component split

```txt
src/app/replay/[rideId]/page.tsx
src/components/replay/ReplayScene.tsx
src/components/replay/ReplayTimeline.tsx
src/components/replay/EventInspector.tsx
src/components/replay/HazardMarker.tsx
src/components/replay/RiskCone.tsx
src/components/replay/GhostTrajectory.tsx
src/lib/replay/coordinates.ts
src/lib/replay/interpolate.ts
```

### Visual direction

- Background: asphalt black.
- Route: white/cyan.
- Warning: amber.
- Critical: red.
- Camera geometry: thin cyan lines.
- Danger segment: translucent red/orange zone.

Avoid generic glowing purple hackathon UI. Keep it like a tactical mobility cockpit.

### Acceptance criteria

- It loads demo ride from `/api/replay/demo-ride-1`.
- Timeline scrubber moves the rider along the route.
- At least 6 seeded events appear.
- Clicking an event opens details.
- Highest-risk event is visually obvious.
- Does not require records dashboard to be complete.

## Friend 2: Safety Records Dashboard

### Owned paths

- `src/app/records/**`
- `src/components/records/**`
- `src/lib/records/**`

Do not edit replay or backend routes except to request contract changes in `docs/INTEGRATION_STATUS.md`.

### Goal

Build the evidence dashboard. This explains what happened, what was saved, and why a street became dangerous.

Endpoints:

```txt
GET /api/events
GET /api/events?rideId=demo-ride-1
GET /api/danger-segments
GET /api/rides/:rideId
POST /api/ai/report
```

### Required screens/components

#### 1. Event feed

List/table with:
- hazard type
- severity
- confidence
- time
- location
- mode/camera
- spoken alert
- short explanation
- thumbnail if available

Filters:
- type
- minimum severity
- camera
- ride mode
- search text

#### 2. Event detail

Clicking an event opens:
- large thumbnail/clip placeholder
- AI explanation
- object list
- severity/confidence
- GPS and heading
- `Open in Replay` link to `/replay/:rideId?event=:eventId`

#### 3. Danger segments

List dangerous areas:
- label
- score
- event count
- top hazard types
- last seen
- explanation
- recommended fix placeholder

Color code score:
- green low
- yellow medium
- orange high
- red critical

#### 4. Report export

Button calls:

```txt
POST /api/ai/report
```

Display returned report in a clean panel. Include copy/export button.

### Suggested component split

```txt
src/app/records/page.tsx
src/components/records/EventFeed.tsx
src/components/records/EventFilters.tsx
src/components/records/EventDetailPanel.tsx
src/components/records/DangerSegmentList.tsx
src/components/records/ReportPanel.tsx
src/lib/records/filter-events.ts
src/lib/records/format.ts
```

### Acceptance criteria

- It can render seeded events from backend.
- Filters work locally.
- Event detail panel opens.
- Danger segment list renders.
- Report button works with backend stub even before real Claude integration.
- Does not require replay page to be complete.

## Backend owner: integration promise to friends

Backend will provide seeded demo data quickly. Replay and records should not wait for live camera, AI, or Mongo to be finished. The first backend milestone is stable JSON from `/api/seed/demo`, `/api/replay/demo-ride-1`, `/api/events`, and `/api/danger-segments`.

## If a contract changes

1. Update `src/lib/contracts.ts`.
2. Update `docs/API_CONTRACT.md`.
3. Add a short note in `docs/INTEGRATION_STATUS.md`.
4. Tell the group in Discord.
