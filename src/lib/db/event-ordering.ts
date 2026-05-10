import type { HazardEvent } from "@/lib/contracts";

export type EventSortOrder = "newest" | "timeline";

export function sortEvents(events: HazardEvent[], order: EventSortOrder = "newest") {
  return [...events].sort(order === "timeline" ? compareEventsForTimeline : compareEventsNewestFirst);
}

export function sortEventsNewestFirst(events: HazardEvent[]) {
  return sortEvents(events, "newest");
}

export function sortEventsForTimeline(events: HazardEvent[]) {
  return sortEvents(events, "timeline");
}

export function mongoEventSort(order: EventSortOrder = "newest") {
  return order === "timeline" ? ({ t: 1, timestamp: 1, id: 1 } as const) : ({ timestamp: -1, t: -1, id: 1 } as const);
}

export function compareEventsNewestFirst(a: HazardEvent, b: HazardEvent) {
  return eventTimeMs(b) - eventTimeMs(a) || b.t - a.t || a.id.localeCompare(b.id);
}

export function compareEventsForTimeline(a: HazardEvent, b: HazardEvent) {
  return a.t - b.t || eventTimeMs(a) - eventTimeMs(b) || a.id.localeCompare(b.id);
}

export function eventTimeMs(event: HazardEvent) {
  const value = Date.parse(event.timestamp);
  return Number.isFinite(value) ? value : 0;
}
