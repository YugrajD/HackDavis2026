import { NextResponse } from "next/server";
import { analyzeAndPersistMedia, type AnalyzeAndPersistMediaInput } from "@/lib/media/gemini-mongo";

export async function POST(request: Request) {
  const input = (await request.json()) as AnalyzeAndPersistMediaInput;
  const result = await analyzeAndPersistMedia(input);

  return NextResponse.json(
    {
      event: result.event,
      persisted: result.persisted,
      provider: result.provider,
      message:
        result.persisted === "mongodb"
          ? "Analyzed media and stored the hazard event in MongoDB Atlas."
          : "Analyzed media and stored the hazard event in the local demo store.",
    },
    { status: 201 },
  );
}
