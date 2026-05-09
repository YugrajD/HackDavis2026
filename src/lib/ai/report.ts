import type { DangerSegment, HazardEvent } from "@/lib/contracts";

export type SafetyReport = {
  title: string;
  summary: string;
  evidence: string[];
  recommendedFixes: string[];
};

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
