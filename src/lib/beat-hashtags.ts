import { beatGenreKeys, beatGenreLabel } from "@/lib/beat-genre-normalization";
import { beatVibeKey, beatVibeTags } from "@/lib/beat-vibe-normalization";

/**
 * Hashtags for BeatStore beats, derived from data every beat already has, so
 * producers don't need to do anything: #new and #trending from publish date and
 * recent plays, then genre, vibe and tempo.
 */

export type BeatHashtagInput = {
  id: string | number;
  genre?: string | null;
  mood?: string | null;
  bpm?: string | number | null;
  publishedAt?: string | null;
  createdAt?: string | null;
};

export type BeatHashtag = { key: string; label: string };

export const NEW_BEAT_DAYS = 21;
const DAY = 24 * 60 * 60 * 1000;

function slug(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/&/g, "and").replace(/[^\p{L}\p{N}]+/gu, "");
}

/** The most-played beats of the last 30 days (needs at least `minPlays`). */
export function trendingBeatIds(scores: Record<string, number>, { max = 8, minPlays = 2 } = {}): Set<string> {
  return new Set(
    Object.entries(scores)
      .filter(([, plays]) => plays >= minPlays)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, max)
      .map(([id]) => id),
  );
}

function tempoTag(bpm: BeatHashtagInput["bpm"]): BeatHashtag | null {
  const value = Number(String(bpm ?? "").replace(/\s*bpm$/i, ""));
  if (!Number.isFinite(value) || value <= 0) return null;
  if (value < 90) return { key: "slow", label: "#slow" };
  if (value < 120) return { key: "midtempo", label: "#midtempo" };
  return { key: "uptempo", label: "#uptempo" };
}

export function isNewBeat(beat: BeatHashtagInput, now = Date.now()) {
  const published = Date.parse(beat.publishedAt || beat.createdAt || "");
  return Number.isFinite(published) && now - published >= 0 && now - published <= NEW_BEAT_DAYS * DAY;
}

/** All hashtags for one beat, most useful first and without duplicates. */
export function beatHashtags(beat: BeatHashtagInput, { trending = new Set<string>(), now = Date.now() }: { trending?: Set<string>; now?: number } = {}): BeatHashtag[] {
  const tags: BeatHashtag[] = [];
  if (isNewBeat(beat, now)) tags.push({ key: "new", label: "#new" });
  if (trending.has(String(beat.id))) tags.push({ key: "trending", label: "#trending" });
  for (const genre of beatGenreKeys(beat.genre || "")) {
    const key = slug(beatGenreLabel(genre));
    if (key) tags.push({ key, label: `#${key}` });
  }
  for (const vibe of beatVibeTags(beat.mood)) {
    const key = slug(beatVibeKey(vibe));
    if (key) tags.push({ key, label: `#${key}` });
  }
  const tempo = tempoTag(beat.bpm);
  if (tempo) tags.push(tempo);
  const seen = new Set<string>();
  return tags.filter((tag) => (seen.has(tag.key) ? false : (seen.add(tag.key), true)));
}

export function beatHasHashtag(beat: BeatHashtagInput, key: string, context: { trending?: Set<string>; now?: number } = {}) {
  const wanted = slug(key.replace(/^#/, ""));
  return Boolean(wanted) && beatHashtags(beat, context).some((tag) => tag.key === wanted);
}

/** Tags to offer above the grid: #new and #trending first, then the most common. */
export function popularBeatHashtags(beats: BeatHashtagInput[], context: { trending?: Set<string>; now?: number } = {}, limit = 10): BeatHashtag[] {
  const counts = new Map<string, { tag: BeatHashtag; count: number }>();
  for (const beat of beats) {
    for (const tag of beatHashtags(beat, context)) {
      const entry = counts.get(tag.key);
      if (entry) entry.count += 1;
      else counts.set(tag.key, { tag, count: 1 });
    }
  }
  const pinned = ["new", "trending"].map((key) => counts.get(key)?.tag).filter(Boolean) as BeatHashtag[];
  const rest = [...counts.values()]
    .filter((entry) => entry.tag.key !== "new" && entry.tag.key !== "trending")
    .sort((a, b) => b.count - a.count || a.tag.key.localeCompare(b.tag.key))
    .map((entry) => entry.tag);
  return [...pinned, ...rest].slice(0, limit);
}
