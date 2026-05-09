/**
 * Smoke: POST /api/perception/detect with a tiny JPEG.
 * - no reachable Next server → skip with exit 0
 * - 503 + `note` when `YOLO_SERVICE_URL` unset → skip with exit 0
 * - 200 + `detections` when sidecar is up
 *
 *   API_BASE_URL=http://localhost:3000 node scripts/smoke-yolo-detect.mjs
 */

import { Buffer } from "node:buffer";

const base = (process.env.API_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const detectUrl = `${base}/api/perception/detect`;

// Smallest stable test image (valid JPEG header payload; YOLO may return 0 boxes)
const tinyJpeg = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wgARCAAKAAoDAREAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k=",
  "base64",
);

function skip(note) {
  console.log(`smoke-yolo-detect: skip: ${note}`);
  process.exit(0);
}

function fail(note) {
  console.error(`smoke-yolo-detect: fail: ${note}`);
  process.exit(1);
}

async function main() {
  const imageBase64 = `data:image/jpeg;base64,${tinyJpeg.toString("base64")}`;
  let res;

  try {
    res = await fetch(detectUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ imageBase64 }),
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    skip(`Next server is not reachable at ${base}. Start it with \`npm run dev\` or set API_BASE_URL to a running server.`);
  }

  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    console.log(res.status, text);
    fail(`${detectUrl} returned non-JSON.`);
  }

  console.log(res.status, JSON.stringify(body, null, 2));

  if (res.status === 503 && typeof body.note === "string" && body.note.includes("YOLO_SERVICE_URL")) {
    skip(`route reachable; ${body.note}`);
  }
  if (res.ok && Array.isArray(body.detections)) {
    process.exit(0);
  }
  fail(`${detectUrl} did not return detections or the expected YOLO_SERVICE_URL skip note.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
