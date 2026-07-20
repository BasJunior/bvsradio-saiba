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

export const AUDIO_ACCEPT_ATTR =
  "audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/ogg,audio/flac,audio/mp4,audio/x-m4a,audio/aac,.mp3,.wav,.ogg,.oga,.flac,.m4a,.aac,.opus";

export function fileExtension(name: string): string {
  const part = name.split(".").pop() || "";
  return part.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function isAllowedAudioFile(file: { name: string; type: string; size: number }): {
  ok: boolean;
  error?: string;
  ext: string;
} {
  const ext = fileExtension(file.name) || "mp3";
  const mimeOk = !file.type || AUDIO_MIME_TYPES.has(file.type);
  const extOk = (AUDIO_EXTENSIONS as readonly string[]).includes(ext);
  // Reject video containers (common confusion: phone camera MP4 vs audio)
  if (file.type.startsWith("video/") || ext === "mp4" || ext === "mov" || ext === "mkv") {
    return {
      ok: false,
      ext,
      error:
        "Video files (MP4, MOV, etc.) are not accepted here. Export or convert to audio: MP3, WAV, M4A, FLAC, OGG or AAC.",
    };
  }
  if (!mimeOk && !extOk) {
    return {
      ok: false,
      ext,
      error: `Unsupported format (${file.type || "unknown type"} / .${ext}). Use MP3, WAV, M4A, FLAC, OGG or AAC.`,
    };
  }
  if (!extOk && mimeOk) {
    // MIME ok but weird extension — still allow common audio MIME
  } else if (!extOk) {
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
