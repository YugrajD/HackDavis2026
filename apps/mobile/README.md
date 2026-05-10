# Guardian Road (Expo)

Mobile capture over **Wi‑Fi**: the app POSTs frames to your **Next.js** dev server on the laptop. The server calls the **Python YOLO sidecar** when `YOLO_SERVICE_URL` is set.

## Prereqs

1. **Same Wi‑Fi** as the dev machine.
2. **Next.js** running (`npm run dev` in repo root), reachable at the laptop **LAN IPv4** (not `localhost` from a physical phone).
3. **YOLO sidecar** (optional but required for real detections):

   ```bash
   cd services/yolo
   python -m venv .venv
   .venv\Scripts\activate   # Windows
   pip install -r requirements.txt
   uvicorn main:app --host 0.0.0.0 --port 8000
   ```

4. In **repo root** `.env.local`:

   ```env
   YOLO_SERVICE_URL=http://127.0.0.1:8000
   ```

   Use `127.0.0.1` when Next and YOLO run on the same machine. The Next server proxies to this URL.

## App env

Copy `.env.example` to `.env` in this folder:

```env
EXPO_PUBLIC_API_BASE_URL=http://192.168.x.x:3000
```

Use your **laptop’s LAN IP** and the port where Next listens (`3000` by default). Android emulator can use `http://10.0.2.2:3000` to reach the host loopback.

## Run

```bash
cd apps/mobile
npm install
npx expo start
```

Open in Expo Go or a dev build; grant **camera** (and **location** if you want real GPS on the event).

## Flow

1. `POST /api/rides` — start a live bike ride with the current GPS point. If this fails, the app keeps the demo fallback ride `demo-ride-1`.
2. **Live perception (always on):** on the capture screen with camera permission, `CameraView` stays in **`video`** mode and a **continuous async loop** runs: snapshot JPEG (**~0.38 quality**) → **`POST /api/perception/detect`** → **green** overlays + labels (round-trip ms in the HUD). The loop **pauses briefly** while **Save hazard (manual)** runs to avoid overlapping `takePictureAsync`. High HUD score can still trigger a **debounced** full pipeline (same steps 3–6 as a single burst). Short **expo-speech** hints use a separate cooldown and are not a substitute for `/api/voice/alert` on saved events.
3. **Manual save:** **Save hazard (manual)** captures at `quality: 0.55` with `skipProcessing: false`, then runs the pipeline below.
4. `POST /api/media/upload` with `thumbnailBase64` — stores the compressed thumbnail URL.
5. `POST /api/media/analyze-and-save` with the same compressed `imageBase64`, `rideId`, `t` relative to `ride.startedAt`, `useYolo: true`, and the uploaded `thumbnailUrl` — server runs YOLO + `analyzeFrameObservation`, then saves + optional Gemini copy.
6. `POST /api/rides/:rideId/route` — append one route point for the saved event.
7. `POST /api/voice/alert` — play MP3 or `expo-speech` fallback.
8. `PATCH /api/rides/:rideId/end` — end the active ride and refresh stats (monitor stops when the ride ends).

If live snapshots while in `video` mode are unreliable on a device, use manual capture for the demo or consider a **development build** with a frame-processor library (not required for the default Wi‑Fi laptop path).

## Firewall

On Windows, allow **inbound** TCP on **3000** (Next) for the demo subnet if the phone cannot connect.
