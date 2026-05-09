import { NextResponse } from "next/server";
import type { HazardEvent } from "@/lib/contracts";
import { sanitizeHazardEventInput } from "@/lib/api/hazard-event-input";
import { createEvents } from "@/lib/db/repository";

export async function POST(request: Request) {
  const body = (await request.json()) as { events?: Partial<HazardEvent>[] };

  if (!Array.isArray(body.events)) {
    return NextResponse.json({ error: "events must be an array" }, { status: 400 });
  }

  const { value: events, persisted } = await createEvents(body.events.map(sanitizeHazardEventInput));
  return NextResponse.json({ events, persisted }, { status: 201 });
}
