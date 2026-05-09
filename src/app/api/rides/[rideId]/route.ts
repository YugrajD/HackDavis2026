import { NextResponse } from "next/server";
import { getRide } from "@/lib/db/repository";

export async function GET(_request: Request, { params }: { params: Promise<{ rideId: string }> }) {
  const { rideId } = await params;
  const ride = await getRide(rideId);

  if (!ride) {
    return NextResponse.json({ error: `Ride ${rideId} was not found.` }, { status: 404 });
  }

  return NextResponse.json({ ride });
}
