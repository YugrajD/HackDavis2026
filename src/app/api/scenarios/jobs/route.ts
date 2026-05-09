import { NextResponse } from "next/server";
import type { ScenarioPrompt } from "@/lib/contracts";
import { handleApiError, readJsonBody } from "@/lib/api/responses";
import { createScenarioJob } from "@/lib/scenarios/scenario-jobs";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const input = await readJsonBody<ScenarioPrompt>(request, { allowEmpty: true, maxBytes: 32 * 1024 });
    const job = createScenarioJob(input, new URL(request.url).origin);

    return NextResponse.json(job, {
      status: 202,
      headers: {
        Location: job.statusUrl,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleApiError(error, "Create scenario job failed.");
  }
}
