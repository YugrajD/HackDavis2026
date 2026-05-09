import { NextResponse } from "next/server";
import { analyzeFrameStub, analyzeFrameWithGemini, type AnalyzeFrameInput } from "@/lib/ai/hazard-analysis";

export async function POST(request: Request) {
  const input = (await request.json()) as AnalyzeFrameInput;

  if (process.env.GEMINI_API_KEY) {
    try {
      const analysis = await analyzeFrameWithGemini(input);
      if (analysis) return NextResponse.json({ ...analysis, provider: "gemini" });
    } catch (error) {
      console.error("Gemini frame analysis failed; falling back to deterministic stub.", error);
    }
  }

  const analysis = analyzeFrameStub(input);
  return NextResponse.json({
    ...analysis,
    provider: "stub",
    note: process.env.GEMINI_API_KEY
      ? "Gemini was configured but unavailable, so the deterministic fallback returned this shape."
      : "Set GEMINI_API_KEY to enable Gemini frame analysis without changing the response shape.",
  });
}
