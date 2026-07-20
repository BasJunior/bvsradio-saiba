/** Accepted radio/catalogue submission audio formats. */

export const AUDIO_EXTENSIONS = [
  "mp3",
  "wav",
  "ogg",
  "oga",
  "flac",
  "m4a",
  "aac",
  "opus",
] as const;

/** MIME types browsers / OS may report for the formats above. */
export const AUDIO_MIME_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/ogg",
  "audio/vorbis",
  "audio/flac",
  "audio/x-flac",
  "audio/mp4", // common for .m4a on iOS / macOS
  "audio/x-m4a",
  "audio/aac",
  "audio/aacp",
  "audio/opus",
  "audio/webm",
]);

/** Prefer extensions — mixed MIME+extension lists confuse some mobile browsers. */
export const AUDIO_ACCEPT_ATTR = ".mp3,.wav,.ogg,.oga,.flac,.m4a,.aac,.opus,audio/*";

export function fileExtension(name: string): string {
  const part = name.split(".").pop() || "";
  return part.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function isAllowedAudioFile(file: { name: string; type: string; size: number }): {
  ok: boolean;
  error?: string;
  ext: string;
} {
  const ext = fileExtension(file.name);
  const mime = (file.type || "").toLowerCase();
  const mimeOk = !mime || AUDIO_MIME_TYPES.has(mime);
  const extOk = (AUDIO_EXTENSIONS as readonly string[]).includes(ext);
  // Reject video containers (common confusion: phone camera MP4 vs audio)
  if (mime.startsWith("video/") || ext === "mp4" || ext === "mov" || ext === "mkv") {
    return {
      ok: false,
      ext: ext || "mp4",
      error:
        "Video files (MP4, MOV, etc.) are not accepted here. Export or convert to audio: MP3, WAV, M4A, FLAC, OGG or AAC.",
    };
  }
  // Prefer extension when present; many OS leave type empty for .wav
  if (ext && !extOk && !mimeOk) {
    return {
      ok: false,
      ext,
      error: `Unsupported format (${mime || "unknown type"} / .${ext}). Use MP3, WAV, M4A, FLAC, OGG or AAC.`,
    };
  }
  if (!ext && !mimeOk) {
    return {
      ok: false,
      ext: "unknown",
      error: "Could not detect audio type. Rename the file to end with .mp3, .wav, .m4a, .flac or .ogg and try again.",
    };
  }
  if (ext && !extOk && mimeOk) {
    // e.g. odd extension but valid audio MIME — allow
  } else if (ext && !extOk) {
    return {
      ok: false,
      ext,
      error: "Use MP3, WAV, M4A, FLAC, OGG or AAC for radio submission.",
    };
  }
  const isWav = ext === "wav" || file.type.includes("wav");
  const isLossless = isWav || ext === "flac" || file.type.includes("flac");
  const maxBytes = isLossless ? 100 * 1024 * 1024 : 40 * 1024 * 1024;
  if (file.size <= 0) {
    return { ok: false, ext, error: "The selected file is empty." };
  }
  if (file.size > maxBytes) {
    return {
      ok: false,
      ext,
      error: isLossless
        ? "WAV/FLAC must be 100MB or smaller."
        : "Compressed audio (MP3/M4A/OGG/AAC) must be 40MB or smaller.",
    };
  }
  return { ok: true, ext: extOk ? ext : fileExtension(file.name) || "mp3" };
}
