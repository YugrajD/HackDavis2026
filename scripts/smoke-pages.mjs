#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import process from "node:process";

const DEFAULT_PORT = Number(process.env.SMOKE_PORT || 3212);
const START_TIMEOUT_MS = Number(process.env.SMOKE_START_TIMEOUT_MS || 45_000);
const REQUEST_TIMEOUT_MS = Number(process.env.SMOKE_REQUEST_TIMEOUT_MS || 15_000);
const DEMO_RIDE_ID = "demo-ride-1";

let child = null;
const ownsServer = !process.env.API_BASE_URL;
const baseUrl = (process.env.API_BASE_URL || `http://127.0.0.1:${DEFAULT_PORT}`).replace(/\/$/, "");
const results = [];

main().catch(async (error) => {
  console.error(`\nSmoke pages failed: ${error.message}`);
  if (error.cause) console.error(error.cause);
  await stopServer();
  process.exit(1);
});

async function main() {
  if (ownsServer) await startServer();

  await step("seed demo data", async () => {
    const body = await requestJson("/api/seed/demo", { method: "POST" });
    assert(body.rideId === DEMO_RIDE_ID, "seed returns demo ride id");
    assert(body.eventCount >= 1, "seed returns demo events");
  });

  await step("home page", async () => {
    const html = await requestText("/");
    assertHtmlPage(html, "/");
    assertIncludesAny(html, ["guardian road", "Bring a sensor online"], "home page has Guardian Road copy");
  });

  await step("capture page", async () => {
    const html = await requestText("/capture");
    assertHtmlPage(html, "/capture");
    assertIncludesAny(html, ["Sensor console", "Capture hazard", "guardian road · capture"], "capture page has sensor console markers");
  });

  await step("records page", async () => {
    const html = await requestText("/records");
    assertHtmlPage(html, "/records");
    assertIncludesAny(html, ["Records", "danger", "report"], "records page has records/report markers");
  });

  await step("demo replay page", async () => {
    const html = await requestText(`/replay/${DEMO_RIDE_ID}`);
    assertHtmlPage(html, `/replay/${DEMO_RIDE_ID}`);
    assertIncludesAny(html, ["guardian road replay", "route / event timeline", "GET /api/replay"], "replay page has replay markers");
  });

  console.log("\nSmoke pages passed.");
  for (const result of results) console.log(`- ${result}`);
  await stopServer();
}

async function startServer() {
  const nextBin = "node_modules/next/dist/bin/next";
  const canUseBuiltServer = process.env.SMOKE_SERVER_MODE !== "dev" && existsSync(".next/BUILD_ID");
  const serverArgs = canUseBuiltServer
    ? [nextBin, "start", "--hostname", "127.0.0.1", "--port", String(DEFAULT_PORT)]
    : [nextBin, "dev", "--hostname", "127.0.0.1", "--port", String(DEFAULT_PORT)];

  console.log(`Starting local Next ${canUseBuiltServer ? "production" : "dev"} server on ${baseUrl}`);
  child = spawn(process.execPath, serverArgs, {
    cwd: process.cwd(),
    env: { ...process.env },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => process.stdout.write(prefixServerLog(chunk)));
  child.stderr.on("data", (chunk) => process.stderr.write(prefixServerLog(chunk)));
  child.on("exit", (code, signal) => {
    if (code !== null && code !== 0) console.error(`Next server exited with code ${code}`);
    if (signal) console.error(`Next server exited with signal ${signal}`);
  });

  const deadline = Date.now() + START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/health/readiness`, { signal: AbortSignal.timeout(2_000) });
      if ([200, 503].includes(response.status)) return;
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
  await fn();
  results.push(name);
  console.log("ok");
}

async function requestJson(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method || "GET",
    headers: options.body ? { "content-type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch (error) {
    throw new Error(`${path} returned non-JSON body: ${text.slice(0, 300)}`, { cause: error });
  }
  if (!response.ok) throw new Error(`${path} returned ${response.status}: ${JSON.stringify(body).slice(0, 500)}`);
  return body;
}

async function requestText(path) {
  const response = await fetch(`${baseUrl}${path}`, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  const text = await response.text();
  if (!response.ok) throw new Error(`${path} returned ${response.status}: ${text.slice(0, 500)}`);
  return text;
}

function assertHtmlPage(html, label) {
  assert(/<!DOCTYPE html>|<html/i.test(html), `${label} returns an HTML document`);
  assert(!html.includes("Replay data did not load."), `${label} does not render replay error state`);
  assert(!html.includes("Application error"), `${label} does not render app error`);
}

function assertIncludesAny(text, needles, message) {
  const haystack = text.toLowerCase();
  assert(needles.some((needle) => haystack.includes(String(needle).toLowerCase())), message);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
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
