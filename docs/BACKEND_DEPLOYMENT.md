# Backend Deployment Notes

## Runtime

- Next.js API routes require the Node.js runtime for media uploads because `/api/media/upload` writes to `public/generated/uploads` in local demo mode.
- On serverless hosts, that directory is ephemeral. Use it for HackDavis demos and short sessions only. For durable evidence clips, replace the write target with object storage while preserving the `MediaUploadResponse` envelope from `src/lib/contracts.ts`.

## Required checks before demo

```bash
npm run typecheck
npm run build
```

Then seed data:

```bash
curl -X POST http://localhost:3000/api/seed/demo
```

## Environment

Copy `.env.example` to `.env.local`. The app runs without vendor keys by falling back to deterministic stubs and the memory store. Add these keys to enable sponsor-backed paths without changing API shapes:

- `MONGODB_URI` and `MONGODB_DB` for Atlas persistence and geospatial queries.
- `GEMINI_API_KEY` for frame hazard analysis.
- `ANTHROPIC_API_KEY` for safety reports.
- `ELEVENLABS_API_KEY` for alert audio.

## Upload limits

- Thumbnails: JPEG, PNG, or WebP, max 4MB.
- Clips: WebM, MP4, or QuickTime, max 12MB.
- One thumbnail and one clip are accepted per request.
