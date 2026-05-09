import { NextResponse } from "next/server";
import { getRide } from "@/lib/db/store";

export async function GET(_request: Request, { params }: { params: Promise<{ rideId: string }> }) {
  const { rideId } = await params;
  const ride = getRide(rideId);

  if (!ride) {
    return NextResponse.json({ error: `Ride ${rideId} was not found.` }, { status: 404 });
  }

  return NextResponse.json({ ride });
}
