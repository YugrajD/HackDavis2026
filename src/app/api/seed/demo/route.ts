import { NextResponse } from "next/server";
import { demoDangerSegments, demoEvents, demoRide } from "@/lib/seed/demo-data";
import { resetDemoData } from "@/lib/db/store";

export async function POST() {
  return NextResponse.json(resetDemoData());
}

export async function GET() {
  return NextResponse.json(
    {
      message: "Use POST /api/seed/demo to create or reset demo data. GET is read-only.",
      rideId: demoRide.id,
      eventCount: demoEvents.length,
      segmentCount: demoDangerSegments.length,
    },
    { status: 200 },
  );
}
