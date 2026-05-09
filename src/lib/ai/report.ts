import Anthropic from "@anthropic-ai/sdk";
import type { DangerSegment, HazardEvent, SafetyReport } from "@/lib/contracts";

export function generateSafetyReport(segment: DangerSegment, events: HazardEvent[]): SafetyReport {
  const topType = segment.topTypes[0]?.replaceAll("_", " ") ?? "road hazard";
  const severeEvents = events.filter((event) => event.severity >= 75);

  return {
    title: `${segment.label} safety report`,
    summary: `${segment.label} is scoring ${segment.score}/100 because repeated ${topType} events were detected near the same corridor. The current evidence suggests a street-design or visibility problem rather than a one-off rider error.`,
    evidence: [
      `${segment.eventCount} related hazard event${segment.eventCount === 1 ? "" : "s"} linked to this segment.`,
      `${severeEvents.length} event${severeEvents.length === 1 ? "" : "s"} at severity 75 or higher.`,
      `Most common hazard types: ${segment.topTypes.map((type) => type.replaceAll("_", " ")).join(", ")}.`,
      `Most recent observation: ${new Date(segment.lastSeen).toLocaleString()}.`,
    ],
    recommendedFixes: recommendedFixesFor(segment),
    generatedAt: deterministicReportTimestamp(segment, events),
    segmentId: segment.id,
    eventIds: events.map((event) => event.id),
  };
}

export async function generateSafetyReportWithClaude(segment: DangerSegment, events: HazardEvent[]): Promise<SafetyReport | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return null;

  const anthropic = new Anthropic({ apiKey });
  const message = await anthropic.messages.create({
    model: process.env.ANTHROPIC_MODEL?.trim() || "claude-3-5-sonnet-latest",
    max_tokens: 900,
    temperature: 0.2,
    system:
      "You write concise Vision Zero-style road safety reports from structured hazard events. Return valid JSON only. Do not include markdown.",
    messages: [
      {
        role: "user",
        content: `Create a civic safety report for this Guardian Road danger segment. Return JSON with these keys: title (string), summary (string), evidence (array of strings), recommendedFixes (array of strings). Keep evidence tied to the provided observations. Keep recommended fixes concrete for city staff.

Danger segment:
${JSON.stringify(segment, null, 2)}

Related events:
${JSON.stringify(events.map(compactEvent), null, 2)}`,
      },
    ],
  });

  const text = message.content.map((block) => (block.type === "text" ? block.text : "")).join("\n");
  return normalizeReport(parseJsonObject(text), segment, events);
}

function compactEvent(event: HazardEvent) {
  return {
    id: event.id,
    type: event.type,
    severity: event.severity,
    confidence: event.confidence,
    timestamp: event.timestamp,
    lat: event.lat,
    lng: event.lng,
    camera: event.camera,
    spokenAlert: event.spokenAlert,
    explanation: event.explanation,
    objects: event.objects.map((object) => ({
      type: object.type,
      confidence: object.confidence,
      distanceM: object.distanceM,
      ttcSec: object.ttcSec,
    })),
  };
}

function normalizeReport(value: unknown, segment: DangerSegment, events: HazardEvent[]): SafetyReport {
  const fallback = generateSafetyReport(segment, events);
  if (!isRecord(value)) return fallback;

  return {
    title: toNonEmptyString(value.title, fallback.title).slice(0, 140),
    summary: toNonEmptyString(value.summary, fallback.summary).slice(0, 1200),
    evidence: normalizeStringList(value.evidence, fallback.evidence, 8),
    recommendedFixes: normalizeStringList(value.recommendedFixes, fallback.recommendedFixes, 8),
    generatedAt: fallback.generatedAt,
    segmentId: segment.id,
    eventIds: events.map((event) => event.id),
  };
}

function recommendedFixesFor(segment: DangerSegment) {
  const fixes = new Set<string>();

  for (const type of segment.topTypes) {
    if (type === "close_pass" || type === "vehicle_approach") fixes.add("Add protected separation or traffic calming where riders are exposed to fast overtakes.");
    if (type === "blocked_bike_lane") fixes.add("Improve loading-zone enforcement and keep the bike lane clear during peak travel periods.");
    if (type === "door_zone") fixes.add("Repaint bike guidance outside the parked-car door zone or add parking-buffer markings.");
    if (type === "pothole" || type === "road_obstruction") fixes.add("Prioritize pavement repair and add temporary warning markings until fixed.");
    if (type === "intersection_conflict" || type === "pedestrian_conflict") fixes.add("Improve crossing visibility, signal timing, and turning-speed control at the conflict point.");
  }

  if (fixes.size === 0) fixes.add("Review the segment with city staff using the attached event clips and route traces.");
  return [...fixes];
}

function deterministicReportTimestamp(segment: DangerSegment, events: HazardEvent[]) {
  const latestEventTime = events.map((event) => Date.parse(event.timestamp)).filter(Number.isFinite).sort((a, b) => b - a)[0];
  return new Date(latestEventTime ?? Date.parse(segment.lastSeen)).toISOString();
}

function normalizeStringList(value: unknown, fallback: string[], maxItems: number) {
  if (!Array.isArray(value)) return fallback;
  const list = value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim().slice(0, 280));
  return list.length ? list.slice(0, maxItems) : fallback;
}

function parseJsonObject(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) return null;
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toNonEmptyString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}
