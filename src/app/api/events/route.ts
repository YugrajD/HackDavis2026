import { NextResponse } from "next/server";
import type { HazardEvent } from "@/lib/contracts";
import { createEvent, listEvents } from "@/lib/db/repository";
import { sanitizeHazardEventInput } from "@/lib/api/hazard-event-input";
import { parseEventFilters } from "@/lib/api/validation";

export async function GET(request: Request) {
  const events = await listEvents(parseEventFilters(request));
  return NextResponse.json({ events });
}

export async function POST(request: Request) {
  const { value: event, persisted } = await createEvent(sanitizeHazardEventInput((await request.json()) as Partial<HazardEvent>));

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
}
