import type { HazardEvent } from "@/lib/contracts";

export function sortEventsNewestFirst(events: HazardEvent[]) {
  return [...events].sort(compareEventsNewestFirst);
}

export function sortEventsForTimeline(events: HazardEvent[]) {
  return [...events].sort(compareEventsForTimeline);
}

function compareEventsNewestFirst(a: HazardEvent, b: HazardEvent) {
  return eventTimeMs(b) - eventTimeMs(a) || b.t - a.t || a.id.localeCompare(b.id);
}

function compareEventsForTimeline(a: HazardEvent, b: HazardEvent) {
  return a.t - b.t || eventTimeMs(a) - eventTimeMs(b) || a.id.localeCompare(b.id);
}

function eventTimeMs(event: HazardEvent) {
  const value = Date.parse(event.timestamp);
  return Number.isFinite(value) ? value : 0;
}
