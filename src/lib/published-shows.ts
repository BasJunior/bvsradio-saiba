import "server-only";
import { mediaUrlForStoredValue } from "@/lib/media-url";
import type { Show } from "@/lib/station";

export type PublishedEpisode = {
  id: string;
  title: string;
  description: string;
  episodeNumber: number | null;
  audioUrl: string;
  durationLabel: string | null;
};

type CreatorRow = {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  artwork_url?: string | null;
  category?: string | null;
  cadence?: string | null;
};

type EpisodeRow = {
  id: string;
  show_id: string;
  title: string;
  description?: string | null;
  episode_number?: number | null;
  audio_path?: string | null;
  duration_seconds?: number | null;
};

const SLUG = /^[a-z0-9-]{1,80}$/;

function service() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url, headers: { apikey: key, Authorization: `Bearer ${key}` } };
}

function durationLabel(seconds?: number | null) {
  if (!seconds || seconds < 1) return null;
  const mins = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${mins}:${String(rest).padStart(2, "0")}`;
}

function cadenceLabel(cadence?: string | null) {
  const value = String(cadence || "weekly").replace(/_/g, " ");
  return `${value.charAt(0).toUpperCase()}${value.slice(1)} · CAT`;
}

function toShow(row: CreatorRow, published: boolean): Show {
  return {
    slug: row.slug,
    title: row.title,
    tagline: row.category || "BVS show",
    description: row.description || "",
    image: row.artwork_url || "/images/editorial/radio-studio-harare.webp",
    host: "BVS desk",
    schedule: cadenceLabel(row.cadence),
    status: published ? "active" : "preview",
  };
}

async function approvedCreators(): Promise<CreatorRow[]> {
  const setup = service();
  if (!setup) return [];
  try {
    const response = await fetch(
      `${setup.url}/rest/v1/show_creator_profiles?status=eq.approved&select=id,title,slug,description,artwork_url,category,cadence&order=title.asc`,
      { headers: setup.headers, next: { revalidate: 60 }, signal: AbortSignal.timeout(4000) },
    );
    if (!response.ok) return [];
    const rows = (await response.json()) as CreatorRow[];
    return rows.filter((row) => SLUG.test(row.slug));
  } catch {
    return [];
  }
}

async function publishedEpisodes(showIds: string[]): Promise<EpisodeRow[]> {
  const setup = service();
  if (!setup || !showIds.length) return [];
  try {
    const response = await fetch(
      `${setup.url}/rest/v1/show_episodes?status=eq.published&show_id=in.(${showIds.join(",")})&select=id,show_id,title,description,episode_number,audio_path,duration_seconds&order=episode_number.asc`,
      { headers: setup.headers, next: { revalidate: 60 }, signal: AbortSignal.timeout(4000) },
    );
    if (!response.ok) return [];
    return (await response.json()) as EpisodeRow[];
  } catch {
    return [];
  }
}

export async function getPublishedCreatorShows(): Promise<Show[]> {
  const creators = await approvedCreators();
  if (!creators.length) return [];
  const episodes = await publishedEpisodes(creators.map((row) => row.id));
  const withAudio = new Set(
    episodes.filter((row) => mediaUrlForStoredValue(row.audio_path)).map((row) => row.show_id),
  );
  return creators.map((row) => toShow(row, withAudio.has(row.id)));
}

export async function getPublishedEpisodes(slug: string): Promise<PublishedEpisode[]> {
  if (!SLUG.test(slug)) return [];
  const creators = await approvedCreators();
  const show = creators.find((row) => row.slug === slug);
  if (!show) return [];
  const episodes = await publishedEpisodes([show.id]);
  return episodes.flatMap((row) => {
    const audioUrl = mediaUrlForStoredValue(row.audio_path);
    if (!audioUrl) return [];
    return [{
      id: row.id,
      title: row.title,
      description: row.description || "",
      episodeNumber: row.episode_number ?? null,
      audioUrl,
      durationLabel: durationLabel(row.duration_seconds),
    }];
  });
}
