import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { StationTrack } from "./station";

const AUDIO_EXTENSIONS = new Set([".mp3", ".wav", ".m4a", ".ogg"]);

function titleFromFilename(filename: string) {
  return filename
    .replace(/\.[^.]+$/, "")
    .replace(/^pack\d+_/, "")
    .replace(/^\d+\.\s*/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getStationTracks(): StationTrack[] {
  const musicDir = path.join(process.cwd(), "public", "music");
  if (!fs.existsSync(musicDir)) return [];

  return fs.readdirSync(musicDir)
    .filter((file) => AUDIO_EXTENSIONS.has(path.extname(file).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((file) => ({
      title: titleFromFilename(file),
      artist: /wolfbrx/i.test(file) ? "Wolf Bridges" : "BVS archive",
      src: `/music/${encodeURIComponent(file)}`,
    }));
}
