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

1. `POST /api/media/upload` — thumbnail URL  
2. `POST /api/media/analyze-and-save` with `useYolo: true` and no `perception` — server runs YOLO + `analyzeFrameObservation`, then save + optional Gemini copy  
3. `POST /api/voice/alert` — play MP3 or `expo-speech` fallback  

## Firewall

On Windows, allow **inbound** TCP on **3000** (Next) for the demo subnet if the phone cannot connect.
