import { Buffer } from "node:buffer";
import { NextResponse } from "next/server";
import { readJsonBody, handleApiError } from "@/lib/api/responses";
import { safeText } from "@/lib/api/validation";
import { getSponsorConfig } from "@/lib/config/server";

export async function POST(request: Request) {
  try {
    const body = await readJsonBody<{ text?: string }>(request, { allowEmpty: true, maxBytes: 16 * 1024 });
    const text = safeText(body.text, 500) || "Road hazard ahead.";

    const { elevenLabs } = getSponsorConfig();

    if (elevenLabs.apiKey) {
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
      message: elevenLabs.apiKey
        ? "ElevenLabs was configured but unavailable. Frontend should use native TTS if audioUrl is null."
        : "Set ELEVENLABS_API_KEY to enable ElevenLabs audio. Frontend should use native TTS if audioUrl is null.",
    });
  } catch (error) {
    return handleApiError(error, "Generate voice alert failed.");
  }
}

async function generateElevenLabsAlert(text: string) {
  const { elevenLabs } = getSponsorConfig();
  if (!elevenLabs.apiKey) return null;

  const url = new URL(`https://api.elevenlabs.io/v1/text-to-speech/${elevenLabs.voiceId}`);
  url.searchParams.set("output_format", elevenLabs.outputFormat);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": elevenLabs.apiKey,
      accept: "audio/mpeg",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      text,
      model_id: elevenLabs.modelId,
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
