import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { StationTrack } from "./station";
import {
  artworkForMusicSrc,
  curatedRotationFilenames,
  projectNameForMusicSrc,
} from "./music-projects";

const AUDIO_EXTENSIONS = new Set([".mp3", ".wav", ".m4a", ".ogg"]);

/** House / foundation set while artist catalogue is thin */
const HOUSE_LIBRARY = [
  "bvs-radio-robert-gabriel-mugabe-international-airport.mp3",
  "bvs-radio-slide-mix.mp3",
  "bvs-brx-never-ending-mix.mp3",
  "bvs-radio-starve.mp3",
  "bvs-radio-ab2c-mix.mp3",
  "bvs-radio-nerve-mix.mp3",
  "bvs-radio-on-the-moon-mix.mp3",
  "bvs-whills-brx-deep.mp3",
  "bvs-brx-uptown-wins.mp3",
  "bvs-radio-having-fun.mp3",
  "bvs-brx-want-sumo.mp3",
  "bvs-party-tarpy-mix.mp3",
  "bvs-radio-sad-addict-mix.mp3",
  "calm-beast-mahendere-master.mp3",
];

function titleFromFilename(filename: string) {
  return filename
    .replace(/\.[^.]+$/, "")
    .replace(/^pack\d+_/, "")
    .replace(/^\d+\.\s*/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function localTrackFromFile(file: string): StationTrack {
  const src = `/music/${encodeURIComponent(file)}`;
  return {
    title: titleFromFilename(file),
    artist: /wolfbrx/i.test(file) ? "Wolf Bridges" : "BVS archive",
    src,
    artwork: artworkForMusicSrc(src),
    project: projectNameForMusicSrc(src) || "BVS archive",
  };
}

/** Daily-stable shuffle so everyone hears a varied but consistent day order */
function shuffleDaily<T>(items: T[]): T[] {
  if (items.length < 2) return items;
  const day = new Date().toISOString().slice(0, 10);
  let seed = 0;
  for (let i = 0; i < day.length; i++) seed = (seed * 31 + day.charCodeAt(i)) >>> 0;
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const j = seed % (i + 1);
    ;[arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function orderLocalFiles(files: string[]): string[] {
  const available = new Set(files);
  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const file of curatedRotationFilenames()) {
    if (!available.has(file) || seen.has(file)) continue;
    seen.add(file);
    ordered.push(file);
  }
  for (const file of files.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))) {
    if (seen.has(file)) continue;
    seen.add(file);
    ordered.push(file);
  }
  return ordered;
}

/**
 * Continuous rotation:
 * 1) Approved + public + in_rotation tracks from Supabase (artist releases)
 * 2) House foundation library from public/music (scaffold)
 * Shuffled with daily seed for radio-like variety.
 */
export async function getStationTracks(): Promise<StationTrack[]> {
  const musicDir = path.join(process.cwd(), "public", "music");
  const onDisk = fs.existsSync(musicDir) ? fs.readdirSync(musicDir) : HOUSE_LIBRARY;
  const audioFiles = onDisk.filter((file) => AUDIO_EXTENSIONS.has(path.extname(file).toLowerCase()));

  // Prefer house set + curated; still include rest of disk for depth
  const housePreferred = HOUSE_LIBRARY.filter((f) => audioFiles.includes(f));
  const rest = audioFiles.filter((f) => !housePreferred.includes(f));
  const localFiles = orderLocalFiles([...housePreferred, ...rest]);
  const local = localFiles.map(localTrackFromFile);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return shuffleDaily(local);

  try {
    const response = await fetch(
      `${url}/rest/v1/tracks?in_rotation=eq.true&is_public=eq.true&editorial_status=eq.approved&select=id,title,artist_name,file_url,artwork_url,play_count,release_id&order=rotation_added_at.desc&limit=500`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        next: { revalidate: 60 },
      },
    );
    if (!response.ok) return shuffleDaily(local);
    const remote = (await response.json()) as Array<{
      id: string;
      title: string;
      artist_name: string;
      file_url: string;
      artwork_url?: string | null;
      play_count?: number;
      release_id?: string | null;
    }>;
    const remoteTracks: StationTrack[] = remote
      .filter((t) => t.file_url && !t.file_url.includes("scdn.co"))
      .map((track) => ({
        id: track.id,
        title: track.title,
        artist: track.artist_name,
        src: track.file_url,
        artwork: track.artwork_url || artworkForMusicSrc(track.file_url),
        project: track.release_id ? "Artist release" : undefined,
        playCount: Number(track.play_count || 0),
      }));

    const remoteSrcs = new Set(remoteTracks.map((t) => t.src));
    // Published artist catalogue first, then house foundation (deduped)
    const combined = [
      ...shuffleDaily(remoteTracks),
      ...shuffleDaily(local.filter((track) => !remoteSrcs.has(track.src))),
    ];
    return combined.length ? combined : shuffleDaily(local);
  } catch {
    return shuffleDaily(local);
  }
}
