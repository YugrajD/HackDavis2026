# Sponsor setup checklist

Use this when turning the seeded demo into a live sponsor demo. Keep real keys in `.env.local` only. Never commit `.env.local`, screenshots of keys, or provider console pages that show secrets.

## Fast path

1. Start the web app.

   ```bash
   cp .env.example .env.local
   npm install
   npm run dev -- --hostname 0.0.0.0
   ```

2. Open the setup pages.

   - MongoDB Atlas: <https://cloud.mongodb.com/>
   - Gemini API key: <https://aistudio.google.com/app/apikey>
   - Gemini pricing/free tier: <https://ai.google.dev/gemini-api/docs/pricing>
   - Anthropic keys: <https://console.anthropic.com/settings/keys>
   - Anthropic billing: <https://console.anthropic.com/settings/plans>
   - ElevenLabs keys: <https://elevenlabs.io/app/settings/api-keys>
   - ElevenLabs API pricing: <https://elevenlabs.io/pricing/api>
   - Local provider status: <http://127.0.0.1:3000/api/providers/status>

3. Fill `.env.local`.

   ```env
   MONGODB_URI=mongodb+srv://...
   MONGODB_DB=guardian-road
   GEMINI_API_KEY=...
   GEMINI_MODEL=gemini-1.5-flash
   ANTHROPIC_API_KEY=...
   ANTHROPIC_MODEL=claude-3-5-sonnet-latest
   ELEVENLABS_API_KEY=...
   ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM
   ELEVENLABS_MODEL_ID=eleven_multilingual_v2
   ELEVENLABS_OUTPUT_FORMAT=mp3_44100_128
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   YOLO_SERVICE_URL=http://127.0.0.1:8000
   ```

4. Restart `npm run dev`, then check providers.

   ```bash
   curl http://127.0.0.1:3000/api/providers/status
   API_BASE_URL=http://127.0.0.1:3000 npm run demo:doctor
   API_BASE_URL=http://127.0.0.1:3000 npm run smoke:api
   ```

## Provider notes

### MongoDB Atlas

Create a free Atlas deployment, create a database user, allow your laptop IP in Network Access, then copy the Node.js connection string. Put that string in `MONGODB_URI`. Atlas free and flex clusters require clients with SNI support; the Node MongoDB driver used here supports it.

### Gemini

Google AI Studio can create a Gemini API key quickly and has a free tier with rate limits. This app uses Gemini for frame/hazard interpretation, so it still works without a key through deterministic fallback mode, but the live sponsor demo is stronger with a real key.

### Anthropic

Anthropic Console API access normally uses prepaid usage credits. New accounts may receive a small amount of free test credit, but do not assume it will be enough for a long demo loop. Use Claude for civic report generation only; avoid sending every frame to Claude.

### ElevenLabs

ElevenLabs API access is available on the free plan with limited credits. The app falls back to text/native browser behavior if the key is missing. For the demo, one short voice line per saved hazard is enough.

### YOLO sidecar

YOLO does not need a cloud token. Run it locally:

```bash
cd services/yolo
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

Then set `YOLO_SERVICE_URL=http://127.0.0.1:8000` in root `.env.local` and restart Next.

## Expo phone test

1. Get the laptop LAN IP.

   ```bash
   ipconfig getifaddr en0
   ```

2. Create `apps/mobile/.env`.

   ```env
   EXPO_PUBLIC_API_BASE_URL=http://YOUR_LAN_IP:3000
   ```

3. Start Expo from repo root.

   ```bash
   npm run sim
   ```

4. Open the QR code in Expo Go. The phone and laptop must be on the same Wi-Fi. If the phone cannot connect, use the LAN IP, not `localhost`, and check the laptop firewall.
