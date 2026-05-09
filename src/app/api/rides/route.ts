import { NextResponse } from "next/server";
import type { RideMode } from "@/lib/contracts";
import { createRide, listRides } from "@/lib/db/store";
import { rideModes } from "@/lib/api/validation";

export async function GET() {
  return NextResponse.json({ rides: listRides() });
}

export async function POST(request: Request) {
  const body = (await request.json()) as { mode?: RideMode; startLat?: number; startLng?: number };

  if (!body.mode || !rideModes.has(body.mode)) {
    return NextResponse.json({ error: "mode must be bike, scooter, or car" }, { status: 400 });
  }

  if (!Number.isFinite(body.startLat) || !Number.isFinite(body.startLng)) {
    return NextResponse.json({ error: "startLat and startLng are required numbers" }, { status: 400 });
  }

  const ride = createRide({ mode: body.mode, startLat: body.startLat!, startLng: body.startLng! });
  return NextResponse.json({ ride, persisted: "memory" }, { status: 201 });
}
