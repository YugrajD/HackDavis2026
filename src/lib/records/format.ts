import type { DangerSegment, HazardEvent } from "@/lib/contracts";

export type RiskTone = "low" | "medium" | "high" | "critical";

export function riskTone(score: number): RiskTone {
  if (score >= 90) return "critical";
  if (score >= 75) return "high";
  if (score >= 50) return "medium";
  return "low";
}

export function riskLabel(score: number) {
  const tone = riskTone(score);
  return `${tone.toUpperCase()} ${Math.round(score)}`;
}

export function hazardLabel(type: string) {
  return type
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function formatConfidence(confidence: number) {
  return `${Math.round(confidence * 100)}%`;
}

export function formatSpeed(speedMps: number) {
  return `${(speedMps * 2.23694).toFixed(1)} mph`;
}

export function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

export function formatLatLng(lat: number, lng: number) {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

export function eventTelemetry(event: HazardEvent) {
  return [
    `GPS ${formatLatLng(event.lat, event.lng)}`,
    `HDG ${Math.round(event.headingDeg)}°`,
    `SPD ${formatSpeed(event.speedMps)}`,
    `T+${event.t.toFixed(1)}s`,
  ];
}

export function segmentTelemetry(segment: DangerSegment) {
  return [
    `CENTER ${formatLatLng(segment.centerLat, segment.centerLng)}`,
    `EVENTS ${segment.eventCount}`,
    `LAST ${formatTime(segment.lastSeen)}`,
  ];
}
