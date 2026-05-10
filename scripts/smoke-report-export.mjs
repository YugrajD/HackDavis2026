const baseUrl = (process.env.GUARDIAN_ROAD_BASE_URL ?? process.env.API_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const segmentId = process.env.GUARDIAN_ROAD_SEGMENT_ID ?? "seg-russell-olive";

async function requestJson(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(`${init.method ?? "GET"} ${path} failed with ${response.status}: ${text}`);
  }

  return payload;
}

const smokeEvent = {
  id: "evt-smoke-segment-recompute",
  rideId: "demo-ride-1",
  t: 196,
  timestamp: "2026-05-09T16:23:16.000Z",
  type: "vehicle_approach",
  severity: 71,
  confidence: 0.86,
  lat: 38.545,
  lng: -121.7379,
  headingDeg: 92,
  speedMps: 5.1,
  camera: "rear",
  spokenAlert: "Vehicle approaching from behind.",
  explanation: "Smoke test event near the seeded Russell/Olive corridor to force danger segment recomputation.",
  objects: [],
};

try {
  await requestJson("/api/seed/demo", { method: "POST", body: "{}" });
  await requestJson("/api/events", { method: "POST", body: JSON.stringify(smokeEvent) });

  const reportPayload = await requestJson("/api/ai/report", {
    method: "POST",
    body: JSON.stringify({ segmentId }),
  });

  if (reportPayload.report?.segmentId !== segmentId) {
    throw new Error(`Report resolved ${reportPayload.report?.segmentId ?? "<missing>"}, expected ${segmentId}`);
  }

  const exportPayload = await requestJson("/api/reports/export", {
    method: "POST",
    body: JSON.stringify({ segmentId, format: "pdf-text" }),
  });

  if (exportPayload.segment?.id !== segmentId || exportPayload.report?.segmentId !== segmentId) {
    throw new Error(
      `Export resolved segment ${exportPayload.segment?.id ?? "<missing>"} and report ${exportPayload.report?.segmentId ?? "<missing>"}, expected ${segmentId}`,
    );
  }

  if (exportPayload.exportUrl !== `/generated/reports/${exportPayload.filename}`) {
    throw new Error(`Export URL ${exportPayload.exportUrl ?? "<missing>"} did not match filename ${exportPayload.filename ?? "<missing>"}`);
  }

  console.log(
    `Smoke passed: ${segmentId} report/export resolved after recompute (${exportPayload.events?.length ?? 0} events, ${exportPayload.filename}, ${exportPayload.exportUrl}).`,
  );
} finally {
  try {
    await requestJson("/api/seed/demo", { method: "POST", body: "{}" });
  } catch (error) {
    console.warn(`Cleanup seed reset failed: ${error.message}`);
  }
}
