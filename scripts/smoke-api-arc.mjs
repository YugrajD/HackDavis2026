#!/usr/bin/env node
import { spawn } from "node:child_process";
import process from "node:process";

const DEFAULT_PORT = Number(process.env.SMOKE_PORT || 3210);
const START_TIMEOUT_MS = Number(process.env.SMOKE_START_TIMEOUT_MS || 45_000);
const REQUEST_TIMEOUT_MS = Number(process.env.SMOKE_REQUEST_TIMEOUT_MS || 15_000);
const DEMO_RIDE_ID = "demo-ride-1";
const TINY_PNG_DATA_URI =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

let child = null;
const ownsServer = !process.env.API_BASE_URL;
const baseUrl = (process.env.API_BASE_URL || `http://127.0.0.1:${DEFAULT_PORT}`).replace(/\/$/, "");
const results = [];

main().catch(async (error) => {
  console.error(`\nSmoke API arc failed: ${error.message}`);
  if (error.cause) console.error(error.cause);
  await stopServer();
  process.exit(1);
});

async function main() {
  if (ownsServer) await startServer();

  const seed = await step("seed demo data", async () => {
    const body = await requestJson("/api/seed/demo", { method: "POST", expectedStatus: 200 });
    assert(body.rideId === DEMO_RIDE_ID, "seed returns demo ride id");
    assert(Number.isInteger(body.eventCount) && body.eventCount >= 6, "seed returns at least six demo events");
    assert(Number.isInteger(body.segmentCount) && body.segmentCount >= 1, "seed returns danger segments");
    return body;
  });

  await step("read backend readiness", async () => {
    const body = await requestJson("/api/health/readiness", { expectedStatus: [200, 503] });
    assert(["ready", "degraded"].includes(body.status), "readiness reports status");
    assert(typeof body.integrations?.mongo?.configured === "boolean", "readiness reports Mongo configuration state");
    assert(typeof body.integrations?.gemini?.configured === "boolean", "readiness reports Gemini key presence");
    assert(typeof body.integrations?.anthropic?.configured === "boolean", "readiness reports Anthropic key presence");
    assert(typeof body.integrations?.elevenLabs?.configured === "boolean", "readiness reports ElevenLabs key presence");
    assert(typeof body.integrations?.uploads?.writable === "boolean", "readiness reports upload writability");
    assert(Number.isInteger(body.data?.events) && body.data.events >= seed.eventCount, "readiness reports seeded event count");
    if (ownsServer) assert(body.status === "ready" && body.integrations.uploads.writable, "owned smoke server is ready");
    return body;
  });

  await step("read provider status", async () => {
    const body = await requestJson("/api/providers/status");
    assert(["ready", "degraded"].includes(body.status), "provider status reports status");
    assert(typeof body.providers?.mongodb?.configured === "boolean", "provider status reports MongoDB configuration state");
    assert(typeof body.providers?.mongodb?.available === "boolean", "provider status reports MongoDB availability");
    assert(typeof body.providers?.gemini?.configured === "boolean", "provider status reports Gemini configuration state");
    assert(typeof body.providers?.claude?.available === "boolean", "provider status reports Claude availability");
    assert(typeof body.providers?.elevenLabs?.configured === "boolean", "provider status reports ElevenLabs configuration state");
    assert(body.providers?.uploadStorage?.available === body.providers?.uploadStorage?.writable, "provider status maps upload writability to availability");
    assert(body.providers?.localFallback?.available === true, "provider status reports local fallback availability");
    if (ownsServer) assert(body.status === "ready" && body.providers.uploadStorage.writable, "owned smoke server provider status is ready");
    return body;
  });

  const replay = await step("load replay payload", async () => {
    const body = await requestJson(`/api/replay/${DEMO_RIDE_ID}`);
    assert(body.ride?.id === DEMO_RIDE_ID, "replay has demo ride");
    assert(Array.isArray(body.ride.route) && body.ride.route.length >= 2, "replay has route points");
    assert(Array.isArray(body.events) && body.events.length >= seed.eventCount, "replay includes seeded events");
    assertEventsSortedByTimeline(body.events, "replay events are timeline ordered");
    assert(Array.isArray(body.dangerSegments) && body.dangerSegments.length >= 1, "replay includes danger segments");
    return body;
  });

  await step("create ride and append route", async () => {
    const createdRide = await requestJson("/api/rides", {
      method: "POST",
      expectedStatus: 201,
      body: {
        mode: "bike",
        startLat: replay.ride.startLat,
        startLng: replay.ride.startLng,
      },
    });
    assert(createdRide.ride?.id?.startsWith("ride-"), "ride create returns ride id");

    const appended = await requestJson(`/api/rides/${createdRide.ride.id}/route`, {
      method: "POST",
      body: {
        points: [
          { t: 6, lat: replay.ride.startLat + 0.00002, lng: replay.ride.startLng + 0.00008, speedMps: 4.1, headingDeg: 84 },
          { t: 13, lat: replay.ride.startLat + 0.00004, lng: replay.ride.startLng + 0.00018, speedMps: 4.8, headingDeg: 87 },
        ],
      },
    });
    assert(appended.appended === 2, "route append reports point count");
    assert(appended.persisted === "memory" || appended.persisted === "mongodb", "route append reports persistence mode");
    assert(appended.ride?.route?.length === 3, "route append extends ride route");
    assert(appended.ride?.stats?.durationSec === 13, "route append recalculates duration");
    assert(appended.ride?.stats?.distanceMeters > 0, "route append recalculates distance");
    return appended;
  });

  const events = await step("list and create events", async () => {
    const listed = await requestJson(`/api/events?rideId=${DEMO_RIDE_ID}&minSeverity=50`);
    assert(Array.isArray(listed.events) && listed.events.length > 0, "events list is non-empty");
    assertEventsSortedNewestFirst(listed.events, "events list is newest-first");

    const point = replay.ride.route[Math.min(2, replay.ride.route.length - 1)];
    const created = await requestJson("/api/events", {
      method: "POST",
      expectedStatus: 201,
      body: {
        id: `smoke-event-${Date.now()}`,
        rideId: DEMO_RIDE_ID,
        t: point.t,
        timestamp: new Date().toISOString(),
        type: "blocked_bike_lane",
        severity: 67,
        confidence: 0.86,
        lat: point.lat,
        lng: point.lng,
        headingDeg: point.headingDeg,
        speedMps: point.speedMps,
        camera: "front",
        spokenAlert: "Bike lane blocked ahead.",
        explanation: "Smoke test event verifies the event write path used by capture and records.",
        objects: [
          {
            id: "smoke-truck",
            type: "truck",
            confidence: 0.81,
            position: { x: 1.2, y: 0, z: 5.5 },
            distanceM: 5.7,
            ttcSec: 1.9,
          },
        ],
      },
    });
    assert(created.event?.id?.startsWith("smoke-event-"), "event create returns inserted event");
    assert(created.persisted === "memory" || created.persisted === "mongodb", "event create reports persistence mode");

    const nearby = await requestJson(`/api/events/near?lat=${point.lat}&lng=${point.lng}&radiusM=500`);
    assert(Array.isArray(nearby.events) && nearby.events.some((event) => event.id === created.event.id), "nearby events include created event");
    assertEventsSortedNewestFirst(nearby.events, "nearby events are newest-first");
    return { listed, created, nearby };
  });

  const uploadedMedia = await step("upload media evidence", async () => {
    const body = await requestJson("/api/media/upload", {
      method: "POST",
      expectedStatus: 201,
      body: { imageBase64: TINY_PNG_DATA_URI },
    });
    const thumbnail = body.stored?.find((item) => item.kind === "thumbnail");
    assert(body.persisted === "public/generated", "media upload reports local public persistence");
    assert(typeof body.thumbnailUrl === "string" && body.thumbnailUrl.startsWith("/generated/uploads/thumbnail-"), "media upload returns thumbnail URL");
    assert(body.thumbnailUrl.endsWith(".png"), "media upload preserves PNG extension");
    assert(thumbnail?.url === body.thumbnailUrl, "media upload metadata includes thumbnail URL");
    assert(thumbnail?.contentType === "image/png", "media upload metadata includes PNG content type");
    assert(Number.isInteger(thumbnail?.bytes) && thumbnail.bytes > 0, "media upload metadata includes byte size");
    return body;
  });

  const analyzed = await step("analyze and save media", async () => {
    const point = replay.ride.route[Math.min(3, replay.ride.route.length - 1)];
    const capturedAt = new Date().toISOString();
    const draftRideId = `smoke-draft-ride-${Date.now()}`;
    const body = await requestJson("/api/media/analyze-and-save", {
      method: "POST",
      expectedStatus: 201,
      body: {
        thumbnailUrl: uploadedMedia.thumbnailUrl,
        perception: {
          frameId: "smoke-frame-1",
          capturedAt,
          workerVersion: "guardian-road-perception-v1",
          tracks: [
            {
              id: "smoke-car-track",
              type: "car",
              label: "car",
              confidence: 0.9,
              position: { x: -0.8, y: 0, z: -3.4 },
              velocity: { x: 0.1, y: 0, z: 6.2 },
              distanceM: 3.5,
              ttcSec: 1.2,
              riskScore: 82,
              lastFrameId: "smoke-frame-1",
              lastSeenAt: capturedAt,
              relativeLocation: "behind",
            },
          ],
          risk: {
            type: "vehicle_approach",
            severity: 82,
            confidence: 0.88,
            spokenAlert: "Vehicle approaching behind.",
            explanation: "Perception fallback detected a fast rear approach.",
            primaryObjectId: "smoke-car-track",
            reasons: ["Rear object closing distance", "Low time-to-collision"],
          },
          hazardDraft: {
            rideId: draftRideId,
            t: point.t,
            timestamp: capturedAt,
            type: "vehicle_approach",
            severity: 82,
            confidence: 0.88,
            lat: point.lat,
            lng: point.lng,
            headingDeg: point.headingDeg,
            speedMps: point.speedMps,
            camera: "rear",
            spokenAlert: "Vehicle approaching behind.",
            explanation: "Perception fallback detected a fast rear approach.",
            objects: [
              {
                id: "smoke-car-track",
                type: "car",
                confidence: 0.9,
                position: { x: -0.8, y: 0, z: -3.4 },
                velocity: { x: 0.1, y: 0, z: 6.2 },
                distanceM: 3.5,
                ttcSec: 1.2,
              },
            ],
          },
        },
      },
    });
    assert(body.event?.rideId === draftRideId, "analyze-save preserves perception draft ride id");
    assert(body.event?.t === point.t, "analyze-save preserves perception draft time");
    assert(body.event?.timestamp === capturedAt, "analyze-save preserves perception draft timestamp");
    assert(body.event?.lat === point.lat && body.event?.lng === point.lng, "analyze-save preserves perception draft location");
    assert(body.event?.headingDeg === point.headingDeg && body.event?.speedMps === point.speedMps, "analyze-save preserves perception draft motion");
    assert(body.event?.camera === "rear", "analyze-save preserves perception draft camera");
    assert(["gemini", "perception", "stub"].includes(body.provider), "analyze-save reports provider");
    assert(body.event.thumbnailUrl === uploadedMedia.thumbnailUrl, "analyze-save preserves uploaded evidence URL");
    return body;
  });

  const report = await step("current segment report and export", async () => {
    const segments = await requestJson("/api/danger-segments");
    assert(Array.isArray(segments.dangerSegments) && segments.dangerSegments.length > 0, "danger segments list is non-empty");
    const segment = segments.dangerSegments[0];

    const reportBody = await requestJson("/api/ai/report", {
      method: "POST",
      body: { segmentId: segment.id, events: [events.created.event, analyzed.event] },
    });
    assert(reportBody.report?.segmentId === segment.id, "report targets selected segment");
    assert(typeof reportBody.report?.summary === "string" && reportBody.report.summary.length > 20, "report has summary");

    const exportBody = await requestJson("/api/reports/export", {
      method: "POST",
      body: { segmentId: segment.id, format: "markdown", events: [events.created.event, analyzed.event] },
    });
    assert(exportBody.format === "markdown", "export returns requested format");
    assert(typeof exportBody.document === "string" && exportBody.document.includes(segment.label), "export includes segment label");
    assert(typeof exportBody.filename === "string" && !/[\\/]/.test(exportBody.filename), "export returns a sanitized filename");
    assert(typeof exportBody.exportUrl === "string" && exportBody.exportUrl === `/generated/reports/${exportBody.filename}`, "export returns persisted report URL");
    const persistedDocument = await requestText(exportBody.exportUrl);
    assert(persistedDocument === exportBody.document, "export URL serves the generated document");
    return { segment, reportBody, exportBody };
  });

  await step("scenario lab", async () => {
    const listed = await requestJson("/api/scenarios");
    assert(Array.isArray(listed.presets) && listed.presets.length >= 1, "scenario presets are available");
    assert(Array.isArray(listed.scenarios) && listed.scenarios.length >= listed.presets.length, "scenario GET returns generated scenarios");

    const generated = await requestJson("/api/scenarios", {
      method: "POST",
      body: {
        prompt: "rear camera close pass on Russell Boulevard",
        mode: "bike",
        camera: "rear",
        lat: replay.ride.startLat,
        lng: replay.ride.startLng,
        seed: 20260509,
      },
    });
    assert(generated.provider === "deterministic-scenario-lab", "scenario POST uses deterministic provider");
    assert(generated.scenario?.camera === "rear", "scenario respects camera input");
    assert(generated.hazardDraft?.type === "close_pass", "scenario produces expected hazard draft");
    assert(generated.replayPayload?.events?.length === 1, "scenario includes replay-ready event");
  });

  await step("voice alert fallback", async () => {
    const body = await requestJson("/api/voice/alert", {
      method: "POST",
      body: { text: report.segment.explanation || "Road hazard ahead." },
    });
    assert(typeof body.text === "string" && body.text.length > 0, "voice returns alert text");
    assert("audioUrl" in body, "voice response includes audioUrl field");
    assert(typeof body.message === "string" && body.message.length > 0, "voice returns fallback guidance");
    if (ownsServer) {
      assert(body.provider === "stub" && body.audioUrl === null, "owned smoke server exercises native TTS fallback");
    } else {
      assert(["stub", "elevenlabs"].includes(body.provider), "external smoke server returns known voice provider");
    }
  });

  console.log("\nSmoke API arc passed.");
  for (const result of results) console.log(`- ${result}`);
  await stopServer();
}

async function startServer() {
  const nextBin = "node_modules/next/dist/bin/next";
  console.log(`Starting local Next server on ${baseUrl}`);
  child = spawn(process.execPath, [nextBin, "dev", "--hostname", "127.0.0.1", "--port", String(DEFAULT_PORT)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ELEVENLABS_API_KEY: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => process.stdout.write(prefixServerLog(chunk)));
  child.stderr.on("data", (chunk) => process.stderr.write(prefixServerLog(chunk)));
  child.on("exit", (code, signal) => {
    if (code !== null && code !== 0) console.error(`Next dev server exited with code ${code}`);
    if (signal) console.error(`Next dev server exited with signal ${signal}`);
  });

  const deadline = Date.now() + START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/replay/${DEMO_RIDE_ID}`, { method: "GET", signal: AbortSignal.timeout(2_000) });
      if (response.ok) return;
    } catch {
      // Server is still booting.
    }
    await sleep(500);
  }

  throw new Error(`Timed out waiting for ${baseUrl}`);
}

async function stopServer() {
  if (!child) return;
  const exiting = new Promise((resolve) => child.once("exit", resolve));
  child.kill("SIGTERM");
  await Promise.race([exiting, sleep(5_000)]);
  if (!child.killed) child.kill("SIGKILL");
  child = null;
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
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: options.body ? { "content-type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

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

async function requestText(path, options = {}) {
  const method = options.method || "GET";
  const expectedStatus = options.expectedStatus || 200;
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const text = await response.text();
  const expectedStatuses = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
  if (!expectedStatuses.includes(response.status)) {
    throw new Error(`${method} ${path} returned ${response.status}, expected ${expectedStatuses.join(" or ")}: ${text.slice(0, 500)}`);
  }
  return text;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertEventsSortedNewestFirst(events, message) {
  assert(events.every((event, index) => index === 0 || compareEventsNewestFirst(events[index - 1], event) <= 0), message);
}

function assertEventsSortedByTimeline(events, message) {
  assert(events.every((event, index) => index === 0 || compareEventsForTimeline(events[index - 1], event) <= 0), message);
}

function compareEventsNewestFirst(a, b) {
  return eventTimeMs(b) - eventTimeMs(a) || b.t - a.t || String(a.id).localeCompare(String(b.id));
}

function compareEventsForTimeline(a, b) {
  return a.t - b.t || eventTimeMs(a) - eventTimeMs(b) || String(a.id).localeCompare(String(b.id));
}

function eventTimeMs(event) {
  const value = Date.parse(event.timestamp);
  return Number.isFinite(value) ? value : 0;
}

function prefixServerLog(chunk) {
  return String(chunk)
    .split(/(?<=\n)/)
    .map((line) => (line.trim() ? `  [next] ${line}` : line))
    .join("");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

process.on("SIGINT", async () => {
  await stopServer();
  process.exit(130);
});

process.on("SIGTERM", async () => {
  await stopServer();
  process.exit(143);
});
