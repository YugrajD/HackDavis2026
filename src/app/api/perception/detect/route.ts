import { NextResponse } from "next/server";
import { getImageJsonBodyLimitBytes, sanitizeImageBase64 } from "@/lib/api/media-payload";
import { readJsonBody, handleApiError } from "@/lib/api/responses";
import { getYoloServiceUrl } from "@/lib/config/server";
import { fetchYoloDetectionsFromService } from "@/lib/perception/yolo-client";

type DetectRequestBody = {
  imageBase64?: string;
  imageMimeType?: string;
};

export async function POST(request: Request) {
  try {
    const body = await readJsonBody<DetectRequestBody>(request, { maxBytes: getImageJsonBodyLimitBytes() });
    const imageBase64 = sanitizeImageBase64(body.imageBase64, {
      required: true,
      declaredMimeType: body.imageMimeType,
    });

    if (!getYoloServiceUrl()) {
      return NextResponse.json(
        {
          detections: [],
          width: 0,
          height: 0,
          note: "YOLO_SERVICE_URL is not set. Start the Python sidecar (services/yolo) and point YOLO_SERVICE_URL at it.",
        },
        { status: 503 },
      );
    }

    const result = await fetchYoloDetectionsFromService(imageBase64);
    if (!result) {
      return NextResponse.json(
        { detections: [], width: 0, height: 0, note: "Could not reach YOLO service." },
        { status: 503 },
      );
    }

    const status = result.note ? 503 : 200;
    return NextResponse.json(
      {
        detections: result.detections,
        width: result.width,
        height: result.height,
        ...(result.note ? { note: result.note } : {}),
      },
      { status },
    );
  } catch (error) {
    return handleApiError(error, "Perception detect failed.");
  }
}
