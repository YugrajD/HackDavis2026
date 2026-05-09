import { NextResponse } from "next/server";
import { listDangerSegments } from "@/lib/db/store";
import { parseBbox } from "@/lib/api/validation";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawBbox = searchParams.get("bbox");
  const bbox = parseBbox(rawBbox);

  if (rawBbox && !bbox) {
    return NextResponse.json({ error: "bbox must be westLng,southLat,eastLng,northLat" }, { status: 400 });
  }

  const dangerSegments = listDangerSegments(bbox ?? undefined);
  return NextResponse.json({ dangerSegments });
}
