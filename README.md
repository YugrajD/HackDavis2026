# Guardian Road

HackDavis 2026 project: shared-road safety intelligence for bikes, scooters, and cars.

Guardian Road turns phones into road safety sensors. Bike/scooter phones warn riders in real time. Car-mounted phones act as AI dashcams. Both generate geotagged hazard events that feed a records dashboard, 3D safety replay, Davis danger map, and civic safety reports.

## Read first

- `AGENTS.md` — coordination rules and file ownership.
- `docs/PROJECT_BRIEF.md` — product and demo arc.
- `docs/API_CONTRACT.md` — shared data contract and endpoints.
- `docs/FRIEND_TASKS.md` — independent task specs for replay and records.
- `docs/REUSE_PLAN.md` — what to reuse from inspiration repos.
- `docs/INTEGRATION_STATUS.md` — blockers and contract changes.
- `docs/BACKEND_WIRED_RUNBOOK.md` — wired endpoints, env keys, judge demo runbook, reuse permission, and remaining work.

## Core loop

```txt
camera + GPS + IMU
→ hazard detection
→ spoken alert
→ saved event
→ records dashboard
→ 3D replay
→ Davis danger map
→ safety report
```

## Backend demo status

The backend is wired for the judge/friends demo. Seed `demo-ride-1`, then replay can use `/api/replay/demo-ride-1` and records can use `/api/events?rideId=demo-ride-1`, `/api/danger-segments`, `/api/ai/report`, and `/api/reports/export`. The app runs without secrets through memory/stub providers; real Atlas, Gemini, Claude, and ElevenLabs keys go only in `.env.local`.

Quick local check:

```bash
cp .env.example .env.local
npm install
npm run dev
```

Then in another terminal:

```bash
curl -X POST http://localhost:3000/api/seed/demo
```

See `docs/BACKEND_WIRED_RUNBOOK.md` for the full endpoint matrix, env key list, and demo commands.

## Track targets

Primary:

1. Best Hack for Social Good
2. Best AI/ML Hack, sponsored by Anthropic
3. Best Use of Gemini API
4. Best Use of ElevenLabs
5. Best Use of MongoDB Atlas

Secondary:

- Best UI/UX Design, sponsored by Figma
- Best Hardware Hack
- Most Technically Challenging Hack
- Best Use of DAC Materials
- Best use of Reconstruct
- Hacker's Choice
