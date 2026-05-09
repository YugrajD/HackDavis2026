import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = (await request.json()) as { text?: string };
  const text = body.text?.trim() || "Road hazard ahead.";

  return NextResponse.json({
    text,
    audioUrl: null,
    provider: process.env.ELEVENLABS_API_KEY ? "stub-elevenlabs-ready" : "stub",
    message: "ElevenLabs generation endpoint placeholder. Frontend should use native TTS if audioUrl is null.",
  });
}
