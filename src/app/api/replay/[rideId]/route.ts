import { NextResponse } from "next/server";
import { getReplayPayload } from "@/lib/db/repository";

export async function GET(_request: Request, { params }: { params: Promise<{ rideId: string }> }) {
  const { rideId } = await params;
  const payload = await getReplayPayload(rideId);

  if (!payload) {
    return NextResponse.json({ error: `Ride ${rideId} was not found.` }, { status: 404 });
  }

  return NextResponse.json(payload);
}
