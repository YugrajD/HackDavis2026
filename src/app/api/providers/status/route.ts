import { NextResponse } from "next/server";
import { getProviderStatus } from "@/lib/api/readiness";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(await getProviderStatus());
}
