import type { Detection } from "../lib/types";
import { COCO_LABELS } from "./labels";

const RELEVANT_LABELS = new Set<Detection["label"]>([
  "person", "bicycle", "car", "motorcycle", "bus", "truck",
]);
const CONF_THRESHOLD = 0.38;
const MAX_DETECTIONS = 10;

// Rough distance estimate from normalized bounding-box height.
// A person filling ~0.6 of frame height ≈ 1 m; ~0.1 ≈ 7 m.
function estimateDistanceM(bboxHeight: number): number {
  return Math.max(0.5, Math.min(20, 0.6 / (bboxHeight + 0.04)));
}

/**
 * Converts raw COCO SSD output arrays (already copied out of worklet) to
 * typed Detection objects the rest of the app understands.
 *
 * COCO SSD output layout:
 *   boxes   – flat Float32, [count × 4]: ymin, xmin, ymax, xmax (normalized 0-1)
 *   classes – flat Float32, [count]: 0-indexed class IDs (0 = person)
 *   scores  – flat Float32, [count]: confidence 0-1
 *   count   – number of valid detections
 */
export function parseRawDetections(
  boxes: number[],
  classes: number[],
  scores: number[],
  count: number
): Detection[] {
  const results: Detection[] = [];
  const n = Math.min(Math.round(count), MAX_DETECTIONS);

  for (let i = 0; i < n; i++) {
    const score = scores[i];
    if (score == null || score < CONF_THRESHOLD) continue;

    // Model outputs 0-indexed class IDs; labelmap row 0 is background,
    // so add 1 to align class 0 (person) with labelmap row 1.
    const labelIdx = Math.round(classes[i] ?? 0) + 1;
    const rawLabel = COCO_LABELS[labelIdx]?.toLowerCase() ?? "???";

    if (!RELEVANT_LABELS.has(rawLabel as Detection["label"])) continue;

    const ymin = boxes[i * 4] ?? 0;
    const xmin = boxes[i * 4 + 1] ?? 0;
    const ymax = boxes[i * 4 + 2] ?? 0;
    const xmax = boxes[i * 4 + 3] ?? 0;
    const bboxHeight = Math.max(0, ymax - ymin);

    results.push({
      id: `model-${i}-${Date.now()}`,
      label: rawLabel as Detection["label"],
      confidence: score,
      bbox: {
        x: Math.max(0, xmin),
        y: Math.max(0, ymin),
        width: Math.max(0, xmax - xmin),
        height: bboxHeight,
      },
      distanceM: estimateDistanceM(bboxHeight),
    });
  }

  return results;
}
