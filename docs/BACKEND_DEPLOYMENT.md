# Backend Deployment Notes

For judge/friend handoff, read `docs/BACKEND_WIRED_RUNBOOK.md` first. It lists the wired endpoints, env keys, demo commands, repo reuse permission note, and remaining work.

## Runtime

- Next.js API routes require the Node.js runtime for media uploads because `/api/media/upload` writes to `public/generated/uploads` in local demo mode.
- On serverless hosts, that directory is ephemeral. Use it for HackDavis demos and short sessions only. For durable evidence clips, replace the write target with object storage while preserving the `MediaUploadResponse` envelope from `src/lib/contracts.ts`.

## Required checks before demo

```bash
npm run typecheck
npm run build
```

Then start the app in one terminal:

```bash
npm run dev
```

Seed and check data in another terminal:

```bash
curl -X POST http://localhost:3000/api/seed/demo
curl http://localhost:3000/api/replay/demo-ride-1
curl 'http://localhost:3000/api/events?rideId=demo-ride-1'
curl http://localhost:3000/api/danger-segments
```

Optional end-to-end backend smoke:

```bash
npm run smoke:api
```

## Environment

Copy `.env.example` to `.env.local`. The app runs without vendor keys by falling back to deterministic stubs and the memory store. Add these keys to enable sponsor-backed paths without changing API shapes:

- `MONGODB_URI` and `MONGODB_DB` for Atlas persistence and geospatial queries.
- `GEMINI_API_KEY` and optional `GEMINI_MODEL` for frame hazard analysis.
- `ANTHROPIC_API_KEY` and optional `ANTHROPIC_MODEL` for safety reports.
- `ELEVENLABS_API_KEY`, optional `ELEVENLABS_VOICE_ID`, optional `ELEVENLABS_MODEL_ID`, and optional `ELEVENLABS_OUTPUT_FORMAT` for alert audio.
- `NEXT_PUBLIC_APP_URL` for local/public app links.

Real values belong only in `.env.local` or the deployment provider's secret store. Commit `.env.example` only.

## Upload limits

- Thumbnails: JPEG, PNG, or WebP, max 4MB.
- Clips: WebM, MP4, or QuickTime, max 12MB.
- One thumbnail and one clip are accepted per request.
- `/api/perception/detect` and `/api/media/analyze-and-save` accept one base64 image up to the same 4MB decoded thumbnail limit, with JSON/body allowance for base64 overhead.
