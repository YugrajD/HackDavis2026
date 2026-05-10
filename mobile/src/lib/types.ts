export type RideMode = "bike" | "car";

export type HazardType =
  | "close_pass"
  | "vehicle_approach"
  | "pedestrian_conflict"
  | "blocked_bike_lane"
  | "door_zone"
  | "intersection_conflict";

export type DetectionBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type Detection = {
  id: string;
  label: "person" | "bicycle" | "car" | "motorcycle" | "bus" | "truck";
  confidence: number;
  bbox: DetectionBox;
  distanceM: number;
  ttcSec?: number;
};

export type MobileHazard = {
  id: string;
  type: HazardType;
  severity: number;
  confidence: number;
  spokenAlert: string;
  explanation: string;
  detection: Detection;
  createdAt: number;
};
