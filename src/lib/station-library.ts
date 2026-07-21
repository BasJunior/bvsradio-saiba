import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { StationTrack } from "./station";
import {
  artworkForMusicSrc,
  curatedRotationFilenames,
  externalProjectTracks,
  projectNameForMusicSrc,
} from "./music-projects";

const AUDIO_EXTENSIONS = new Set([".mp3", ".wav", ".m4a", ".ogg"]);

const DEPLOYED_LIBRARY = [
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
    project: projectNameForMusicSrc(src),
  };
}

function orderLocalFiles(files: string[]): string[] {
  const available = new Set(files);
  const ordered: string[] = [];
  const seen = new Set<string>();
  // Album/pack members first so covers and projects surface immediately
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

export async function getStationTracks(): Promise<StationTrack[]> {
  const musicDir = path.join(process.cwd(), "public", "music");
  const onDisk = fs.existsSync(musicDir) ? fs.readdirSync(musicDir) : DEPLOYED_LIBRARY;
  const audioFiles = onDisk.filter((file) => AUDIO_EXTENSIONS.has(path.extname(file).toLowerCase()));
  const local = orderLocalFiles(audioFiles).map(localTrackFromFile);

  // Spotify project previews with their release covers (after local album tracks)
  const external: StationTrack[] = externalProjectTracks.map((track) => ({
    id: `ext-${track.id}`,
    title: track.title,
    artist: track.artist,
    src: track.src,
    artwork: track.artwork,
    project: track.project,
  }));

  const combined = [...local, ...external];

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return combined;

  try {
    const response = await fetch(
      `${url}/rest/v1/tracks?in_rotation=eq.true&is_public=eq.true&editorial_status=eq.approved&select=id,title,artist_name,file_url,artwork_url,play_count&order=rotation_added_at.desc`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        next: { revalidate: 60 },
      },
    );
    if (!response.ok) return combined;
    const remote = (await response.json()) as Array<{
      id: string;
      title: string;
      artist_name: string;
      file_url: string;
      artwork_url?: string | null;
      play_count?: number;
    }>;
    const remoteTracks: StationTrack[] = remote.map((track) => ({
      id: track.id,
      title: track.title,
      artist: track.artist_name,
      src: track.file_url,
      artwork: track.artwork_url || artworkForMusicSrc(track.file_url),
      playCount: Number(track.play_count || 0),
    }));
    const remoteSrcs = new Set(remoteTracks.map((t) => t.src));
    return [
      ...remoteTracks,
      ...combined.filter((track) => !remoteSrcs.has(track.src)),
    ];
  } catch {
    return combined;
  }
}
