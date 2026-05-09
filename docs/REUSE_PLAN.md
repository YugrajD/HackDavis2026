# Reuse Plan From Inspiration Repos

We looked at four inspiration projects. The goal is to reuse what saves time without copying unlicensed code.

## Licensing rule

- **Mirage** has a top-level MIT license. We can directly reuse code with attribution.
- **PathSense, LureLore, and ShipSense** have owner-confirmed MIT licensing. We can reuse code with attribution, but should still prefer rebuilding project-specific pieces unless direct copying saves real time.

## 1. Mirage, TreeHacks 2026

Repo: `https://github.com/kyan-yang/Mirage`

Directly reusable because MIT licensed.

Useful files:

```txt
v3/frontend/src/components/SplatViewer.tsx
v3/modal_app.py
v2/fetch_streetview.py
google-maps-data/fetch_streetview.py
```

Use for Guardian Road:

- Scenario Lab: prompt-to-road-danger scenario generation.
- Gaussian splat viewer for generated/reconstructed street scenes.
- Street View fetcher for Davis road context.
- Modal GPU service skeleton if we run 3D reconstruction or heavy video processing.

Implementation note:

- Port `SplatViewer.tsx` into `src/components/three/SplatViewer.tsx`.
- Add MIT attribution in `NOTICE.md` if copied.
- Keep Scenario Lab separate from the core replay so it cannot block records/replay.

## 2. PathSense, Hack the North 2024

Repo: `https://github.com/akjadhav/hackthenorth-2024`

Owner-confirmed MIT. Reuse with attribution if needed.

Study these files:

```txt
camera/camera.py
camera/tagging/depth.py
camera/tagging/segment.py
camera/tagging/description.py
camera/app.py
convex/schema.ts
app/components/Map.tsx
```

Patterns to rebuild:

- Multi-camera frame manager.
- DPT depth wrapper.
- Detectron/object segmentation wrapper.
- VLM description on sampled frames.
- Object JSON: class, description, id, relative location.
- Live map/navigation surface.

Guardian Road version:

```txt
camera frame
→ object detection
→ depth/relative-distance estimate
→ tracking/time-to-collision
→ hazard event JSON
→ MongoDB
→ replay/records
```

## 3. LureLore, Hack the North finalist

Repo: `https://github.com/danielh-hong/hackthenorth2024`

Owner-confirmed MIT. Reuse with attribution if needed.

Study these files:

```txt
frontend/src/dashboard/FishBackground.jsx
frontend/src/dashboard/ClickableFish.jsx
frontend/src/FishCatchMap.jsx
backend/server2.js
backend/database.js
```

Patterns to rebuild:

- Capture real-world thing.
- Gemini returns structured JSON.
- Save to MongoDB.
- Render records on a map.
- Render persistent entities in a React Three Fiber scene.

Guardian Road version:

- Fish catch -> hazard event.
- Aquarium -> 3D safety replay.
- Fish map -> Davis danger map.
- Fish story -> hazard explanation / civic report.

## 4. ShipSense, TreeHacks 2023

Repo: `https://github.com/SohamGovande/treehacks-2023`

Owner-confirmed MIT. Reuse with attribution if needed.

Study these files:

```txt
site/src/components/Globe.js
site/src/components/ReactMap.js
site/src/components/MapPageContents.js
datagen/generate_particles.js
datagen/parse_particles.js
```

Patterns to rebuild:

- Hotspot polygons from clustered geotagged events.
- Sidebar report for a selected risk region.
- Export-to-PDF civic report.
- Serious geospatial visualization.

Guardian Road version:

- Overfishing hotspots -> dangerous Davis street segments.
- Coast Guard report -> Vision Zero safety report.
- Satellite evidence grid -> dashcam event clips.
- Clustered boat locations -> clustered hazard events.

## Reuse priority

1. Use LureLore-style React Three Fiber scene composition for clickable 3D entities.
2. Port Mirage `SplatViewer.tsx` only if Scenario Lab / Gaussian splats become part of the demo.
3. Rebuild PathSense-style perception contracts and stubs.
4. Rebuild LureLore-style Mongo/Gemini event pipeline.
5. Rebuild ShipSense-style danger-segment dashboard/report pattern.

## Attribution

If we copy MIT-licensed Mirage code, add this to `NOTICE.md`:

```txt
Portions of the 3D viewer architecture may be adapted from Mirage by Kyan Yang et al., MIT License: https://github.com/kyan-yang/Mirage
React Three Fiber scene-organization patterns may be adapted from LureLore, owner-confirmed MIT License: https://github.com/danielh-hong/hackthenorth2024
Mapping/navigation and danger-zone visualization patterns may be adapted from PathSense and ShipSense, owner-confirmed MIT License:
https://github.com/akjadhav/hackthenorth-2024
https://github.com/SohamGovande/treehacks-2023
```
