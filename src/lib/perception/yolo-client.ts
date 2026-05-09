import type { FrameDetection } from "@/lib/contracts";
import { getYoloServiceUrl } from "@/lib/config/server";

export type YoloDetectServicePayload = {
  detections: FrameDetection[];
  width: number;
  height: number;
  note?: string;
};

/**
 * Calls the Python FastAPI YOLO service (POST /detect).
 * Next route handlers should use this with YOLO_SERVICE_URL pointing at the sidecar.
 */
export async function fetchYoloDetectionsFromService(imageBase64: string | undefined): Promise<YoloDetectServicePayload | null> {
  const base = getYoloServiceUrl();
  if (!base || !imageBase64?.trim()) return null;

  const url = `${base.replace(/\/$/, "")}/detect`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ imageBase64, imageMimeType: "image/jpeg" }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!response.ok) {
      return {
        detections: [],
        width: 0,
        height: 0,
        note: `YOLO service returned ${response.status}`,
      };
    }

    const data = (await response.json()) as {
      detections?: FrameDetection[];
      width?: number;
      height?: number;
    };

    return {
      detections: Array.isArray(data.detections) ? data.detections : [],
      width: typeof data.width === "number" ? data.width : 0,
      height: typeof data.height === "number" ? data.height : 0,
    };
  } catch {
    return {
      detections: [],
      width: 0,
      height: 0,
      note: "YOLO service unreachable",
    };
  }
}
