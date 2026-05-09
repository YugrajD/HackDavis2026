import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import type { MediaUploadResponse, UploadedMedia } from "@/lib/contracts";

export const runtime = "nodejs";

const MAX_BYTES = 12 * 1024 * 1024;
const UPLOAD_ROOT = path.join(process.cwd(), "public", "generated", "uploads");
const PUBLIC_PREFIX = "/generated/uploads";

type MediaKind = UploadedMedia["kind"];

type MediaCandidate = {
  kind: MediaKind;
  contentType?: string;
  data: Buffer;
};

type JsonUploadBody = {
  imageBase64?: unknown;
  frameBase64?: unknown;
  thumbnailBase64?: unknown;
  clipBase64?: unknown;
  base64?: unknown;
  kind?: unknown;
  mimeType?: unknown;
  imageMimeType?: unknown;
  clipMimeType?: unknown;
};

export async function POST(request: Request) {
  try {
    const candidates = await readCandidates(request);
    if (!candidates.length) {
      return NextResponse.json(
        { error: "Send multipart fields frame/image/thumbnail/clip or JSON imageBase64/frameBase64/thumbnailBase64/clipBase64." },
        { status: 400 },
      );
    }

    await mkdir(UPLOAD_ROOT, { recursive: true });

    const stored: UploadedMedia[] = [];
    for (const candidate of candidates) {
      const contentType = normalizeContentType(candidate.contentType, candidate.kind);
      if (!contentType) {
        return NextResponse.json({ error: `Unsupported ${candidate.kind} media type.` }, { status: 415 });
      }
      if (candidate.data.byteLength > MAX_BYTES) {
        return NextResponse.json({ error: `Media exceeds ${Math.round(MAX_BYTES / 1024 / 1024)}MB limit.` }, { status: 413 });
      }

      const filename = `${candidate.kind}-${Date.now()}-${randomUUID()}${extensionFor(contentType)}`;
      const filepath = path.join(UPLOAD_ROOT, filename);
      await writeFile(filepath, candidate.data);

      stored.push({
        kind: candidate.kind,
        url: `${PUBLIC_PREFIX}/${filename}`,
        bytes: candidate.data.byteLength,
        contentType,
      });
    }

    const response: MediaUploadResponse = {
      clipUrl: stored.find((item) => item.kind === "clip")?.url,
      thumbnailUrl: stored.find((item) => item.kind === "thumbnail")?.url,
      stored,
      persisted: "public/generated",
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Media upload failed." }, { status: 400 });
  }
}

async function readCandidates(request: Request): Promise<MediaCandidate[]> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    return readFormCandidates(await request.formData());
  }

  const body = (await request.json()) as JsonUploadBody;
  const candidates: MediaCandidate[] = [];
  const imageMimeType = stringValue(body.imageMimeType) ?? stringValue(body.mimeType);
  const clipMimeType = stringValue(body.clipMimeType) ?? stringValue(body.mimeType);

  addBase64Candidate(candidates, "thumbnail", body.thumbnailBase64, imageMimeType);
  addBase64Candidate(candidates, "thumbnail", body.frameBase64, imageMimeType);
  addBase64Candidate(candidates, "thumbnail", body.imageBase64, imageMimeType);
  addBase64Candidate(candidates, body.kind === "clip" ? "clip" : "thumbnail", body.base64, stringValue(body.mimeType));
  addBase64Candidate(candidates, "clip", body.clipBase64, clipMimeType);

  return dedupeByKind(candidates);
}

async function readFormCandidates(formData: FormData): Promise<MediaCandidate[]> {
  const candidates: MediaCandidate[] = [];

  await addFormValue(candidates, "thumbnail", formData.get("thumbnail"));
  await addFormValue(candidates, "thumbnail", formData.get("frame"));
  await addFormValue(candidates, "thumbnail", formData.get("image"));
  await addFormValue(candidates, "clip", formData.get("clip"));
  await addFormValue(candidates, "clip", formData.get("video"));

  return dedupeByKind(candidates);
}

async function addFormValue(candidates: MediaCandidate[], kind: MediaKind, value: FormDataEntryValue | null) {
  if (!value) return;

  if (typeof value === "string") {
    candidates.push(decodeBase64Candidate(kind, value));
    return;
  }

  const data = Buffer.from(await value.arrayBuffer());
  candidates.push({ kind, data, contentType: value.type });
}

function addBase64Candidate(candidates: MediaCandidate[], kind: MediaKind, value: unknown, fallbackContentType?: string) {
  if (typeof value !== "string" || !value.trim()) return;
  candidates.push(decodeBase64Candidate(kind, value, fallbackContentType));
}

function decodeBase64Candidate(kind: MediaKind, value: string, fallbackContentType?: string): MediaCandidate {
  const trimmed = value.trim();
  const match = /^data:([^;]+);base64,([\s\S]+)$/.exec(trimmed);
  const contentType = match?.[1] ?? fallbackContentType;
  const base64 = (match?.[2] ?? trimmed).replace(/\s/g, "");
  const data = Buffer.from(base64, "base64");

  if (!data.byteLength) throw new Error("Decoded media was empty.");
  return { kind, data, contentType };
}

function dedupeByKind(candidates: MediaCandidate[]) {
  const seen = new Set<MediaKind>();
  return candidates.filter((candidate) => {
    if (seen.has(candidate.kind)) return false;
    seen.add(candidate.kind);
    return true;
  });
}

function normalizeContentType(contentType: string | undefined, kind: MediaKind) {
  const normalized = contentType?.split(";")[0]?.trim().toLowerCase();
  if (kind === "thumbnail") {
    if (!normalized) return "image/jpeg";
    return ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(normalized) ? normalized : null;
  }

  if (!normalized) return "video/webm";
  return ["video/mp4", "video/webm", "video/quicktime"].includes(normalized) ? normalized : null;
}

function extensionFor(contentType: string) {
  switch (contentType) {
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/gif":
      return ".gif";
    case "video/mp4":
      return ".mp4";
    case "video/quicktime":
      return ".mov";
    case "video/webm":
      return ".webm";
    default:
      return ".jpg";
  }
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
