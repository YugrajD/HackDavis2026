import { NextResponse } from "next/server";
import { analyzeFrameStub, type AnalyzeFrameInput } from "@/lib/ai/hazard-analysis";

export async function POST(request: Request) {
  const input = (await request.json()) as AnalyzeFrameInput;
  const analysis = analyzeFrameStub(input);

  return NextResponse.json({
    ...analysis,
    provider: process.env.GEMINI_API_KEY ? "stub-gemini-ready" : "stub",
    note: "Gemini wiring can replace this deterministic stub without changing the response shape.",
  });
}
