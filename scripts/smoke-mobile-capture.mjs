#!/usr/bin/env node
import process from "node:process";

const REQUEST_TIMEOUT_MS = Number(process.env.SMOKE_REQUEST_TIMEOUT_MS || 15_000);
const baseUrl = (process.env.API_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const startedAt = new Date();
const start = { lat: 38.53835, lng: -121.76134 };
const routePoint = {
  t: 8,
  lat: start.lat + 0.00005,
  lng: start.lng + 0.00018,
  speedMps: 4.4,
  headingDeg: 86,
};

// Tiny JPEG like the Expo thumbnail path. YOLO may return zero boxes; the backend should fall back safely.
const tinyJpegBase64 =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wgARCAAKAAoDAREAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k=";

const results = [];

main().catch((error) => {
  console.error(`\nMobile capture smoke failed: ${error.message}`);
  if (error.cause) console.error(error.cause);
  process.exit(1);
});

async function main() {
  console.log(`Mobile capture smoke target: ${baseUrl}`);

  await step("provider preflight", async () => {
    const body = await requestJson("/api/providers/status");
    assert(["ready", "degraded"].includes(body.status), "provider status reports ready or degraded");
    assertProviderBoolean(body.providers?.mongodb, "mongodb");
    assertProviderBoolean(body.providers?.gemini, "gemini");
    assertProviderBoolean(body.providers?.claude, "claude");
    assertProviderBoolean(body.providers?.elevenLabs, "elevenLabs");
    assertProviderBoolean(body.providers?.uploadStorage, "uploadStorage");
    assertProviderBoolean(body.providers?.localFallback, "localFallback");
    assert(typeof body.providers?.yolo?.configured === "boolean", "provider status reports YOLO configuration state");
    assert(typeof body.providers?.yolo?.available === "boolean", "provider status reports YOLO availability");
    assert(["health", "failed-health", "not-configured"].includes(body.providers?.yolo?.check), "provider status reports YOLO health check state");
    return body;
  });

  const created = await step("start mobile ride", async () => {
    const body = await requestJson("/api/rides", {
      method: "POST",
      expectedStatus: 201,
      body: {
        mode: "bike",
        startLat: start.lat,
        startLng: start.lng,
      },
    });
    assert(typeof body.ride?.id === "string" && body.ride.id.length > 0, "ride create returns id");
    assert(body.ride.mode === "bike", "ride create preserves mode");
    assert(body.persisted === "memory" || body.persisted === "mongodb", "ride create reports persistence mode");
    return body;
  });

  const ride = created.ride;
  const elapsedSec = Math.max(1, Math.round((Date.now() - Date.parse(ride.startedAt || startedAt.toISOString())) / 1000));
  routePoint.t = Math.max(routePoint.t, elapsedSec);

  const uploaded = await step("upload thumbnailBase64", async () => {
    const body = await requestJson("/api/media/upload", {
      method: "POST",
      expectedStatus: 201,
      body: {
        thumbnailBase64: tinyJpegBase64,
        imageMimeType: "image/jpeg",
      },
    });
    assert(typeof body.thumbnailUrl === "string" && body.thumbnailUrl.length > 0, "upload returns thumbnailUrl");
    assert(Array.isArray(body.stored) && body.stored.some((item) => item.kind === "thumbnail"), "upload stores thumbnail metadata");
    assert(body.persisted === "public/generated", "upload reports generated-file persistence");
    return body;
  });

  const analyzed = await step("analyze and save with useYolo", async () => {
    const body = await requestJson("/api/media/analyze-and-save", {
      method: "POST",
      expectedStatus: 201,
      body: {
        imageBase64: tinyJpegBase64,
        rideId: ride.id,
        t: routePoint.t,
        lat: routePoint.lat,
        lng: routePoint.lng,
        speedMps: routePoint.speedMps,
        headingDeg: routePoint.headingDeg,
        camera: "front",
        useYolo: true,
        thumbnailUrl: uploaded.thumbnailUrl,
      },
    });
    assert(body.event?.rideId === ride.id, "analyze-save attaches event to mobile ride");
    assert(body.event?.thumbnailUrl === uploaded.thumbnailUrl, "analyze-save preserves uploaded thumbnail URL");
    assert(body.event?.t === routePoint.t, "analyze-save preserves capture time");
    assert(["gemini", "perception", "stub"].includes(body.provider), "analyze-save reports expected provider");
    assert(body.persisted === "memory" || body.persisted === "mongodb", "analyze-save reports persistence mode");
    return body;
  });

  await step("append route point", async () => {
    const body = await requestJson(`/api/rides/${encodeURIComponent(ride.id)}/route`, {
      method: "POST",
      body: {
        point: routePoint,
      },
    });
    assert(body.appended === 1, "route append reports one point");
    assert(body.ride?.id === ride.id, "route append returns same ride");
    assert(Array.isArray(body.ride?.route) && body.ride.route.length >= 2, "route append extends ride route");
    assert(body.persisted === "memory" || body.persisted === "mongodb", "route append reports persistence mode");
    return body;
  });

  await step("voice alert fallback", async () => {
    const body = await requestJson("/api/voice/alert", {
      method: "POST",
      body: { text: analyzed.event.spokenAlert || "Road hazard ahead." },
    });
    assert(typeof body.text === "string" && body.text.length > 0, "voice returns alert text");
    assert("audioUrl" in body, "voice response includes audioUrl field");
    assert(["stub", "elevenlabs"].includes(body.provider), "voice returns a known provider");
    if (body.provider === "stub") assert(body.audioUrl === null, "stub voice uses native TTS fallback");
    return body;
  });

  await step("end ride", async () => {
    const body = await requestJson(`/api/rides/${encodeURIComponent(ride.id)}/end`, {
      method: "PATCH",
    });
    assert(body.ride?.id === ride.id, "end returns same ride");
    assert(typeof body.ride?.endedAt === "string" && body.ride.endedAt.length > 0, "end sets endedAt");
    return body;
  });

  console.log("\nMobile capture smoke passed.");
  for (const result of results) console.log(`- ${result}`);
  console.log("Side effects: created and ended one smoke ride, saved one hazard event, and wrote one thumbnail under public/generated/uploads on the target server.");
}

async function step(name, fn) {
  process.stdout.write(`\n• ${name}... `);
  const value = await fn();
  results.push(name);
  console.log("ok");
  return value;
}

async function requestJson(path, options = {}) {
  const method = options.method || "GET";
  const expectedStatus = options.expectedStatus || 200;
  let response;

  try {
    response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: options.body ? { "content-type": "application/json" } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new Error(`${method} ${path} could not reach ${baseUrl}. Start Next or set API_BASE_URL.`, { cause: error });
  }

  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch (error) {
    throw new Error(`${method} ${path} returned non-JSON body: ${text.slice(0, 300)}`, { cause: error });
  }

  const expectedStatuses = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
  if (!expectedStatuses.includes(response.status)) {
    throw new Error(`${method} ${path} returned ${response.status}, expected ${expectedStatuses.join(" or ")}: ${JSON.stringify(body).slice(0, 500)}`);
  }

  return body;
}

function assertProviderBoolean(provider, label) {
  assert(typeof provider?.configured === "boolean", `provider status reports ${label} configuration state`);
  assert(typeof provider?.available === "boolean", `provider status reports ${label} availability`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
