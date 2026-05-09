import { NextResponse } from "next/server";
import type { HazardEvent } from "@/lib/contracts";
import { jsonError, readJsonBody, handleApiError } from "@/lib/api/responses";
import { sanitizeHazardEventInput } from "@/lib/api/hazard-event-input";
import { createEvents } from "@/lib/db/repository";

const MAX_BATCH_EVENTS = 100;

export async function POST(request: Request) {
  try {
    const body = await readJsonBody<{ events?: Partial<HazardEvent>[] }>(request, { maxBytes: 512 * 1024 });

    if (!Array.isArray(body.events)) {
      return jsonError("events must be an array", 400);
    }

    if (body.events.length > MAX_BATCH_EVENTS) {
      return jsonError(`events batch cannot exceed ${MAX_BATCH_EVENTS} items`, 413);
    }

    const { value: events, persisted } = await createEvents(body.events.map(sanitizeHazardEventInput));
    return NextResponse.json({ events, persisted }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "Create events batch failed.");
  }
}
