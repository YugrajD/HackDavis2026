import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api/responses";
import { safeIdentifier } from "@/lib/api/validation";
import { getScenarioJob } from "@/lib/scenarios/scenario-jobs";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId: rawJobId } = await params;
  const jobId = safeIdentifier(rawJobId);
  if (!jobId) return jsonError("jobId is invalid.", 400);

  const job = getScenarioJob(jobId);
  if (!job) return jsonError(`Scenario job ${jobId} was not found.`, 404);

  return NextResponse.json(job, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
