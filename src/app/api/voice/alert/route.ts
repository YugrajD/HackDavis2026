import { Buffer } from "node:buffer";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = (await request.json()) as { text?: string };
  const text = body.text?.trim() || "Road hazard ahead.";

  if (process.env.ELEVENLABS_API_KEY) {
    try {
      const audioUrl = await generateElevenLabsAlert(text);
      if (audioUrl) {
        return NextResponse.json({
          text,
          audioUrl,
          provider: "elevenlabs",
          message: "Generated ElevenLabs alert audio. Clients can play audioUrl directly.",
        });
      }
    } catch (error) {
      console.error("ElevenLabs voice alert generation failed; falling back to native TTS.", error);
    }
  }

  return NextResponse.json({
    text,
    audioUrl: null,
    provider: "stub",
    message: process.env.ELEVENLABS_API_KEY
      ? "ElevenLabs was configured but unavailable. Frontend should use native TTS if audioUrl is null."
      : "Set ELEVENLABS_API_KEY to enable ElevenLabs audio. Frontend should use native TTS if audioUrl is null.",
  });
}

async function generateElevenLabsAlert(text: string) {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) return null;

  const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim() || "21m00Tcm4TlvDq8ikWAM";
  const modelId = process.env.ELEVENLABS_MODEL_ID?.trim() || "eleven_multilingual_v2";
  const outputFormat = process.env.ELEVENLABS_OUTPUT_FORMAT?.trim() || "mp3_44100_128";
  const url = new URL(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`);
  url.searchParams.set("output_format", outputFormat);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      accept: "audio/mpeg",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      text: text.slice(0, 500),
      model_id: modelId,
      voice_settings: {
        stability: 0.55,
        similarity_boost: 0.75,
        style: 0.15,
        use_speaker_boost: true,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`ElevenLabs request failed with ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "audio/mpeg";
  const audioBuffer = Buffer.from(await response.arrayBuffer());
  return `data:${contentType};base64,${audioBuffer.toString("base64")}`;
}
