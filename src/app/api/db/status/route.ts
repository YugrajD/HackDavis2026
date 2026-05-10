import { NextResponse } from "next/server";
import { getMongoDb, isMongoConfigured } from "@/lib/db/mongo";

export async function GET() {
  if (!isMongoConfigured()) {
    return NextResponse.json({ configured: false, connected: false, mode: "memory" });
  }

  try {
    const db = await getMongoDb();
    await db?.command({ ping: 1 });
    return NextResponse.json({ configured: true, connected: true, mode: "mongodb" });
  } catch (error) {
    return NextResponse.json(
      {
        configured: true,
        connected: false,
        mode: "memory-fallback",
        error: error instanceof Error ? error.message : "Unknown MongoDB connection error",
      },
      { status: 503 },
    );
  }
}
