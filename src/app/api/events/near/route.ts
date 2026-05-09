import { NextResponse } from "next/server";
import { listNearbyEvents } from "@/lib/db/store";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));
  const radiusM = Number(searchParams.get("radiusM") ?? 100);

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(radiusM)) {
    return NextResponse.json({ error: "lat, lng, and radiusM must be numbers" }, { status: 400 });
  }

  return NextResponse.json({ events: listNearbyEvents(lat, lng, radiusM) });
}
