import { NextResponse } from "next/server";
import { endRide } from "@/lib/db/repository";

export async function PATCH(_request: Request, { params }: { params: Promise<{ rideId: string }> }) {
  const { rideId } = await params;
  const ride = await endRide(rideId);

  if (!ride) {
    return NextResponse.json({ error: `Ride ${rideId} was not found.` }, { status: 404 });
  }

  return NextResponse.json({ ride });
}
