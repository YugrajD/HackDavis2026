# YOLO + Mobile Handoff Runbook

Use this when a friend needs to run the laptop backend, Python YOLO sidecar, and Expo phone capture on the same Wi-Fi network. The phone talks only to Next.js. Next proxies YOLO through `YOLO_SERVICE_URL`, saves events, and keeps the records/replay contracts stable.

## 0. Pick the laptop LAN IP

A physical phone cannot use `localhost` for the laptop. Find the laptop IPv4 on the same Wi-Fi as the phone, then reuse it everywhere the phone needs to reach Next.

```bash
# macOS
ipconfig getifaddr en0

# Windows PowerShell
Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.InterfaceAlias -match "Wi-Fi"}

# Linux
hostname -I
```

Examples below use `192.168.1.42`; replace it with your laptop IP.

## 1. Run Next.js from the repo root

```bash
cp .env.example .env.local
npm install
npm run dev -- --hostname 0.0.0.0
```

Set these root env values in `.env.local`:

```env
NEXT_PUBLIC_APP_URL=http://192.168.1.42:3000
YOLO_SERVICE_URL=http://127.0.0.1:8000
```

Use `127.0.0.1` for `YOLO_SERVICE_URL` when YOLO and Next run on the same laptop. Use a LAN URL only if the YOLO sidecar runs on a different machine. Real `MONGODB_URI`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, and `ELEVENLABS_API_KEY` are optional for the demo and must stay in `.env.local` only.

## 2. Run the YOLO sidecar

```bash
cd services/yolo
python -m venv .venv
source .venv/bin/activate          # macOS/Linux
# .venv\Scripts\activate          # Windows PowerShell/cmd
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

First run downloads `yolov8n.pt`. If Windows prompts for firewall access, allow Python/uvicorn on the private Wi-Fi network.

Smoke the sidecar directly:

```bash
curl http://127.0.0.1:8000/health
```

## 3. Seed and smoke the backend

Run these from the repo root after Next starts:

```bash
curl -X POST http://localhost:3000/api/seed/demo
curl http://localhost:3000/api/providers/status
curl http://localhost:3000/api/replay/demo-ride-1
curl 'http://localhost:3000/api/events?rideId=demo-ride-1'
npm run smoke:yolo
npm run smoke:mobile
```

For the full backend arc:

```bash
npm run smoke:api
```

`npm run smoke:yolo` exits successfully with a skip note when Next is down or `YOLO_SERVICE_URL` is unset. With Next running and `YOLO_SERVICE_URL=http://127.0.0.1:8000`, it should exercise provider readiness and `POST /api/perception/detect` through the Next proxy.

`npm run smoke:mobile` mirrors the Expo capture flow from Node against `API_BASE_URL` or `http://localhost:3000` by default: provider preflight, ride start, `thumbnailBase64` upload, `/api/media/analyze-and-save` with `useYolo: true`, route append, voice fallback, and ride end. It creates and ends one smoke ride, saves one hazard event, and writes one thumbnail under `public/generated/uploads` on the target server. If `MONGODB_URI` is configured, the ride and event persist in MongoDB; run against a temporary dev server with sponsor/database env unset to keep those records in memory.

## 4. Run Expo mobile

```bash
cd apps/mobile
cp .env.example .env
npm install
npx expo start
```

Set the mobile env to the laptop LAN IP, not `localhost`:

```env
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.42:3000
```

Open the app in Expo Go or a dev build, grant camera permission, and keep the phone on the same Wi-Fi as the laptop. Android emulator can use `http://10.0.2.2:3000`; physical Android and iPhone should use the laptop LAN IP.

## Expected provider status

With no sponsor secrets and no YOLO sidecar, `GET /api/providers/status` should still return `status: "ready"` because local fallbacks are available. Expected provider shape:

- `mongodb.configured: false`, `mongodb.mode: "memory"`.
- `gemini.configured: false`, `claude.configured: false`, `elevenLabs.configured: false`.
- `uploadStorage.available: true`.
- `localFallback.available: true`.
- `yolo.configured: false`, `yolo.available: false`, `yolo.check: "not-configured"`.

With `YOLO_SERVICE_URL=http://127.0.0.1:8000` and the sidecar running, expected YOLO fields are:

- `yolo.configured: true`.
- `yolo.available: true`.
- `yolo.check: "health"`.
- `yolo.serviceHost: "127.0.0.1:8000"`.

If YOLO is configured but not reachable, overall provider status becomes `"degraded"`, and `yolo.check` is `"failed-health"`. Fix the sidecar, firewall, or `YOLO_SERVICE_URL`, then restart Next so it reloads `.env.local`.

## Handoff checklist

1. Laptop and phone are on the same Wi-Fi.
2. Next is reachable from the phone at `http://<LAN-IP>:3000`.
3. YOLO health works at `http://127.0.0.1:8000/health` on the laptop.
4. `curl http://localhost:3000/api/providers/status` shows YOLO `available: true` when live detection is expected.
5. `apps/mobile/.env` uses `EXPO_PUBLIC_API_BASE_URL=http://<LAN-IP>:3000`.
6. `curl -X POST http://localhost:3000/api/seed/demo` ran before friends test replay or records.
