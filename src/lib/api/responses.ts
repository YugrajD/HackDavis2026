import { NextResponse } from "next/server";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message, status }, { status });
}

export function requireJsonObject<T extends object = Record<string, unknown>>(value: unknown, message = "Request body must be a JSON object."): T {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ApiError(400, message);
  }

  return value as T;
}

export async function readJsonBody<T>(request: Request, options: { allowEmpty?: boolean; maxBytes?: number } = {}): Promise<T> {
  const contentType = request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if (contentType && contentType !== "application/json") {
    throw new ApiError(415, "Content-Type must be application/json.");
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (options.maxBytes && Number.isFinite(contentLength) && contentLength > options.maxBytes) {
    throw new ApiError(413, `JSON body exceeds ${Math.round(options.maxBytes / 1024)}KB limit.`);
  }

  const raw = await readBoundedText(request, options.maxBytes);
  if (!raw.trim()) {
    if (options.allowEmpty) return {} as T;
    throw new ApiError(400, "Request body must be valid JSON.");
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new ApiError(400, "Request body must be valid JSON.");
  }
}

async function readBoundedText(request: Request, maxBytes?: number) {
  if (!request.body) return request.text();

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (maxBytes && totalBytes > maxBytes) {
      await reader.cancel();
      throw new ApiError(413, `JSON body exceeds ${Math.round(maxBytes / 1024)}KB limit.`);
    }
    chunks.push(decoder.decode(value, { stream: true }));
  }

  chunks.push(decoder.decode());
  return chunks.join("");
}

export function handleApiError(error: unknown, fallbackMessage = "Request failed.") {
  if (error instanceof ApiError) {
    return jsonError(error.message, error.status);
  }

  if (isStatusError(error)) {
    return jsonError(error.message, error.status);
  }

  console.error(fallbackMessage, error);
  return jsonError(fallbackMessage, 500);
}

function isStatusError(error: unknown): error is { message: string; status: number } {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as { message?: unknown; status?: unknown };
  return typeof candidate.message === "string" && typeof candidate.status === "number" && candidate.status >= 400 && candidate.status <= 599;
}
