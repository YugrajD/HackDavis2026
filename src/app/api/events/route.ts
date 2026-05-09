import { NextResponse } from "next/server";
import type { HazardEvent } from "@/lib/contracts";
import { readJsonBody, handleApiError } from "@/lib/api/responses";
import { sanitizeHazardEventInput } from "@/lib/api/hazard-event-input";
import { parseEventFilters } from "@/lib/api/validation";
import { createEvent, listEvents } from "@/lib/db/repository";

export async function GET(request: Request) {
  const events = await listEvents(parseEventFilters(request));
  return NextResponse.json({ events });
}

export async function POST(request: Request) {
  try {
    const body = await readJsonBody<Partial<HazardEvent>>(request, { maxBytes: 128 * 1024 });
    const { value: event, persisted } = await createEvent(sanitizeHazardEventInput(body));

    return NextResponse.json(
      {
        event,
        persisted,
        message:
          persisted === "mongodb"
            ? "Stored in MongoDB Atlas."
            : "Stored in the local demo store. MongoDB Atlas adapter can replace this without changing the response shape.",
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error, "Create event failed.");
  }
}
