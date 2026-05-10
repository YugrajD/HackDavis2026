import { NextResponse } from "next/server";
import type { HazardEvent } from "@/lib/contracts";
import { handleApiError, jsonError, readJsonBody, requireJsonObject } from "@/lib/api/responses";
import { hasHazardEventInputFields, sanitizeHazardEventInput } from "@/lib/api/hazard-event-input";
import { parseEventFilters } from "@/lib/api/validation";
import { createEvent, listEvents } from "@/lib/db/repository";

export async function GET(request: Request) {
  const events = await listEvents(parseEventFilters(request));
  return NextResponse.json({ events });
}

export async function POST(request: Request) {
  try {
    const body = requireJsonObject<Partial<HazardEvent>>(await readJsonBody<unknown>(request, { maxBytes: 128 * 1024 }));
    const input = sanitizeHazardEventInput(body);
    if (!hasHazardEventInputFields(input)) {
      return jsonError("Event payload must include at least one valid hazard event field.", 400);
    }

    const { value: event, persisted } = await createEvent(input);

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
