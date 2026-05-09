import { NextResponse } from "next/server";
import { handleApiError, readJsonBody } from "@/lib/api/responses";
import { generateRoadScenario, scenarioToHazardDraft, type ScenarioPrompt } from "@/lib/scenarios/road-scenarios";

export async function POST(request: Request) {
  try {
    const input = await readJsonBody<ScenarioPrompt>(request, { allowEmpty: true, maxBytes: 32 * 1024 });
    const scenario = generateRoadScenario(input);

    return NextResponse.json({
      scenario,
      hazardDraft: scenarioToHazardDraft(scenario),
      provider: "deterministic-scenario-lab",
    });
  } catch (error) {
    return handleApiError(error, "Generate scenario failed.");
  }
}
