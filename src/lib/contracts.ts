export type HazardType =
  | "close_pass"
  | "vehicle_approach"
  | "pedestrian_conflict"
  | "pothole"
  | "road_obstruction"
  | "blocked_bike_lane"
  | "door_zone"
  | "hard_brake"
  | "intersection_conflict";

export type ActorType =
  | "rider"
  | "car"
  | "truck"
  | "bus"
  | "bike"
  | "scooter"
  | "pedestrian"
  | "cone"
  | "obstacle";

export type RideMode = "bike" | "scooter" | "car";
export type CameraRole = "front" | "rear" | "dashcam";

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

export type TrackedObject = {
  id: string;
  type: ActorType;
  confidence: number;
  bbox?: [number, number, number, number];
  position?: { x: number; y: number; z: number };
  velocity?: { x: number; y: number; z: number };
  distanceM?: number;
  ttcSec?: number;
};

export type RelativeLocation = "ahead" | "behind" | "left" | "right" | "center" | "unknown";

export type FrameDetection = {
  id?: string;
  label: string;
  description?: string;
  confidence: number;
  bbox?: [number, number, number, number];
  depthM?: number;
  relativeLocation?: RelativeLocation;
};

export type FrameObservation = {
  frameId: string;
  capturedAt: string;
  camera: CameraRole;
  lat?: number;
  lng?: number;
  speedMps?: number;
  headingDeg?: number;
  width?: number;
  height?: number;
  detections: FrameDetection[];
};

export type TrackState = TrackedObject & {
  label?: string;
  description?: string;
  relativeLocation?: RelativeLocation;
  riskScore: number;
  lastFrameId: string;
  lastSeenAt: string;
};

export type PerceptionRisk = {
  type: HazardType;
  severity: number;
  confidence: number;
  spokenAlert: string;
  explanation: string;
  primaryObjectId?: string;
  reasons: string[];
};

export type HazardEventDraft = Pick<
  HazardEvent,
  "type" | "severity" | "confidence" | "spokenAlert" | "explanation" | "objects" | "camera" | "lat" | "lng" | "headingDeg" | "speedMps" | "timestamp" | "t"
>;

export type PerceptionResult = {
  frameId: string;
  capturedAt: string;
  workerVersion: "guardian-road-perception-v1";
  tracks: TrackState[];
  risk: PerceptionRisk;
  hazardDraft: HazardEventDraft;
};

export type AnalyzeFrameResponse = Pick<HazardEvent, "type" | "severity" | "confidence" | "spokenAlert" | "explanation" | "objects"> & {
  provider: "gemini" | "perception" | "stub";
  perception?: PerceptionResult;
  note?: string;
};

export type AnalyzeAndSaveMediaResponse = {
  event: HazardEvent;
  persisted: "memory" | "mongodb";
  provider: "gemini" | "perception" | "stub";
  perception?: PerceptionResult;
  message: string;
};

export type HazardEvent = {
  id: string;
  rideId: string;
  t: number;
  timestamp: string;
  type: HazardType;
  severity: number;
  confidence: number;
  lat: number;
  lng: number;
  headingDeg: number;
  speedMps: number;
  camera: CameraRole;
  spokenAlert: string;
  explanation: string;
  clipUrl?: string;
  thumbnailUrl?: string;
  objects: TrackedObject[];
};

export type DangerSegment = {
  id: string;
  label: string;
  centerLat: number;
  centerLng: number;
  score: number;
  eventCount: number;
  topTypes: HazardType[];
  lastSeen: string;
  explanation: string;
};

export type UploadedMedia = {
  kind: "thumbnail" | "clip";
  url: string;
  bytes: number;
  contentType: string;
};

export type MediaUploadResponse = {
  clipUrl?: string;
  thumbnailUrl?: string;
  stored: UploadedMedia[];
  persisted: "public/generated" | "data/uploads";
};

export type ReplayPayload = {
  ride: Ride;
  events: HazardEvent[];
  dangerSegments: DangerSegment[];
  generatedAt: string;
};

export type ScenarioPrompt = {
  prompt?: string;
  prompts?: string[];
  mode?: RideMode;
  camera?: CameraRole;
  lat?: number;
  lng?: number;
  seed?: number;
};

export type ScenarioTimelineItem = Pick<
  HazardEvent,
  "t" | "timestamp" | "type" | "severity" | "confidence" | "lat" | "lng" | "spokenAlert" | "explanation" | "headingDeg" | "speedMps" | "objects"
>;

export type RoadScenario = {
  id: string;
  title: string;
  prompt: string;
  seed: number;
  mode: RideMode;
  camera: CameraRole;
  origin: { lat: number; lng: number };
  route: RoutePoint[];
  timeline: ScenarioTimelineItem[];
  reconstructionHints: {
    splatPrompt: string;
    cameraPath: Array<{ t: number; x: number; y: number; z: number; yawDeg: number }>;
    riskZones: Array<{ t: number; radiusM: number; color: "amber" | "red" }>;
  };
  generatedAt: string;
};

export type ScenarioResponse = {
  scenario: RoadScenario;
  hazardDraft: HazardEventDraft & { rideId: string };
  replayPayload: ReplayPayload;
  provider: "deterministic-scenario-lab";
};

export type SafetyReport = {
  title: string;
  summary: string;
  evidence: string[];
  recommendedFixes: string[];
  generatedAt: string;
  segmentId: string;
  eventIds: string[];
};

export type ReportExportFormat = "markdown" | "html" | "csv" | "pdf-text";

export type ReportExportPayload = {
  report: SafetyReport;
  segment: DangerSegment;
  format: ReportExportFormat;
  document: string;
  filename: string;
  contentType: string;
  generatedAt: string;
  events: Array<Pick<HazardEvent, "id" | "timestamp" | "type" | "severity" | "lat" | "lng" | "camera" | "explanation">>;
};
