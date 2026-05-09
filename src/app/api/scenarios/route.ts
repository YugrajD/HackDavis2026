import { NextResponse } from "next/server";
import type { ScenarioPrompt } from "@/lib/contracts";
import { handleApiError, readJsonBody } from "@/lib/api/responses";
import { generateScenarioResponse, scenarioPresets } from "@/lib/scenarios/road-scenarios";

export async function GET() {
  try {
    return NextResponse.json({
      provider: "deterministic-scenario-lab",
      presets: scenarioPresets,
      scenarios: scenarioPresets.map((prompt) => generateScenarioResponse({ prompt })),
    });
  } catch (error) {
    return handleApiError(error, "List scenarios failed.");
  }
}

export async function POST(request: Request) {
  try {
    const input = await readJsonBody<ScenarioPrompt>(request, { allowEmpty: true, maxBytes: 32 * 1024 });
    const prompts = Array.isArray(input.prompts) ? input.prompts.filter((prompt): prompt is string => typeof prompt === "string").slice(0, 12) : [];

    if (prompts.length) {
      return NextResponse.json({
        provider: "deterministic-scenario-lab",
        scenarios: prompts.map((prompt, index) => generateScenarioResponse({ ...input, prompt, seed: input.seed === undefined ? undefined : input.seed + index })),
      });
    }

    return NextResponse.json(generateScenarioResponse(input));
  } catch (error) {
    return handleApiError(error, "Generate scenario failed.");
  }
}
