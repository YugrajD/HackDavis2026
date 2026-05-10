# Unified mobile simulation (Expo + native iOS)

The repo ships **two** iOS-capable surfaces that share the same **Next.js + YOLO** backend; only **one** should own the iOS Simulator at a time.

| Surface | Location | Best for |
|---------|----------|----------|
| **Expo (React Native)** | `apps/mobile` | Wi‑Fi capture, `/api/perception/detect` live loop, Expo Go or dev build |
| **Native Swift dashcam** | `GuardianRoad.xcodeproj`, `GuardianRoad/` | AR-style nav overlay, rolling recorder, SwiftUI camera |

## One command from repo root

```bash
npm run sim
```

- **macOS:** runs `npx expo run:ios` inside `apps/mobile` (builds/opens the **Expo** app in Simulator). First run may generate the `ios/` folder via prebuild.
- **Windows / Linux:** runs `npx expo start --lan` (physical device or Android; iOS Simulator is mac-only).

```bash
npm run sim:native
```

- **macOS only:** opens **`GuardianRoad.xcodeproj`** in Xcode; press **Run** to launch the **Swift** app in Simulator.
- Not available on Windows (use Expo or a Mac for native iOS).

## Backend (same for both)

1. Repo root: `npm run dev -- --hostname 0.0.0.0`
2. Optional YOLO: `cd services/yolo && uvicorn main:app --host 0.0.0.0 --port 8000`
3. Phone/Simulator reaches Next at your LAN IP; Expo uses `apps/mobile/.env` → `EXPO_PUBLIC_API_BASE_URL`.

Native Swift wiring to HTTP is **not** duplicated here yet—point any future `URLSession` base URL at the same Next host as Expo.

## XcodeGen (optional)

`project.yml` at the repo root describes the native app for [XcodeGen](https://github.com/yonaskolb/XcodeGen). Regenerate the Xcode project after editing YAML:

```bash
xcodegen generate
```

## Related docs

- [YOLO_MOBILE_RUNBOOK.md](YOLO_MOBILE_RUNBOOK.md) — Expo + laptop YOLO handoff
- [apps/mobile/README.md](../apps/mobile/README.md) — Expo env and flows
