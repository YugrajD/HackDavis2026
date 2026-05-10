import { NextResponse } from "next/server";
import { PROVIDER_NAMES } from "@/lib/contracts";
import type { ScenarioPrompt } from "@/lib/contracts";
import { handleApiError, readJsonBody, requireJsonObject } from "@/lib/api/responses";
import { generateScenarioResponse, scenarioPresets } from "@/lib/scenarios/road-scenarios";

export async function GET() {
  try {
    return NextResponse.json({
      provider: PROVIDER_NAMES.deterministicScenarioLab,
      presets: scenarioPresets,
      scenarios: scenarioPresets.map((prompt) => generateScenarioResponse({ prompt })),
    });
  } catch (error) {
    return handleApiError(error, "List scenarios failed.");
  }
}

export async function POST(request: Request) {
  try {
    const input = requireJsonObject<ScenarioPrompt>(await readJsonBody<unknown>(request, { allowEmpty: true, maxBytes: 32 * 1024 }));
    const prompts = Array.isArray(input.prompts) ? input.prompts.filter((prompt): prompt is string => typeof prompt === "string").slice(0, 12) : [];

    if (prompts.length) {
      return NextResponse.json({
        provider: PROVIDER_NAMES.deterministicScenarioLab,
        scenarios: prompts.map((prompt, index) => generateScenarioResponse({ ...input, prompt, seed: input.seed === undefined ? undefined : input.seed + index })),
      });
    }

    return NextResponse.json(generateScenarioResponse(input));
  } catch (error) {
    return handleApiError(error, "Generate scenario failed.");
  }
}
