/**
 * Smoke: POST /api/perception/detect with a tiny JPEG.
 * - 503 + `note` when `YOLO_SERVICE_URL` unset (expected in CI) → exit 0
 * - 200 + `detections` when sidecar is up
 *
 *   API_BASE_URL=http://localhost:3000 node scripts/smoke-yolo-detect.mjs
 */

import { Buffer } from "node:buffer";

const base = (process.env.API_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

// Smallest stable test image (valid JPEG header payload; YOLO may return 0 boxes)
const tinyJpeg = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wgARCAAKAAoDAREAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k=",
  "base64",
);

async function main() {
  const imageBase64 = `data:image/jpeg;base64,${tinyJpeg.toString("base64")}`;
  const res = await fetch(`${base}/api/perception/detect`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ imageBase64 }),
  });
  const body = await res.json();
  console.log(res.status, JSON.stringify(body, null, 2));

  if (res.status === 503 && typeof body.note === "string") {
    console.log("smoke-yolo-detect: route reachable; YOLO sidecar not configured (expected without YOLO_SERVICE_URL).");
    process.exit(0);
  }
  if (res.ok && Array.isArray(body.detections)) {
    process.exit(0);
  }
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
