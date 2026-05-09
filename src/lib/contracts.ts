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

export const HAZARD_TYPES = [
  "close_pass",
  "vehicle_approach",
  "pedestrian_conflict",
  "pothole",
  "road_obstruction",
  "blocked_bike_lane",
  "door_zone",
  "hard_brake",
  "intersection_conflict",
] as const satisfies readonly HazardType[];

export const ACTOR_TYPES = ["rider", "car", "truck", "bus", "bike", "scooter", "pedestrian", "cone", "obstacle"] as const satisfies readonly ActorType[];
export const VEHICLE_ACTOR_TYPES = ["car", "truck", "bus"] as const satisfies readonly ActorType[];
export const VULNERABLE_ACTOR_TYPES = ["pedestrian", "bike", "scooter"] as const satisfies readonly ActorType[];
export const RIDE_MODES = ["bike", "scooter", "car"] as const satisfies readonly RideMode[];
export const CAMERA_ROLES = ["front", "rear", "dashcam"] as const satisfies readonly CameraRole[];

export const PROVIDER_NAMES = {
  gemini: "gemini",
  perception: "perception",
  stub: "stub",
  claude: "claude",
  elevenLabs: "elevenlabs",
  deterministicScenarioLab: "deterministic-scenario-lab",
} as const;

export const FRAME_ANALYSIS_PROVIDERS = [PROVIDER_NAMES.gemini, PROVIDER_NAMES.perception, PROVIDER_NAMES.stub] as const;

export const SEVERITY_MIN = 0;
export const SEVERITY_MAX = 100;
export const RISK_SCORE_MIN = SEVERITY_MIN;
export const RISK_SCORE_MAX = SEVERITY_MAX;
export const CONFIDENCE_MIN = 0;
export const CONFIDENCE_MAX = 1;

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

export type AppendRideRouteRequest = RoutePoint | RoutePoint[] | { point?: RoutePoint; points?: RoutePoint[] };

export type AppendRideRouteResponse = {
  ride: Ride;
  appended: number;
  persisted: "memory" | "mongodb";
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
> &
  Partial<Pick<HazardEvent, "rideId">>;

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

export type ProviderStatusResponse = {
  status: "ready" | "degraded";
  generatedAt: string;
  providers: {
    mongodb: {
      configured: boolean;
      available: boolean;
      mode: "mongodb" | "memory" | "memory-fallback";
      check: "ping" | "failed-ping" | "not-configured";
      error?: string;
    };
    gemini: {
      configured: boolean;
      available: boolean;
      check: "configuration";
      fallback: "stub";
    };
    claude: {
      configured: boolean;
      available: boolean;
      check: "configuration";
      fallback: "stub";
    };
    elevenLabs: {
      configured: boolean;
      available: boolean;
      check: "configuration";
      fallback: "native-tts";
    };
    uploadStorage: {
      configured: boolean;
      available: boolean;
      writable: boolean;
      relativePath: string;
      check: "write-probe";
      error?: string;
    };
    localFallback: {
      configured: true;
      available: true;
      persistence: "memory";
      frameAnalysis: "stub";
      reports: "stub";
      voice: "native-tts";
      scenarios: "deterministic-scenario-lab";
    };
  };
};

export type ReadinessResponse = {
  status: "ready" | "degraded";
  generatedAt: string;
  integrations: {
    mongo: {
      configured: boolean;
      connected: boolean;
      mode: "mongodb" | "memory" | "memory-fallback";
      error?: string;
    };
    gemini: { configured: boolean };
    anthropic: { configured: boolean };
    elevenLabs: { configured: boolean };
    uploads: {
      configured: boolean;
      writable: boolean;
      relativePath: string;
      error?: string;
    };
  };
  data: {
    source: "mongodb" | "memory";
    rides: number;
    events: number;
    dangerSegments: number;
    demoRide: {
      id: string;
      present: boolean;
      eventCount: number;
    };
  };
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
