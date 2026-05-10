#!/usr/bin/env node

const baseUrl = (process.env.API_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const REQUEST_TIMEOUT_MS = Number(process.env.SMOKE_REQUEST_TIMEOUT_MS ?? 15_000);

const ONE_PIXEL_PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

const cases = [
  {
    name: "malformed media upload JSON",
    method: "POST",
    path: "/api/media/upload",
    headers: { "content-type": "application/json" },
    body: "{bad-json",
    statuses: [400],
  },
  {
    name: "invalid media upload MIME",
    method: "POST",
    path: "/api/media/upload",
    json: { imageBase64: `data:image/jpeg;base64,${ONE_PIXEL_PNG}` },
    statuses: [415],
  },
  {
    name: "missing YOLO image",
    method: "POST",
    path: "/api/perception/detect",
    json: {},
    statuses: [400],
  },
  {
    name: "bad YOLO image",
    method: "POST",
    path: "/api/perception/detect",
    json: { imageBase64: "not-base64" },
    statuses: [400],
  },
  {
    name: "unknown report segment",
    method: "POST",
    path: "/api/ai/report",
    json: { segmentId: "missing-smoke-segment" },
    statuses: [404],
  },
  {
    name: "invalid ride route point",
    method: "POST",
    path: "/api/rides/smoke-ride/route",
    json: { point: { t: -1, lat: 38.5449, lng: -121.7405, speedMps: 4.2, headingDeg: 90 } },
    statuses: [400],
  },
  {
    name: "invalid nearby query",
    method: "GET",
    path: "/api/events/near?lat=bad&lng=-121.7405&radiusM=100",
    statuses: [400],
  },
];

try {
  for (const smokeCase of cases) {
    await runCase(smokeCase);
  }

  console.log(`Smoke API error envelopes passed against ${baseUrl}.`);
} catch (error) {
  console.error(`Smoke API error envelopes failed: ${error.message}`);
  process.exit(1);
}

async function runCase(smokeCase) {
  const response = await fetch(`${baseUrl}${smokeCase.path}`, {
    method: smokeCase.method,
    headers: {
      ...(smokeCase.json ? { "content-type": "application/json" } : {}),
      ...(smokeCase.headers ?? {}),
    },
    body: smokeCase.json ? JSON.stringify(smokeCase.json) : smokeCase.body,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch (error) {
    throw new Error(`${smokeCase.name} returned non-JSON body: ${text.slice(0, 300)}`, { cause: error });
  }

  assert(smokeCase.statuses.includes(response.status), `${smokeCase.name} returned ${response.status}, expected ${smokeCase.statuses.join(" or ")}`);
  assert(payload && typeof payload.error === "string" && payload.error.trim().length > 0, `${smokeCase.name} did not return a JSON error field`);
  assert(payload.status === response.status, `${smokeCase.name} did not mirror HTTP status in the error envelope`);

  console.log(`ok ${smokeCase.name}: ${response.status} ${payload.error}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
