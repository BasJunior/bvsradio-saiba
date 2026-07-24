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

/** House / foundation set while artist catalogue is thin — only used when no editorial rotation exists */
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

function normalizeTitle(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
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

function publicStorageUrl(fileUrl: string) {
  if (!fileUrl) return "";
  if (/^https?:\/\//i.test(fileUrl)) return fileUrl;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return fileUrl;
  // Prefer public object path when stored as bare path in bucket
  const cleaned = fileUrl.replace(/^\/+/, "");
  if (cleaned.startsWith("storage/v1/")) return `${base}/${cleaned}`;
  return `${base}/storage/v1/object/public/bvsradio-audio/${cleaned}`;
}

function basenameFromUrl(url: string) {
  try {
    const pathPart = url.split("?")[0] || url;
    const name = decodeURIComponent(pathPart.split("/").pop() || "");
    return name.toLowerCase();
  } catch {
    return "";
  }
}

/**
 * Continuous rotation:
 * 1) Approved + public + in_rotation tracks from Supabase (editorial is source of truth)
 * 2) Only if no editorial rotation: house foundation from public/music
 * Never dump full disk library over rejected editorial rows.
 */
export async function getStationTracks(): Promise<StationTrack[]> {
  const musicDir = path.join(process.cwd(), "public", "music");
  const onDisk = fs.existsSync(musicDir) ? fs.readdirSync(musicDir) : HOUSE_LIBRARY;
  const audioFiles = onDisk.filter((file) => AUDIO_EXTENSIONS.has(path.extname(file).toLowerCase()));

  const housePreferred = HOUSE_LIBRARY.filter((f) => audioFiles.includes(f));
  const localFallbackFiles = orderLocalFiles(housePreferred.length ? housePreferred : audioFiles.slice(0, 40));
  const localFallback = localFallbackFiles.map(localTrackFromFile);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return shuffleDaily(localFallback);

  try {
    const headers = { apikey: key, Authorization: `Bearer ${key}` };
    const rotationRes = await fetch(
      `${url}/rest/v1/tracks?in_rotation=eq.true&is_public=eq.true&editorial_status=eq.approved&select=id,title,artist_name,file_url,artwork_url,play_count,release_id,genre&order=rotation_added_at.desc&limit=500`,
      { headers, next: { revalidate: 30 } },
    );

    if (!rotationRes.ok) return shuffleDaily(localFallback);

    const remote = (await rotationRes.json()) as Array<{
      id: string;
      title: string;
      artist_name: string;
      file_url: string;
      artwork_url?: string | null;
      play_count?: number;
      release_id?: string | null;
      genre?: string | null;
    }>;

    const remoteTracks: StationTrack[] = remote
      .filter((t) => Boolean(t.file_url) && !t.file_url.includes("scdn.co"))
      .map((track) => {
        const src = publicStorageUrl(track.file_url);
        return {
          id: track.id,
          title: track.title,
          artist: track.artist_name,
          src,
          artwork: track.artwork_url || artworkForMusicSrc(src) || undefined,
          project: track.release_id ? "Artist release" : track.genre || "BVS station",
          playCount: Number(track.play_count || 0),
          genre: track.genre || undefined,
        };
      })
      .filter((t) => Boolean(t.src));

    // Editorial has a live rotation → that IS the station. Do not append rejected house files.
    if (remoteTracks.length > 0) {
      return shuffleDaily(remoteTracks);
    }

    // No rotation rows: fall back to house files, but drop any filename that DB marks rejected / not public
    const blockRes = await fetch(
      `${url}/rest/v1/tracks?or=(editorial_status.eq.rejected,in_rotation.eq.false,is_public.eq.false)&select=title,file_url&limit=1000`,
      { headers, next: { revalidate: 60 } },
    );
    const blockedTitles = new Set<string>();
    const blockedFiles = new Set<string>();
    if (blockRes.ok) {
      const blocked = (await blockRes.json()) as Array<{ title?: string; file_url?: string }>;
      for (const row of blocked) {
        if (row.title) blockedTitles.add(normalizeTitle(row.title));
        const base = basenameFromUrl(row.file_url || "");
        if (base) blockedFiles.add(base);
      }
    }

    const filteredLocal = localFallback.filter((track) => {
      const base = basenameFromUrl(track.src);
      if (base && blockedFiles.has(base)) return false;
      if (blockedTitles.has(normalizeTitle(track.title))) return false;
      return true;
    });

    return shuffleDaily(filteredLocal.length ? filteredLocal : localFallback);
  } catch {
    return shuffleDaily(localFallback);
  }
}
