import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api/responses";
import { safeIdentifier } from "@/lib/api/validation";
import { getReplayPayload } from "@/lib/db/repository";

export async function GET(_request: Request, { params }: { params: Promise<{ rideId: string }> }) {
  const { rideId: rawRideId } = await params;
  const rideId = safeIdentifier(rawRideId);
  if (!rideId) return jsonError("rideId is invalid.", 400);

  const payload = await getReplayPayload(rideId);

  if (!payload) {
    return jsonError(`Ride ${rideId} was not found.`, 404);
  }

  return NextResponse.json(payload);
}
