import type { CameraRole, FrameObservation, PerceptionResult, FrameDetection } from "@/lib/contracts";
import { analyzeFrameObservation } from "@/lib/perception/frame-pipeline";

export function buildPerceptionFromYoloDetections(options: {
  detections: FrameDetection[];
  width: number;
  height: number;
  camera: CameraRole;
  lat?: number;
  lng?: number;
  speedMps?: number;
  headingDeg?: number;
}): PerceptionResult {
  const capturedAt = new Date().toISOString();
  const frameId = `yolo-${Date.now()}`;
  const observation: FrameObservation = {
    frameId,
    capturedAt,
    camera: options.camera,
    lat: options.lat,
    lng: options.lng,
    speedMps: options.speedMps,
    headingDeg: options.headingDeg,
    width: options.width > 0 ? options.width : undefined,
    height: options.height > 0 ? options.height : undefined,
    detections: options.detections,
  };
  return analyzeFrameObservation(observation);
}
