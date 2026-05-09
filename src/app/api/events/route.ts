import { NextResponse } from "next/server";
import type { HazardEvent } from "@/lib/contracts";
import { createEvent, listEvents } from "@/lib/db/store";
import { sanitizeHazardEventInput } from "@/lib/api/hazard-event-input";
import { parseEventFilters } from "@/lib/api/validation";

export async function GET(request: Request) {
  const events = listEvents(parseEventFilters(request));
  return NextResponse.json({ events });
}

export async function POST(request: Request) {
  const event = createEvent(sanitizeHazardEventInput((await request.json()) as Partial<HazardEvent>));

  return NextResponse.json(
    {
      event,
      persisted: "memory",
      message: "Stored in the local demo store. MongoDB Atlas adapter can replace this without changing the response shape.",
    },
    { status: 201 },
  );
}
