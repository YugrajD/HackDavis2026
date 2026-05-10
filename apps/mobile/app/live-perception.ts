/** Client-side helpers for live monitor HUD (server still runs YOLO). */

export type FrameDetection = {
  id?: string;
  label: string;
  description?: string;
  confidence: number;
  bbox?: [number, number, number, number];
};

const VEHICLE_LABELS = new Set(["car", "truck", "bus", "bike", "scooter"]);

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Rough 0–100 score from normalized boxes + labels (no server round-trip).
 * Used only to throttle auto-save and optional TTS hints.
 */
export function scoreDetectionsForHud(detections: FrameDetection[]): number {
  let max = 0;
  for (const d of detections) {
    const label = (d.label ?? "").toLowerCase();
    const conf = typeof d.confidence === "number" ? d.confidence : 0;
    const bbox = d.bbox;
    if (!bbox || bbox.length < 4) continue;
    const [x1, y1, x2, y2] = bbox;
    const cx = (x1 + x2) / 2;
    const nearCenter = Math.abs(cx - 0.5) < 0.38;
    const h = Math.max(0, y2 - y1);
    const prominent = h > 0.07;
    let score = conf * 42;
    if (VEHICLE_LABELS.has(label)) score += 28;
    if (label === "pedestrian") score += 22;
    if (label === "obstacle") score += 12;
    if (nearCenter) score += 18;
    if (prominent) score += 14;
    max = Math.max(max, Math.round(clamp(score, 0, 100)));
  }
  return max;
}

export function spokenHintForTopDetection(detections: FrameDetection[]): string {
  if (detections.length === 0) return "Path looks clear.";
  const sorted = [...detections].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
  const top = sorted[0];
  const label = (top.label ?? "object").toLowerCase();
  if (VEHICLE_LABELS.has(label)) return "Vehicle in view.";
  if (label === "pedestrian") return "Pedestrian ahead.";
  if (label === "bike") return "Bike ahead.";
  if (label === "obstacle") return "Obstacle ahead.";
  return "Check path.";
}
