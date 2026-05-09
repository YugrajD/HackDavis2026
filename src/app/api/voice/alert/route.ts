import { Buffer } from "node:buffer";
import { NextResponse } from "next/server";
import { readJsonBody, handleApiError } from "@/lib/api/responses";
import { safeText } from "@/lib/api/validation";

export async function POST(request: Request) {
  try {
    const body = await readJsonBody<{ text?: string }>(request, { allowEmpty: true, maxBytes: 16 * 1024 });
    const text = safeText(body.text, 500) || "Road hazard ahead.";

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
  } catch (error) {
    return handleApiError(error, "Generate voice alert failed.");
  }
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
      text,
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
