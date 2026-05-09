/** Minimal mirrors of server types for the mobile client. */

export type MediaUploadResponse = {
  clipUrl?: string;
  thumbnailUrl?: string;
  stored: Array<{ kind: string; url: string; bytes: number; contentType: string }>;
  persisted: string;
};
