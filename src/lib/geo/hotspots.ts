import { RISK_SCORE_MAX, RISK_SCORE_MIN } from "@/lib/contracts";
import type { DangerSegment, HazardEvent } from "@/lib/contracts";
import { haversineMeters } from "@/lib/geo/danger-segments";

export type HotspotPolygon = {
  id: string;
  label: string;
  score: number;
  eventCount: number;
  center: { lat: number; lng: number };
  radiusM: number;
  polygon: Array<{ lat: number; lng: number }>;
};

export type HotspotGridCell = {
  id: string;
  bbox: { westLng: number; southLat: number; eastLng: number; northLat: number };
  score: number;
  events: HazardEvent[];
};

export function dangerSegmentsToHotspots(segments: DangerSegment[], events: HazardEvent[] = []): HotspotPolygon[] {
  return segments.map((segment) => {
    const related = events.filter((event) => segment.topTypes.includes(event.type) && haversineMeters(event.lat, event.lng, segment.centerLat, segment.centerLng) <= 260);
    const radiusM = clamp(70 + segment.eventCount * 18 + segment.score * 0.9, 90, 320);

    return {
      id: `hotspot-${segment.id}`,
      label: segment.label,
      score: segment.score,
      eventCount: related.length || segment.eventCount,
      center: { lat: segment.centerLat, lng: segment.centerLng },
      radiusM,
      polygon: circlePolygon(segment.centerLat, segment.centerLng, radiusM, 24),
    };
  });
}

export function buildHotspotGrid(events: HazardEvent[], cellSizeM = 140): HotspotGridCell[] {
  if (!events.length) return [];

  const origin = events[0];
  const cells = new Map<string, HazardEvent[]>();
  for (const event of events) {
    const x = lngToMeters(event.lng - origin.lng, origin.lat);
    const y = latToMeters(event.lat - origin.lat);
    const key = `${Math.floor(x / cellSizeM)}:${Math.floor(y / cellSizeM)}`;
    cells.set(key, [...(cells.get(key) ?? []), event]);
  }

  return [...cells.entries()]
    .map(([key, cellEvents]) => {
      const [xIndex, yIndex] = key.split(":").map(Number);
      const westLng = origin.lng + metersToLng(xIndex * cellSizeM, origin.lat);
      const eastLng = origin.lng + metersToLng((xIndex + 1) * cellSizeM, origin.lat);
      const southLat = origin.lat + metersToLat(yIndex * cellSizeM);
      const northLat = origin.lat + metersToLat((yIndex + 1) * cellSizeM);
      const avgSeverity = average(cellEvents.map((event) => event.severity));
      const repeatBonus = Math.min(25, cellEvents.length * 5);

      return {
        id: `grid-${xIndex}-${yIndex}`,
        bbox: { westLng, southLat, eastLng, northLat },
        score: Math.round(clamp(avgSeverity + repeatBonus, RISK_SCORE_MIN, RISK_SCORE_MAX)),
        events: cellEvents,
      };
    })
    .sort((a, b) => b.score - a.score || b.events.length - a.events.length || a.id.localeCompare(b.id));
}

export function hotspotCsv(events: HazardEvent[], hotspots: HotspotPolygon[]) {
  const rows = ["kind,id,label,lat,lng,score,event_count,type,severity,timestamp"];

  for (const hotspot of hotspots) {
    rows.push(["hotspot", hotspot.id, quote(hotspot.label), hotspot.center.lat, hotspot.center.lng, hotspot.score, hotspot.eventCount, "", "", ""].join(","));
  }

  for (const event of events) {
    rows.push(["event", event.id, quote(event.explanation), event.lat, event.lng, "", "", event.type, event.severity, event.timestamp].join(","));
  }

  return `${rows.join("\n")}\n`;
}

function circlePolygon(lat: number, lng: number, radiusM: number, sides: number) {
  return Array.from({ length: sides }, (_, index) => {
    const angle = (index / sides) * Math.PI * 2;
    const dx = Math.cos(angle) * radiusM;
    const dy = Math.sin(angle) * radiusM;
    return { lat: lat + metersToLat(dy), lng: lng + metersToLng(dx, lat) };
  });
}

function latToMeters(deltaLat: number) {
  return deltaLat * 111_320;
}

function lngToMeters(deltaLng: number, atLat: number) {
  return deltaLng * 111_320 * Math.cos((atLat * Math.PI) / 180);
}

function metersToLat(meters: number) {
  return meters / 111_320;
}

function metersToLng(meters: number, atLat: number) {
  return meters / (111_320 * Math.cos((atLat * Math.PI) / 180));
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function quote(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
