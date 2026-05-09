import type { DangerSegment, HazardEvent, HazardType } from "@/lib/contracts";

const CLUSTER_RADIUS_M = 180;
const MAX_CLUSTER_SPAN_M = 260;
const SEEDED_SEGMENT_MATCH_RADIUS_M = 180;

type RiskFamily = "vehicle-clearance" | "intersection-conflict" | "surface-obstruction";

type SeededSegmentTemplate = {
  id: string;
  label: string;
  family: RiskFamily;
  centerLat: number;
  centerLng: number;
  topTypes: HazardType[];
};

type EventCluster = {
  family: RiskFamily;
  events: HazardEvent[];
  centerLat: number;
  centerLng: number;
};

const familyLabels: Record<RiskFamily, string> = {
  "vehicle-clearance": "Vehicle clearance",
  "intersection-conflict": "Intersection conflict",
  "surface-obstruction": "Surface obstruction",
};

const hazardLabels: Record<HazardType, string> = {
  close_pass: "close pass",
  vehicle_approach: "vehicle approach",
  pedestrian_conflict: "pedestrian conflict",
  pothole: "pothole",
  road_obstruction: "road obstruction",
  blocked_bike_lane: "blocked bike lane",
  door_zone: "door zone",
  hard_brake: "hard brake",
  intersection_conflict: "intersection conflict",
};

const seededSegmentTemplates: SeededSegmentTemplate[] = [
  {
    id: "seg-russell-olive",
    label: "Russell Blvd approach near Olive Dr",
    family: "vehicle-clearance",
    centerLat: 38.54501,
    centerLng: -121.73875,
    topTypes: ["close_pass", "blocked_bike_lane", "door_zone"],
  },
  {
    id: "seg-anderson-crossing",
    label: "Anderson Rd intersection crossing",
    family: "intersection-conflict",
    centerLat: 38.54455,
    centerLng: -121.73591,
    topTypes: ["intersection_conflict", "pedestrian_conflict"],
  },
  {
    id: "seg-third-pavement",
    label: "3rd St pavement break",
    family: "surface-obstruction",
    centerLat: 38.54491,
    centerLng: -121.73678,
    topTypes: ["pothole"],
  },
];

export function computeDangerSegments(events: HazardEvent[]): DangerSegment[] {
  if (!events.length) return [];

  const referenceTime = newestTimestamp(events);
  return clusterEvents(events).map((cluster) => buildDangerSegment(cluster, referenceTime)).sort(compareSegments);
}

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const earthRadiusM = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function clusterEvents(events: HazardEvent[]) {
  const clusters: EventCluster[] = [];

  for (const event of [...events].sort(compareEvents)) {
    const family = riskFamily(event.type);
    const candidate = clusters
      .filter((cluster) => cluster.family === family)
      .map((cluster) => ({
        cluster,
        distanceM: haversineMeters(event.lat, event.lng, cluster.centerLat, cluster.centerLng),
      }))
      .filter(({ cluster, distanceM }) => distanceM <= CLUSTER_RADIUS_M && wouldFitCluster(event, cluster))
      .sort((a, b) => a.distanceM - b.distanceM || compareEvents(a.cluster.events[0], b.cluster.events[0]))[0]?.cluster;

    if (candidate) {
      candidate.events.push(event);
      candidate.centerLat = average(candidate.events.map((item) => item.lat));
      candidate.centerLng = average(candidate.events.map((item) => item.lng));
    } else {
      clusters.push({
        family,
        events: [event],
        centerLat: event.lat,
        centerLng: event.lng,
      });
    }
  }

  return clusters;
}

function wouldFitCluster(event: HazardEvent, cluster: EventCluster) {
  return cluster.events.every(
    (clusterEvent) => haversineMeters(event.lat, event.lng, clusterEvent.lat, clusterEvent.lng) <= MAX_CLUSTER_SPAN_M,
  );
}

function buildDangerSegment(cluster: EventCluster, referenceTime: number): DangerSegment {
  const events = [...cluster.events].sort(compareEvents);
  const typeCounts = countTypes(events);
  const topTypes = [...typeCounts.entries()]
    .sort(([typeA, countA], [typeB, countB]) => countB - countA || maxSeverity(events, typeB) - maxSeverity(events, typeA) || typeA.localeCompare(typeB))
    .slice(0, 3)
    .map(([type]) => type);
  const lastSeen = events.reduce((latest, event) => (timestampMs(event.timestamp) > timestampMs(latest) ? event.timestamp : latest), events[0].timestamp);
  const avgSeverity = average(events.map((event) => event.severity));
  const eventCountBonus = Math.min(100, events.length * 12);
  const lastSeenAgeMs = Math.max(0, referenceTime - timestampMs(lastSeen));
  const recentBonus = lastSeenAgeMs <= 60 * 60 * 1000 ? 100 : lastSeenAgeMs <= 24 * 60 * 60 * 1000 ? 60 : 20;
  const topTypeCount = Math.max(...typeCounts.values());
  const repeatTypeBonus = topTypeCount >= 3 ? 100 : 40;
  const score = Math.round(avgSeverity * 0.45 + eventCountBonus * 0.25 + recentBonus * 0.15 + repeatTypeBonus * 0.15);

  const centerLat = roundCoordinate(cluster.centerLat);
  const centerLng = roundCoordinate(cluster.centerLng);
  const seededTemplate = matchSeededTemplate(cluster.family, topTypes, centerLat, centerLng);

  return {
    id: seededTemplate?.id ?? segmentId(cluster.family, cluster.centerLat, cluster.centerLng),
    label: seededTemplate?.label ?? `${familyLabels[cluster.family]} cluster near ${cluster.centerLat.toFixed(5)}, ${cluster.centerLng.toFixed(5)}`,
    centerLat,
    centerLng,
    score: clamp(score, 0, 100),
    eventCount: events.length,
    topTypes,
    lastSeen,
    explanation: segmentExplanation(cluster.family, topTypes, events.length, Math.round(avgSeverity)),
  };
}

export function resolveDangerSegment(segments: DangerSegment[], segmentId: string) {
  const exact = segments.find((segment) => segment.id === segmentId);
  if (exact) return exact;

  const template = seededSegmentTemplates.find((item) => item.id === segmentId);
  if (!template) return undefined;

  const candidate = segments
    .map((segment) => ({
      segment,
      distanceM: haversineMeters(segment.centerLat, segment.centerLng, template.centerLat, template.centerLng),
      typeOverlap: countTypeOverlap(segment.topTypes, template.topTypes),
      labelMatch: labelsMatch(segment.label, template.label),
    }))
    .filter(
      ({ distanceM, typeOverlap, labelMatch }) =>
        distanceM <= SEEDED_SEGMENT_MATCH_RADIUS_M && (typeOverlap > 0 || labelMatch),
    )
    .sort((a, b) => b.typeOverlap - a.typeOverlap || Number(b.labelMatch) - Number(a.labelMatch) || a.distanceM - b.distanceM)[0]
    ?.segment;

  return candidate ? { ...candidate, id: template.id, label: template.label } : undefined;
}

function countTypes(events: HazardEvent[]) {
  const counts = new Map<HazardType, number>();
  for (const event of events) {
    counts.set(event.type, (counts.get(event.type) ?? 0) + 1);
  }
  return counts;
}

function maxSeverity(events: HazardEvent[], type: HazardType) {
  return events.reduce((max, event) => (event.type === type ? Math.max(max, event.severity) : max), 0);
}

function matchSeededTemplate(family: RiskFamily, topTypes: HazardType[], centerLat: number, centerLng: number) {
  return seededSegmentTemplates
    .map((template) => ({
      template,
      distanceM: haversineMeters(centerLat, centerLng, template.centerLat, template.centerLng),
      typeOverlap: countTypeOverlap(topTypes, template.topTypes),
    }))
    .filter(
      ({ template, distanceM, typeOverlap }) =>
        template.family === family && distanceM <= SEEDED_SEGMENT_MATCH_RADIUS_M && typeOverlap > 0,
    )
    .sort((a, b) => b.typeOverlap - a.typeOverlap || a.distanceM - b.distanceM)[0]?.template;
}

function countTypeOverlap(types: HazardType[], expectedTypes: HazardType[]) {
  const expected = new Set(expectedTypes);
  return types.reduce((count, type) => count + (expected.has(type) ? 1 : 0), 0);
}

function labelsMatch(label: string, expectedLabel: string) {
  const labelTokens = tokenSet(label);
  return [...tokenSet(expectedLabel)].some((token) => labelTokens.has(token));
}

function tokenSet(value: string) {
  return new Set(value.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length >= 5));
}

function segmentExplanation(family: RiskFamily, topTypes: HazardType[], eventCount: number, avgSeverity: number) {
  const types = topTypes.map((type) => hazardLabels[type]).join(", ");
  return `${familyLabels[family]} pattern from ${eventCount} event${eventCount === 1 ? "" : "s"}: ${types}. Average severity ${avgSeverity}/100.`;
}

function riskFamily(type: HazardType): RiskFamily {
  if (type === "intersection_conflict" || type === "pedestrian_conflict" || type === "hard_brake") return "intersection-conflict";
  if (type === "pothole" || type === "road_obstruction") return "surface-obstruction";
  return "vehicle-clearance";
}

function compareEvents(a: HazardEvent, b: HazardEvent) {
  return (
    timestampMs(a.timestamp) - timestampMs(b.timestamp) ||
    a.rideId.localeCompare(b.rideId) ||
    a.t - b.t ||
    a.id.localeCompare(b.id) ||
    a.lat - b.lat ||
    a.lng - b.lng
  );
}

function compareSegments(a: DangerSegment, b: DangerSegment) {
  return b.score - a.score || b.eventCount - a.eventCount || b.lastSeen.localeCompare(a.lastSeen) || a.id.localeCompare(b.id);
}

function newestTimestamp(events: HazardEvent[]) {
  return events.reduce((latest, event) => Math.max(latest, timestampMs(event.timestamp)), 0);
}

function timestampMs(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function segmentId(family: RiskFamily, lat: number, lng: number) {
  return `seg-${family}-${coordToken(lat, "n", "s")}-${coordToken(lng, "e", "w")}`;
}

function coordToken(value: number, positivePrefix: string, negativePrefix: string) {
  return `${value >= 0 ? positivePrefix : negativePrefix}${Math.abs(Math.round(value * 100000))}`;
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundCoordinate(value: number) {
  return Math.round(value * 1000000) / 1000000;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
