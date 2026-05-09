import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api/responses";
import { isLatitude, isLongitude } from "@/lib/api/validation";
import { listNearbyEvents } from "@/lib/db/repository";

const MAX_RADIUS_M = 5000;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));
  const radiusM = Number(searchParams.get("radiusM") ?? 100);

  if (!isLatitude(lat) || !isLongitude(lng) || !Number.isFinite(radiusM)) {
    return jsonError("lat, lng, and radiusM must be valid numbers", 400);
  }

  if (radiusM <= 0 || radiusM > MAX_RADIUS_M) {
    return jsonError(`radiusM must be greater than 0 and at most ${MAX_RADIUS_M}`, 400);
  }

  return NextResponse.json({ events: await listNearbyEvents(lat, lng, radiusM) });
}
