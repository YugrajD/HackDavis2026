import { NextResponse } from "next/server";
import { sanitizePerceptionResult } from "@/lib/api/perception-input";
import { readJsonBody, handleApiError } from "@/lib/api/responses";
import { cameraRoles, isFiniteNumber, isLatitude, isLongitude, safeIdentifier, safeMediaUrl } from "@/lib/api/validation";
import { analyzeAndPersistMedia, type AnalyzeAndPersistMediaInput } from "@/lib/media/gemini-mongo";

export async function POST(request: Request) {
  try {
    const body = await readJsonBody<AnalyzeAndPersistMediaInput>(request, { maxBytes: 1024 * 1024 });
    const result = await analyzeAndPersistMedia(sanitizeAnalyzeAndPersistInput(body));

    return NextResponse.json(
      {
        event: result.event,
        persisted: result.persisted,
        provider: result.provider,
        perception: result.perception,
        ...(result.yoloNote ? { yoloNote: result.yoloNote } : {}),
        message:
          result.persisted === "mongodb"
            ? "Analyzed media and stored the hazard event in MongoDB Atlas."
            : "Analyzed media and stored the hazard event in the local demo store.",
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error, "Analyze and save media failed.");
  }
}

function sanitizeAnalyzeAndPersistInput(input: AnalyzeAndPersistMediaInput): AnalyzeAndPersistMediaInput {
  return {
    imageBase64: typeof input.imageBase64 === "string" ? input.imageBase64 : undefined,
    rideId: safeIdentifier(input.rideId),
    t: isFiniteNumber(input.t) && input.t >= 0 ? input.t : undefined,
    lat: isLatitude(input.lat) ? input.lat : undefined,
    lng: isLongitude(input.lng) ? input.lng : undefined,
    speedMps: isFiniteNumber(input.speedMps) && input.speedMps >= 0 ? input.speedMps : undefined,
    headingDeg: isFiniteNumber(input.headingDeg) ? ((input.headingDeg % 360) + 360) % 360 : undefined,
    camera: input.camera && cameraRoles.has(input.camera) ? input.camera : undefined,
    clipUrl: safeMediaUrl(input.clipUrl),
    thumbnailUrl: safeMediaUrl(input.thumbnailUrl),
    perception: sanitizePerceptionResult(input.perception),
    useYolo: input.useYolo === true,
  };
}
