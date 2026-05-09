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
  return NextResponse.json({ error: message }, { status });
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

  const raw = await request.text();
  if (options.maxBytes && new TextEncoder().encode(raw).byteLength > options.maxBytes) {
    throw new ApiError(413, `JSON body exceeds ${Math.round(options.maxBytes / 1024)}KB limit.`);
  }

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

export function handleApiError(error: unknown, fallbackMessage = "Request failed.") {
  if (error instanceof ApiError) {
    return jsonError(error.message, error.status);
  }

  console.error(fallbackMessage, error);
  return jsonError(fallbackMessage, 500);
}
