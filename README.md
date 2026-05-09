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
