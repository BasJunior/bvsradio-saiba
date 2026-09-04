/** Accepted music-video containers for artist submission. */

export const VIDEO_EXTENSIONS = ["mp4", "mov", "webm", "m4v"] as const;

export const VIDEO_MIME_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-m4v",
  "video/m4v",
]);

/** Prefer extensions — mobile browsers often report empty/odd MIME. */
export const VIDEO_ACCEPT_ATTR = ".mp4,.mov,.webm,.m4v,video/mp4,video/quicktime,video/webm";

/** Soft cap for direct R2 PUT (not through Vercel). 1.5GB. */
export const VIDEO_MAX_BYTES = 1500 * 1024 * 1024;

export function fileExtension(name: string): string {
  const part = name.split(".").pop() || "";
  return part.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function isAllowedVideoFile(file: {
  name: string;
  type: string;
  size: number;
  maxBytes?: number;
}): { ok: boolean; error?: string; ext: string } {
  const ext = fileExtension(file.name);
  const mime = (file.type || "").toLowerCase();
  const maxBytes = file.maxBytes || VIDEO_MAX_BYTES;

  if (file.size <= 0) {
    return { ok: false, ext: ext || "unknown", error: "The selected video file is empty." };
  }
  if (file.size > maxBytes) {
    return {
      ok: false,
      ext: ext || "unknown",
      error: `Music video must be ${Math.floor(maxBytes / 1024 / 1024)}MB or smaller. Compress to MP4 (H.264) if needed.`,
    };
  }

  // Reject pure audio here — this path is video only
  if (mime.startsWith("audio/") || ["mp3", "wav", "flac", "ogg", "aac", "m4a"].includes(ext)) {
    return {
      ok: false,
      ext: ext || "audio",
      error: "This is the music video uploader. For audio releases use Studio → Release music.",
    };
  }

  const extOk = (VIDEO_EXTENSIONS as readonly string[]).includes(ext);
  const mimeOk = !mime || VIDEO_MIME_TYPES.has(mime) || mime.startsWith("video/");

  if (ext && !extOk) {
    return {
      ok: false,
      ext,
      error: "Use MP4, MOV, WebM or M4V for music videos (H.264 MP4 recommended).",
    };
  }
  if (!ext && !mimeOk) {
    return {
      ok: false,
      ext: "unknown",
      error: "Could not detect video type. Rename the file to end with .mp4 and try again.",
    };
  }

  let resolved = ext;
  if (!resolved || !extOk) {
    if (mime.includes("webm")) resolved = "webm";
    else if (mime.includes("quicktime")) resolved = "mov";
    else resolved = "mp4";
  }

  return { ok: true, ext: resolved };
}

export function isAllowedVideoPoster(file: { name: string; type: string; size: number }): {
  ok: boolean;
  error?: string;
  ext: string;
} {
  const ext = fileExtension(file.name) || "jpg";
  const mime = (file.type || "").toLowerCase();
  if (file.size <= 0) return { ok: false, ext, error: "Poster image is empty." };
  if (file.size > 8 * 1024 * 1024) {
    return { ok: false, ext, error: "Poster image must be 8MB or smaller (JPG, PNG or WebP)." };
  }
  const okExt = ["jpg", "jpeg", "png", "webp"].includes(ext);
  const okMime = !mime || ["image/jpeg", "image/png", "image/webp"].includes(mime);
  if (!okExt || !okMime) {
    return { ok: false, ext, error: "Poster must be a JPG, PNG or WebP image." };
  }
  return { ok: true, ext: ext === "jpeg" ? "jpg" : ext };
}
