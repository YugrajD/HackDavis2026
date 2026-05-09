# Scenario Lab and Report Export Routes

## Scenario Lab

`GET /api/scenarios` returns Mirage-style preset road-danger scenarios. It is deterministic; preset prompts produce stable IDs, timestamps, route points, hazard drafts, and replay payloads.

`POST /api/scenarios` accepts either one `prompt` or up to 12 `prompts`. Optional `seed`, `mode`, `camera`, `lat`, and `lng` pin the generated scenario. The single response includes `scenario`, `hazardDraft`, `replayPayload`, and provider `deterministic-scenario-lab`. Batch responses return `scenarios`, each using the same shape.

## Report Export

`POST /api/ai/report` returns a structured Vision Zero-style report for a backend segment or caller-provided segment/events.

`POST /api/reports/export` returns the report plus an export document and persists the file under `public/generated/reports`. Formats are `markdown`, `html`, `csv`, and `pdf-text`; every response includes an `exportUrl` such as `/generated/reports/seg-russell-olive-guardian-road-report.txt`. The `pdf-text` format is plain text with report headers, wrapped sections, and an event appendix so the Records UI can download or print it without a PDF dependency.
