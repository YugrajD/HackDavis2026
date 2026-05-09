import { NextResponse } from "next/server";
import { readJsonBody, handleApiError } from "@/lib/api/responses";
import { sanitizePerceptionResult } from "@/lib/api/perception-input";
import { cameraRoles, isFiniteNumber, isLatitude, isLongitude } from "@/lib/api/validation";
import { analyzeFrameStub, analyzeFrameWithGemini, type AnalyzeFrameInput } from "@/lib/ai/hazard-analysis";

export async function POST(request: Request) {
  try {
    const body = await readJsonBody<AnalyzeFrameInput>(request, { maxBytes: 1024 * 1024 });
    const input = sanitizeAnalyzeFrameInput(body);

    if (process.env.GEMINI_API_KEY) {
      try {
        const analysis = await analyzeFrameWithGemini(input);
        if (analysis) return NextResponse.json({ ...analysis, provider: "gemini", perception: input.perception });
      } catch (error) {
        console.error("Gemini frame analysis failed; falling back to deterministic stub.", error);
      }
    }

    const analysis = analyzeFrameStub(input);
    const provider = input.perception?.tracks.length ? "perception" : "stub";
    return NextResponse.json({
      ...analysis,
      provider,
      perception: input.perception,
      note: provider === "perception"
        ? "Local perception worker supplied the tracking and risk payload. Set GEMINI_API_KEY to cross-check it with image analysis."
        : process.env.GEMINI_API_KEY
          ? "Gemini was configured but unavailable, so the deterministic fallback returned this shape."
          : "Set GEMINI_API_KEY to enable Gemini frame analysis without changing the response shape.",
    });
  } catch (error) {
    return handleApiError(error, "Analyze frame failed.");
  }
}

function sanitizeAnalyzeFrameInput(input: AnalyzeFrameInput): AnalyzeFrameInput {
  return {
    imageBase64: typeof input.imageBase64 === "string" ? input.imageBase64 : undefined,
    lat: isLatitude(input.lat) ? input.lat : undefined,
    lng: isLongitude(input.lng) ? input.lng : undefined,
    speedMps: isFiniteNumber(input.speedMps) && input.speedMps >= 0 ? input.speedMps : undefined,
    headingDeg: isFiniteNumber(input.headingDeg) ? ((input.headingDeg % 360) + 360) % 360 : undefined,
    camera: input.camera && cameraRoles.has(input.camera) ? input.camera : undefined,
    perception: sanitizePerceptionResult(input.perception),
  };
}
