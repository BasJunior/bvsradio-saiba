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

/**
 * Last-resort house files ONLY when Supabase returns zero in-rotation rows.
 * Never mixed with editorial rotation.
 */
const HOUSE_LIBRARY = [
  "calm-beast-mahendere-master.mp3",
  "bvs-radio-ab2c-mix.mp3",
  "bvs-radio-starve.mp3",
  "bvs-radio-on-the-moon-mix.mp3",
  "bvs-party-tarpy-mix.mp3",
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
    project: projectNameForMusicSrc(src) || "BVS station",
  };
}

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
  const cleaned = fileUrl.replace(/^\/+/, "");
  if (cleaned.startsWith("storage/v1/")) return `${base}/${cleaned}`;
  // Local public path already hosted by Next
  if (cleaned.startsWith("music/")) return `/${cleaned}`;
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

/** Rejected / demo archive names that must never auto-play once editorial is live. */
const BLOCKED_HOUSE_SUBSTRINGS = [
  "want sumo",
  "never ending",
  "having fun",
  "uptown wins",
  "whills brx deep",
  "sad addict",
  "slide mix",
  "nerve mix",
  "robert gabriel",
  "mugabe",
  "demo",
];

function isBlockedHouseTitle(title: string) {
  const n = normalizeTitle(title);
  return BLOCKED_HOUSE_SUBSTRINGS.some((s) => n.includes(s));
}

/**
 * Continuous rotation:
 * 1) ONLY approved + public + in_rotation Supabase tracks when any exist
 * 2) Tiny house fallback only if rotation is empty (and still filter demos)
 */
export async function getStationTracks(): Promise<StationTrack[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const musicDir = path.join(process.cwd(), "public", "music");
  const onDisk = fs.existsSync(musicDir) ? fs.readdirSync(musicDir) : HOUSE_LIBRARY;
  const audioFiles = onDisk.filter((file) => AUDIO_EXTENSIONS.has(path.extname(file).toLowerCase()));
  const housePreferred = HOUSE_LIBRARY.filter((f) => audioFiles.includes(f));
  const localFallbackFiles = orderLocalFiles(housePreferred.length ? housePreferred : []);
  const localFallback = localFallbackFiles
    .map(localTrackFromFile)
    .filter((t) => !isBlockedHouseTitle(t.title));

  if (!url || !key) {
    console.warn("getStationTracks: missing Supabase env — using filtered house fallback");
    return shuffleDaily(localFallback);
  }

  try {
    const headers = {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
    };
    const rotationRes = await fetch(
      `${url}/rest/v1/tracks?in_rotation=eq.true&is_public=eq.true&editorial_status=eq.approved&select=id,title,artist_name,file_url,artwork_url,play_count,release_id,genre&order=rotation_added_at.desc&limit=500`,
      { headers, cache: "no-store" },
    );

    if (!rotationRes.ok) {
      console.error("getStationTracks rotation query failed", rotationRes.status, await rotationRes.text().catch(() => ""));
      return shuffleDaily(localFallback);
    }

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
      .filter((t) => Boolean(t.file_url) && !String(t.file_url).includes("scdn.co"))
      .map((track) => {
        const src = publicStorageUrl(track.file_url);
        return {
          id: track.id,
          title: track.title,
          artist: track.artist_name || "BVS Radio",
          src,
          artwork: track.artwork_url || artworkForMusicSrc(src) || undefined,
          project: track.release_id ? "Artist release" : "BVS Station",
          playCount: Number(track.play_count || 0),
          genre: track.genre || undefined,
        };
      })
      .filter((t) => Boolean(t.src));

    // Source of truth: editorial rotation only. Never append disk archive on top.
    if (remoteTracks.length > 0) {
      return shuffleDaily(remoteTracks);
    }

    // Empty rotation — filter house against rejected DB titles
    const blockRes = await fetch(
      `${url}/rest/v1/tracks?or=(editorial_status.eq.rejected,in_rotation.eq.false)&select=title,file_url&limit=1000`,
      { headers, cache: "no-store" },
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
      if (isBlockedHouseTitle(track.title)) return false;
      const base = basenameFromUrl(track.src);
      if (base && blockedFiles.has(base)) return false;
      if (blockedTitles.has(normalizeTitle(track.title))) return false;
      return true;
    });

    return shuffleDaily(filteredLocal);
  } catch (error) {
    console.error("getStationTracks", error);
    return shuffleDaily(localFallback);
  }
}
