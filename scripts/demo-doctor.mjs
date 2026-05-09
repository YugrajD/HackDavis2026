#!/usr/bin/env node
import process from "node:process";

const API_BASE_URL = (process.env.API_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const DEMO_RIDE_ID = "demo-ride-1";
const MIN_DEMO_EVENTS = 6;
const MIN_DANGER_SEGMENTS = 1;
const REQUEST_TIMEOUT_MS = Number(process.env.DEMO_DOCTOR_TIMEOUT_MS ?? 5_000);

const results = [];
const fixes = new Map();

main().catch((error) => {
  fail("doctor crashed", error.message, "Rerun with a reachable Next server: npm run dev, then API_BASE_URL=http://localhost:3000 npm run demo:doctor.");
  printSummary();
  process.exit(1);
});

async function main() {
  console.log(`Guardian Road demo doctor`);
  console.log(`API_BASE_URL=${API_BASE_URL}`);

  const seed = await requiredStep("seed demo data", async () => {
    const body = await requestJson("/api/seed/demo", { method: "POST" });
    if (body.rideId !== DEMO_RIDE_ID) {
      fail("seed demo data", `expected rideId ${DEMO_RIDE_ID}, got ${JSON.stringify(body.rideId)}`, missingSeedFix());
      return body;
    }
    if (!isCountAtLeast(body.eventCount, MIN_DEMO_EVENTS) || !isCountAtLeast(body.segmentCount, MIN_DANGER_SEGMENTS)) {
      fail(
        "seed demo data",
        `expected at least ${MIN_DEMO_EVENTS} events and ${MIN_DANGER_SEGMENTS} danger segment; got ${body.eventCount ?? "unknown"} events and ${body.segmentCount ?? "unknown"} segments`,
        missingSeedFix(),
      );
      return body;
    }
    pass("seed demo data", `${body.eventCount} events, ${body.segmentCount} danger segments`);
    return body;
  });

  if (!seed) {
    printSummary();
    process.exit(1);
  }

  await Promise.all([checkReadiness(), checkProviders(), checkReplay(seed), checkEvents(seed), checkDangerSegments(seed)]);

  printSummary();
  process.exit(results.some((result) => result.level === "FAIL") ? 1 : 0);
}

async function checkReadiness() {
  await checkedStep("health/readiness", async () => {
    const body = await requestJson("/api/health/readiness", { expectedStatuses: [200, 503] });
    if (!["ready", "degraded"].includes(body.status)) {
      fail("health/readiness", `unexpected status ${JSON.stringify(body.status)}`, "Inspect GET /api/health/readiness; it should return status ready or degraded with integration details.");
      return;
    }

    const demoRide = body.data?.demoRide;
    if (demoRide?.present !== true || !isCountAtLeast(demoRide?.eventCount, MIN_DEMO_EVENTS)) {
      fail("health/readiness", "seeded demo ride is missing or has too few events", missingSeedFix());
    }

    const uploads = body.integrations?.uploads;
    if (uploads?.writable === false) {
      fail("health/readiness", `upload storage is not writable${uploads.error ? ` (${uploads.error})` : ""}`, uploadFix(uploads.relativePath));
    }

    const mongo = body.integrations?.mongo;
    if (mongo?.configured === true && mongo.connected !== true) {
      warn("health/readiness", `MongoDB is configured but degraded${mongo.error ? ` (${mongo.error})` : ""}`, mongoFix());
    }

    const yolo = body.integrations?.yolo;
    addYoloResult("health/readiness", yolo);

    if (!hasResult("health/readiness", "FAIL") && !hasResult("health/readiness", "WARN")) {
      pass("health/readiness", `${body.status}; ${body.data?.events ?? "unknown"} events from ${body.data?.source ?? "unknown"}`);
    }
  });
}

async function checkProviders() {
  await checkedStep("providers/status", async () => {
    const body = await requestJson("/api/providers/status", { expectedStatuses: [200] });
    if (!["ready", "degraded"].includes(body.status)) {
      fail("providers/status", `unexpected status ${JSON.stringify(body.status)}`, "Inspect GET /api/providers/status; it should return status ready or degraded with provider details.");
      return;
    }

    const providers = body.providers;
    if (providers?.uploadStorage?.writable === false || providers?.uploadStorage?.available === false) {
      fail("providers/status", `upload storage is unavailable${providers.uploadStorage.error ? ` (${providers.uploadStorage.error})` : ""}`, uploadFix(providers.uploadStorage.relativePath));
    }

    if (providers?.mongodb?.configured === true && providers.mongodb.available !== true) {
      warn("providers/status", `MongoDB is configured but unavailable${providers.mongodb.error ? ` (${providers.mongodb.error})` : ""}`, mongoFix());
    }

    addYoloResult("providers/status", providers?.yolo);

    if (providers?.localFallback?.available !== true) {
      fail("providers/status", "local fallback is unavailable", "Keep deterministic local fallback enabled so the demo works without vendor keys.");
    }

    if (!hasResult("providers/status", "FAIL") && !hasResult("providers/status", "WARN")) {
      pass("providers/status", body.status);
    }
  });
}

async function checkReplay(seed) {
  await checkedStep("replay payload", async () => {
    const body = await requestJson(`/api/replay/${DEMO_RIDE_ID}`);
    if (body.ride?.id !== DEMO_RIDE_ID) {
      fail("replay payload", `expected ride ${DEMO_RIDE_ID}`, missingSeedFix());
      return;
    }
    if (!Array.isArray(body.ride.route) || body.ride.route.length < 2) {
      fail("replay payload", "demo route has fewer than two points", missingSeedFix());
    }
    if (!Array.isArray(body.events) || body.events.length < Math.max(seed.eventCount ?? MIN_DEMO_EVENTS, MIN_DEMO_EVENTS)) {
      fail("replay payload", "replay has missing seeded events", missingSeedFix());
    }
    if (!Array.isArray(body.dangerSegments) || body.dangerSegments.length < MIN_DANGER_SEGMENTS) {
      fail("replay payload", "replay has no danger segments", missingSeedFix());
    }
    if (!hasResult("replay payload", "FAIL")) {
      pass("replay payload", `${body.events.length} events, ${body.dangerSegments.length} danger segments`);
    }
  });
}

async function checkEvents(seed) {
  await checkedStep("events", async () => {
    const body = await requestJson(`/api/events?rideId=${encodeURIComponent(DEMO_RIDE_ID)}`);
    if (!Array.isArray(body.events)) {
      fail("events", "response did not include events[]", "Check GET /api/events route and its JSON envelope.");
      return;
    }
    const expected = Math.max(seed.eventCount ?? MIN_DEMO_EVENTS, MIN_DEMO_EVENTS);
    if (body.events.length < expected) {
      fail("events", `expected at least ${expected} demo events, got ${body.events.length}`, missingSeedFix());
      return;
    }
    const wrongRide = body.events.find((event) => event.rideId !== DEMO_RIDE_ID);
    if (wrongRide) {
      fail("events", `event ${wrongRide.id ?? "unknown"} belongs to ${wrongRide.rideId ?? "unknown ride"}`, "Check event filtering in GET /api/events?rideId=demo-ride-1.");
      return;
    }
    pass("events", `${body.events.length} demo events`);
  });
}

async function checkDangerSegments(seed) {
  await checkedStep("danger segments", async () => {
    const body = await requestJson("/api/danger-segments");
    if (!Array.isArray(body.dangerSegments)) {
      fail("danger segments", "response did not include dangerSegments[]", "Check GET /api/danger-segments route and its JSON envelope.");
      return;
    }
    const expected = Math.max(seed.segmentCount ?? MIN_DANGER_SEGMENTS, MIN_DANGER_SEGMENTS);
    if (body.dangerSegments.length < expected) {
      fail("danger segments", `expected at least ${expected} segments, got ${body.dangerSegments.length}`, missingSeedFix());
      return;
    }
    pass("danger segments", `${body.dangerSegments.length} segments`);
  });
}

async function checkedStep(label, fn) {
  try {
    await fn();
  } catch (error) {
    fail(label, error.message, routeFix(label));
  }
}

async function requiredStep(label, fn) {
  try {
    return await fn();
  } catch (error) {
    fail(label, error.message, routeFix(label));
    return null;
  }
}

async function requestJson(path, { method = "GET", expectedStatuses = [200], body } = {}) {
  const url = `${API_BASE_URL}${path}`;
  let response;

  try {
    response = await fetch(url, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new Error(`cannot reach ${url}: ${error instanceof Error ? error.message : "request failed"}`);
  }

  const text = await response.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${url} returned non-JSON status ${response.status}: ${text.slice(0, 160)}`);
  }

  if (!expectedStatuses.includes(response.status)) {
    throw new Error(`${url} returned HTTP ${response.status}: ${text.slice(0, 220)}`);
  }

  return json;
}

function addYoloResult(label, yolo) {
  if (!yolo || typeof yolo.configured !== "boolean" || typeof yolo.available !== "boolean") {
    fail(label, "YOLO status is missing from response", "Check readiness/provider status contracts for yolo.configured, yolo.available, and yolo.check.");
    return;
  }

  if (!yolo.configured) {
    warn(label, "YOLO_SERVICE_URL is unset", yoloUnsetFix());
    return;
  }

  if (!yolo.available) {
    warn(label, `YOLO sidecar is not reachable${yolo.error ? ` (${yolo.error})` : ""}`, yoloDownFix(yolo.serviceHost));
  }
}

function pass(label, message) {
  results.push({ level: "PASS", label, message });
}

function warn(label, message, fix) {
  results.push({ level: "WARN", label, message });
  addFix(label, fix);
}

function fail(label, message, fix) {
  results.push({ level: "FAIL", label, message });
  addFix(label, fix);
}

function addFix(label, fix) {
  if (fix) fixes.set(fix, label);
}

function hasResult(label, level) {
  return results.some((result) => result.label === label && result.level === level);
}

function isCountAtLeast(value, minimum) {
  return Number.isInteger(value) && value >= minimum;
}

function routeFix(label) {
  if (label === "seed demo data") return `Start the Next server first: npm run dev. Then rerun API_BASE_URL=${API_BASE_URL} npm run demo:doctor.`;
  return `Check that npm run dev is still running at ${API_BASE_URL}, then open the failing endpoint directly or rerun npm run demo:doctor.`;
}

function missingSeedFix() {
  return "The doctor posts /api/seed/demo automatically. If seeded data is still missing, restart npm run dev to clear the memory store, verify MongoDB writes if MONGODB_URI is set, then rerun npm run demo:doctor.";
}

function uploadFix(relativePath = "public/generated/uploads") {
  return `Make uploads writable from the repo root: mkdir -p ${relativePath} && chmod u+w ${relativePath}. If running from a deployed host, ensure the process can write to public/generated/uploads.`;
}

function mongoFix() {
  return "MONGODB_URI is set but Atlas is not reachable. Verify the URI, IP allowlist, database user, and network. For a memory-only local demo, remove MONGODB_URI from .env.local and restart npm run dev.";
}

function yoloUnsetFix() {
  return "YOLO_SERVICE_URL is unset. For live mobile detection, run services/yolo with uvicorn, set YOLO_SERVICE_URL=http://127.0.0.1:8000 in .env.local, restart npm run dev, then rerun npm run demo:doctor. For seeded replay/records only, this warning is safe.";
}

function yoloDownFix(serviceHost = "127.0.0.1:8000") {
  return `YOLO_SERVICE_URL points to ${serviceHost}, but health failed. Start the sidecar: cd services/yolo && source .venv/bin/activate && uvicorn main:app --host 0.0.0.0 --port 8000, or fix the URL/firewall and restart Next.`;
}

function printSummary() {
  console.log("\nChecks");
  for (const result of results) {
    console.log(`${result.level.padEnd(4)} ${result.label}: ${result.message}`);
  }

  if (fixes.size > 0) {
    console.log("\nActionable fixes");
    let index = 1;
    for (const fix of fixes.keys()) {
      console.log(`${index}. ${fix}`);
      index += 1;
    }
  }

  const failCount = results.filter((result) => result.level === "FAIL").length;
  const warnCount = results.filter((result) => result.level === "WARN").length;
  console.log(`\nResult: ${failCount === 0 ? "PASS" : "FAIL"} (${failCount} failed, ${warnCount} warnings)`);
}
