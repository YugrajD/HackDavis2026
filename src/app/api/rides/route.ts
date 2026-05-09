import { NextResponse } from "next/server";
import type { RideMode } from "@/lib/contracts";
import { readJsonBody, jsonError, handleApiError } from "@/lib/api/responses";
import { isLatitude, isLongitude, rideModes } from "@/lib/api/validation";
import { createRide, listRides } from "@/lib/db/repository";

export async function GET() {
  return NextResponse.json({ rides: await listRides() });
}

export async function POST(request: Request) {
  try {
    const body = await readJsonBody<{ mode?: RideMode; startLat?: number; startLng?: number }>(request, { maxBytes: 32 * 1024 });

    if (!body.mode || !rideModes.has(body.mode)) {
      return jsonError("mode must be bike, scooter, or car", 400);
    }

    if (!isLatitude(body.startLat) || !isLongitude(body.startLng)) {
      return jsonError("startLat and startLng are required coordinates", 400);
    }

    const { value: ride, persisted } = await createRide({ mode: body.mode, startLat: body.startLat, startLng: body.startLng });
    return NextResponse.json({ ride, persisted }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "Create ride failed.");
  }
}
