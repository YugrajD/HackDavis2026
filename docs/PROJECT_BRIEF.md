# Guardian Road Project Brief

## One-line pitch

Guardian Road turns phones into shared-road safety sensors, warning riders and drivers in real time while building a live Davis map of dangerous streets.

## Core concept

This is not just a bike app and not just a dashcam. It is a shared-road safety intelligence system.

- **Rider Mode**: a phone mounted on a bike or scooter watches the road and speaks short warnings: close pass, obstacle ahead, pedestrian conflict, blocked bike lane, door zone, known hazard nearby.
- **Driver Mode**: a phone mounted as a car dashcam watches for cyclists, pedestrians, unsafe passes, and intersection conflicts.
- **City Mode**: both streams become geotagged hazard events. Events cluster into dangerous street segments on a Davis safety map.
- **Replay Mode**: each ride can be reconstructed as a 3D safety replay with route, rider, camera cones, vehicle ghost trajectories, hazard rings, clips, and timing.
- **Report Mode**: the system generates a short Vision Zero-style report for a dangerous corridor.

## Demo arc

1. Start a demo ride.
2. Phone camera sees a hazard.
3. App speaks a warning.
4. Event is saved with GPS, severity, confidence, object tracks, and optional clip.
5. Records dashboard updates.
6. 3D replay reconstructs the event.
7. Davis danger map marks the street segment.
8. Claude/Gemini generate a human-readable safety explanation/report.

## Why this wins

Prestigious hackathon winners usually have a live input, a technical processing layer, and a persistent spatial artifact. Guardian Road has all three:

- Live camera/GPS/IMU input.
- AI perception + risk scoring.
- 3D replay + city safety map + safety report.

## Sponsor usage

- **Gemini API**: analyze triggered frames and return structured hazard JSON.
- **ElevenLabs**: spoken safety alerts.
- **MongoDB Atlas**: rides, hazard events, geospatial clustering, danger segments.
- **Anthropic / Claude**: incident explanations and civic safety reports.
- **Figma**: rider-safe cockpit and dashboard design.
- **Reconstruct**: road-condition reconstruction from clips if sponsor API supports it.
- **Davis Autonomy Club**: autonomy/perception framing, VLM/VLA material if available.
- **Vultr**: backend/GPU hosting if needed.
- **Exa**: Davis road-safety context for reports if needed.

## Product surfaces

### 1. Control room / home

Landing/control page with demo controls:
- seed demo data
- open replay
- open records
- view danger map
- trigger sample event

### 2. Rider/driver capture

May be implemented as a mobile PWA first:
- camera preview
- hazard overlay
- risk score
- voice alert
- creates `HazardEvent`

### 3. Records dashboard

Evidence layer:
- event feed
- filters
- event detail
- danger segment list
- report export

### 4. 3D replay

Cinematic technical centerpiece:
- route line/tube
- moving rider/vehicle
- camera frustums
- hazard pulses
- ghost trajectories
- timeline scrubber

### 5. Davis safety map

Street-level risk visualization:
- hazard clusters
- danger scores
- segment color coding
- clickable segment reports

## Implementation principle

Seeded demo data is the spine. Everyone builds against it first. Live AI and camera features attach to the same contracts later.
