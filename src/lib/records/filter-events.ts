import type { CameraRole, HazardEvent, HazardType, RideMode } from "@/lib/contracts";

export type EventFiltersState = {
  type: HazardType | "all";
  camera: CameraRole | "all";
  mode: RideMode | "all";
  minSeverity: number;
  query: string;
};

export const DEFAULT_EVENT_FILTERS: EventFiltersState = {
  type: "all",
  camera: "all",
  mode: "all",
  minSeverity: 0,
  query: "",
};

export function filterEvents(events: HazardEvent[], filters: EventFiltersState, rideMode?: RideMode) {
  const query = filters.query.trim().toLowerCase();

  return events.filter((event) => {
    if (filters.type !== "all" && event.type !== filters.type) return false;
    if (filters.camera !== "all" && event.camera !== filters.camera) return false;
    if (filters.mode !== "all" && rideMode !== filters.mode) return false;
    if (event.severity < filters.minSeverity) return false;

    if (!query) return true;

    const haystack = [event.id, event.rideId, event.type, event.camera, event.spokenAlert, event.explanation]
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });
}
