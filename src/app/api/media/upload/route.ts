import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { ApiError, handleApiError, jsonError, readJsonBody } from "@/lib/api/responses";
import { getStorageConfig } from "@/lib/config/server";
import type { MediaUploadResponse, UploadedMedia } from "@/lib/contracts";

export const runtime = "nodejs";

const { media } = getStorageConfig();
const MAX_THUMBNAIL_BYTES = media.limits.thumbnailBytes;
const MAX_CLIP_BYTES = media.limits.clipBytes;
const MAX_REQUEST_BYTES = media.limits.requestBytes;
const UPLOAD_ROOT = media.uploadRoot;
const PUBLIC_PREFIX = media.publicPrefix;
let ensureUploadDirPromise: Promise<void> | null = null;

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
  const writtenFiles: string[] = [];

  try {
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
      return jsonError(`Upload request exceeds ${Math.round(MAX_REQUEST_BYTES / 1024 / 1024)}MB limit.`, 413);
    }

    const candidates = await readCandidates(request);
    if (!candidates.length) {
      return jsonError("Send multipart fields frame/image/thumbnail/clip or JSON imageBase64/frameBase64/thumbnailBase64/clipBase64.", 400);
    }

    if (!ensureUploadDirPromise) {
      ensureUploadDirPromise = mkdir(UPLOAD_ROOT, { recursive: true }).then(() => undefined);
    }
    await ensureUploadDirPromise;

    const stored: UploadedMedia[] = [];
    for (const candidate of candidates) {
      const contentType = resolveContentType(candidate);
      const maxBytes = candidate.kind === "thumbnail" ? MAX_THUMBNAIL_BYTES : MAX_CLIP_BYTES;
      if (candidate.data.byteLength > maxBytes) {
        return jsonError(`${candidate.kind} media exceeds ${Math.round(maxBytes / 1024 / 1024)}MB limit.`, 413);
      }

      const filename = `${candidate.kind}-${Date.now()}-${randomUUID()}${extensionFor(contentType)}`;
      const filepath = path.join(UPLOAD_ROOT, filename);
      await writeFile(filepath, candidate.data, { flag: "wx" });
      writtenFiles.push(filepath);

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
    await cleanupWrittenFiles(writtenFiles);
    return handleApiError(error, "Media upload failed.");
  }
}

async function cleanupWrittenFiles(files: string[]) {
  await Promise.all(
    files.map(async (file) => {
      if (!isPathInside(UPLOAD_ROOT, file)) return;
      await unlink(file).catch(() => undefined);
    }),
  );
}

function isPathInside(root: string, file: string) {
  const rootPath = path.resolve(root);
  const filepath = path.resolve(file);
  return filepath.startsWith(`${rootPath}${path.sep}`);
}

async function readCandidates(request: Request): Promise<MediaCandidate[]> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    return readFormCandidates(await request.formData());
  }

  const body = await readJsonBody<JsonUploadBody>(request, { maxBytes: MAX_REQUEST_BYTES });
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
  if (!data.byteLength) throw new ApiError(400, "Uploaded media was empty.");
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

  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || base64.length % 4 !== 0) {
    throw new ApiError(400, "Media must be valid base64.");
  }

  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  const decodedBytes = (base64.length / 4) * 3 - padding;
  const maxBytes = kind === "thumbnail" ? MAX_THUMBNAIL_BYTES : MAX_CLIP_BYTES;
  if (decodedBytes > maxBytes) {
    throw new ApiError(413, `${kind} media exceeds ${Math.round(maxBytes / 1024 / 1024)}MB limit.`);
  }

  const data = Buffer.from(base64, "base64");
  if (!data.byteLength) throw new ApiError(400, "Decoded media was empty.");
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

function resolveContentType(candidate: MediaCandidate) {
  const declared = normalizeContentType(candidate.contentType, candidate.kind);
  const detected = detectContentType(candidate.data, candidate.kind);

  if (!declared && !detected) {
    throw new ApiError(415, `Unsupported ${candidate.kind} media type.`);
  }

  if (declared && detected && declared !== detected) {
    throw new ApiError(415, `${candidate.kind} media type does not match file bytes.`);
  }

  return detected ?? declared!;
}

function normalizeContentType(contentType: string | undefined, kind: MediaKind) {
  const normalized = contentType?.split(";")[0]?.trim().toLowerCase();
  if (kind === "thumbnail") {
    if (!normalized) return null;
    return ["image/jpeg", "image/png", "image/webp"].includes(normalized) ? normalized : null;
  }

  if (!normalized) return null;
  return ["video/mp4", "video/webm", "video/quicktime"].includes(normalized) ? normalized : null;
}

function detectContentType(data: Buffer, kind: MediaKind) {
  if (kind === "thumbnail") {
    if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "image/jpeg";
    if (data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
    if (data.length >= 12 && data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP") return "image/webp";
    return null;
  }

  if (data.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return "video/webm";
  if (data.length >= 12 && data.toString("ascii", 4, 8) === "ftyp") {
    const brand = data.toString("ascii", 8, 12).toLowerCase();
    return brand.startsWith("qt") ? "video/quicktime" : "video/mp4";
  }
  return null;
}

function extensionFor(contentType: string) {
  switch (contentType) {
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
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
