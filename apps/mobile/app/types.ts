/** Minimal mirrors of server types for the mobile client. */

export type RideMode = "bike" | "scooter" | "car";

export type RoutePoint = {
  t: number;
  lat: number;
  lng: number;
  speedMps: number;
  headingDeg: number;
};

export type Ride = {
  id: string;
  mode: RideMode;
  startedAt: string;
  endedAt?: string;
  startLat: number;
  startLng: number;
  route: RoutePoint[];
  stats: {
    durationSec: number;
    distanceMeters: number;
    maxRisk: number;
    eventCount: number;
  };
};

export type CreateRideResponse = {
  ride: Ride;
  persisted: string;
};

export type AppendRideRouteResponse = {
  ride: Ride;
  appended: number;
  persisted: string;
};

export type EndRideResponse = {
  ride: Ride;
};

export type MediaUploadResponse = {
  clipUrl?: string;
  thumbnailUrl?: string;
  stored: Array<{ kind: string; url: string; bytes: number; contentType: string }>;
  persisted: string;
};
