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

export async function getStationTracks(): Promise<StationTrack[]> {
  const musicDir = path.join(process.cwd(), "public", "music");
  const local = !fs.existsSync(musicDir) ? [] : fs.readdirSync(musicDir)
    .filter((file) => AUDIO_EXTENSIONS.has(path.extname(file).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((file) => ({
      title: titleFromFilename(file),
      artist: /wolfbrx/i.test(file) ? "Wolf Bridges" : "BVS archive",
      src: `/music/${encodeURIComponent(file)}`,
    }));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return local;
  try {
    const response = await fetch(`${url}/rest/v1/tracks?in_rotation=eq.true&is_public=eq.true&editorial_status=eq.approved&select=title,artist_name,file_url&order=rotation_added_at.desc`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, next: { revalidate: 60 } });
    if (!response.ok) return local;
    const remote = await response.json() as Array<{ title: string; artist_name: string; file_url: string }>;
    return [...remote.map(track => ({ title: track.title, artist: track.artist_name, src: track.file_url })), ...local.filter(track => !remote.some(item => item.file_url === track.src))];
  } catch { return local; }
}
