import { NextResponse } from "next/server";
import { generateRoadScenario, scenarioToHazardDraft, type ScenarioPrompt } from "@/lib/scenarios/road-scenarios";

export async function POST(request: Request) {
  const input = (await request.json().catch(() => ({}))) as ScenarioPrompt;
  const scenario = generateRoadScenario(input);

  return NextResponse.json({
    scenario,
    hazardDraft: scenarioToHazardDraft(scenario),
    provider: "deterministic-scenario-lab",
  });
}
