import type { StationTrack } from "@/lib/station";

/** Guest BeatStore listens stop here. Signed-in members hear the full file. */
export const GUEST_BEAT_PREVIEW_SECONDS = 45;

export function isBeatTrack(track?: Pick<StationTrack, "kind" | "project"> | null) {
  if (!track) return false;
  return track.kind === "beat" || track.project === "BVS BeatStore";
}

export function toBeatStationTrack(input: {
  id?: string;
  title?: string;
  producer?: string;
  artist?: string;
  previewUrl?: string;
  src?: string;
  artworkUrl?: string;
  artwork?: string;
  genre?: string;
}): StationTrack | null {
  const src = input.previewUrl || input.src;
  if (!src || !input.title) return null;
  return {
    id: input.id,
    title: input.title,
    artist: input.producer || input.artist || "BVS producer",
    src,
    artwork: input.artworkUrl || input.artwork,
    project: "BVS BeatStore",
    genre: input.genre,
    kind: "beat",
  };
}

export async function fetchRelatedBeats(current: StationTrack): Promise<StationTrack[]> {
  try {
    const response = await fetch("/api/beats", { cache: "no-store" });
    if (!response.ok) return [];
    const payload = (await response.json()) as {
      beats?: Array<{
        id?: string;
        title?: string;
        producer?: string;
        previewUrl?: string;
        artworkUrl?: string;
        genre?: string;
      }>;
    };
    return (payload.beats || [])
      .map((beat) => toBeatStationTrack(beat))
      .filter((track): track is StationTrack => Boolean(track && track.src && track.id !== current.id));
  } catch {
    return [];
  }
}
