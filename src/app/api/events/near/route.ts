import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api/responses";
import { isLatitude, isLongitude } from "@/lib/api/validation";
import { listNearbyEvents } from "@/lib/db/repository";

const MAX_RADIUS_M = 5000;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const latRaw = searchParams.get("lat");
  const lngRaw = searchParams.get("lng");
  const radiusRaw = searchParams.get("radiusM") ?? "100";
  const lat = latRaw === null || latRaw.trim() === "" ? NaN : Number(latRaw);
  const lng = lngRaw === null || lngRaw.trim() === "" ? NaN : Number(lngRaw);
  const radiusM = radiusRaw.trim() === "" ? NaN : Number(radiusRaw);

  if (!isLatitude(lat) || !isLongitude(lng) || !Number.isFinite(radiusM)) {
    return jsonError("lat and lng are required, and radiusM must be a valid number", 400);
  }

  if (radiusM <= 0 || radiusM > MAX_RADIUS_M) {
    return jsonError(`radiusM must be greater than 0 and at most ${MAX_RADIUS_M}`, 400);
  }

  return NextResponse.json({ events: await listNearbyEvents(lat, lng, radiusM) });
}
