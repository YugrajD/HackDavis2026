import { getStorageConfig } from "@/lib/config/server";
import { ApiError } from "@/lib/api/responses";

const JSON_METADATA_BYTES = 512 * 1024;
const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function getImageJsonBodyLimitBytes() {
  const { media } = getStorageConfig();
  return Math.ceil((media.limits.thumbnailBytes * 4) / 3) + JSON_METADATA_BYTES;
}

export function sanitizeImageBase64(
  value: unknown,
  options: { required?: boolean; declaredMimeType?: unknown; fieldName?: string } = {},
): string | undefined {
  const fieldName = options.fieldName ?? "imageBase64";
  if (typeof value !== "string" || !value.trim()) {
    if (options.required) throw new ApiError(400, `${fieldName} is required.`);
    return undefined;
  }

  const trimmed = value.trim();
  const dataUrl = /^data:([^;]+);base64,([\s\S]+)$/.exec(trimmed);
  const dataUrlMimeType = normalizeImageMimeType(dataUrl?.[1]);
  const declaredMimeType = normalizeImageMimeType(options.declaredMimeType);

  if (dataUrl?.[1] && !dataUrlMimeType) throw new ApiError(415, "Unsupported image media type.");
  if (typeof options.declaredMimeType === "string" && options.declaredMimeType.trim() && !declaredMimeType) {
    throw new ApiError(415, "Unsupported image media type.");
  }
  if (dataUrlMimeType && declaredMimeType && dataUrlMimeType !== declaredMimeType) {
    throw new ApiError(415, "imageMimeType does not match imageBase64 data URL.");
  }

  const base64 = (dataUrl?.[2] ?? trimmed).replace(/\s/g, "");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || base64.length % 4 !== 0) {
    throw new ApiError(400, `${fieldName} must be valid base64.`);
  }

  const { media } = getStorageConfig();
  const maxBytes = media.limits.thumbnailBytes;
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  const decodedBytes = (base64.length / 4) * 3 - padding;
  if (decodedBytes > maxBytes) {
    throw new ApiError(413, `${fieldName} exceeds ${Math.round(maxBytes / 1024 / 1024)}MB media limit.`);
  }

  return trimmed;
}

function normalizeImageMimeType(value: unknown) {
  if (typeof value !== "string") return undefined;
  const normalized = value.split(";")[0]?.trim().toLowerCase();
  return normalized && IMAGE_MIME_TYPES.has(normalized) ? normalized : undefined;
}
