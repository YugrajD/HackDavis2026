import { randomUUID } from "node:crypto";
import { PROVIDER_NAMES } from "@/lib/contracts";
import type { ScenarioJob, ScenarioJobResult, ScenarioPrompt } from "@/lib/contracts";
import { generateScenarioResponse } from "@/lib/scenarios/road-scenarios";

type ScenarioJobStore = Map<string, ScenarioJob>;

const MAX_JOBS = 50;
const JOB_TTL_MS = 15 * 60 * 1000;

const globalScenarioJobs = globalThis as typeof globalThis & {
  guardianRoadScenarioJobs?: ScenarioJobStore;
};

const jobs = globalScenarioJobs.guardianRoadScenarioJobs ?? new Map<string, ScenarioJob>();
globalScenarioJobs.guardianRoadScenarioJobs = jobs;

export function createScenarioJob(input: ScenarioPrompt, origin: string) {
  trimOldJobs();

  const now = new Date().toISOString();
  const id = `scenario-job-${randomUUID()}`;
  const job: ScenarioJob = {
    id,
    status: "queued",
    createdAt: now,
    updatedAt: now,
    statusUrl: `${origin}/api/scenarios/jobs/${id}`,
    provider: PROVIDER_NAMES.deterministicScenarioLab,
    input: normalizeScenarioJobInput(input),
  };

  jobs.set(id, job);
  scheduleJobCleanup(id);
  setTimeout(() => runScenarioJob(id), 0);
  return job;
}

export function getScenarioJob(id: string) {
  const job = jobs.get(id);
  if (!job) return undefined;
  if (isExpired(job)) {
    jobs.delete(id);
    return undefined;
  }
  return job;
}

function runScenarioJob(id: string) {
  const job = jobs.get(id);
  if (!job || job.status !== "queued") return;

  updateJob(job, { status: "running", error: undefined });

  try {
    updateJob(job, { status: "succeeded", result: buildScenarioJobResult(job.input) });
  } catch (error) {
    updateJob(job, { status: "failed", error: error instanceof Error ? error.message : "Scenario generation failed." });
  }
}

function buildScenarioJobResult(input: ScenarioPrompt): ScenarioJobResult {
  const prompts = Array.isArray(input.prompts) ? input.prompts.filter((prompt): prompt is string => typeof prompt === "string" && prompt.trim().length > 0).slice(0, 12) : [];

  if (prompts.length) {
    return {
      provider: PROVIDER_NAMES.deterministicScenarioLab,
      scenarios: prompts.map((prompt, index) => generateScenarioResponse({ ...input, prompt, prompts: undefined, seed: input.seed === undefined ? undefined : input.seed + index })),
    };
  }

  return generateScenarioResponse(input);
}

function updateJob(job: ScenarioJob, patch: Partial<Pick<ScenarioJob, "status" | "result" | "error">>) {
  Object.assign(job, patch, { updatedAt: new Date().toISOString() });
}

function normalizeScenarioJobInput(input: ScenarioPrompt = {}): ScenarioPrompt {
  return {
    prompt: typeof input.prompt === "string" ? input.prompt.slice(0, 240) : undefined,
    prompts: Array.isArray(input.prompts) ? input.prompts.filter((prompt): prompt is string => typeof prompt === "string" && prompt.trim().length > 0).slice(0, 12) : undefined,
    mode: input.mode,
    camera: input.camera,
    lat: input.lat,
    lng: input.lng,
    seed: input.seed,
  };
}

function trimOldJobs() {
  for (const [id, job] of jobs) {
    if (isExpired(job)) jobs.delete(id);
  }

  while (jobs.size >= MAX_JOBS) {
    const oldestJobId = jobs.keys().next().value;
    if (!oldestJobId) return;
    jobs.delete(oldestJobId);
  }
}

function scheduleJobCleanup(id: string) {
  const timer = setTimeout(() => {
    const job = jobs.get(id);
    if (job && isExpired(job)) jobs.delete(id);
  }, JOB_TTL_MS + 1_000);

  if (typeof timer === "object" && "unref" in timer) timer.unref();
}

function isExpired(job: ScenarioJob) {
  const createdAt = Date.parse(job.createdAt);
  return Number.isFinite(createdAt) && Date.now() - createdAt > JOB_TTL_MS;
}
