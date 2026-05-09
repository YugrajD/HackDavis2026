import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api/responses";
import { parseBbox } from "@/lib/api/validation";
import { listDangerSegments } from "@/lib/db/repository";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawBbox = searchParams.get("bbox");
  const bbox = parseBbox(rawBbox);

  if (rawBbox && !bbox) {
    return jsonError("bbox must be westLng,southLat,eastLng,northLat with valid bounds", 400);
  }

  const dangerSegments = await listDangerSegments(bbox ?? undefined);
  return NextResponse.json({ dangerSegments });
}
