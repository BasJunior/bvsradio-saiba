export type SearchSurface = "ios" | "android" | null;
export type SearchSuggestion = { id: string; title: string; subtitle: string; href: string; kind: string };
type Creator = { id: string; name: string; username: string; role?: string; beatCount?: number };
type Beat = { id: string; title: string; producer?: string };
type Track = { id: string; title: string; artist: string };

export function searchPageHref(query: string, surface: SearchSurface, kind?: "music") {
  const params = new URLSearchParams({ q: query.trim() });
  if (surface && kind) params.set("kind", kind);
  return `${surface ? `/app/${surface}/explore` : "/search"}?${params}`;
}

// Published identities only: do not invent slugs from display names.
export function buildSearchSuggestions(data: { artists?: Creator[]; producers?: Creator[]; beats?: Beat[]; tracks?: Track[] }, surface: SearchSurface): SearchSuggestion[] {
  const creatorHref = (item: Creator, producer = false) => surface
    ? `/app/${surface}/creator/${encodeURIComponent(item.id)}${producer ? "?as=producer" : ""}`
    : `/artist/${encodeURIComponent(item.username)}`;
  return [
    ...(data.artists || []).filter((item) => item.id && item.username).map((item) => ({ id: `artist-${item.id}`, title: item.name, subtitle: item.role || "Published artist", kind: "Artist", href: creatorHref(item) })),
    ...(data.producers || []).filter((item) => item.id && item.username).map((item) => ({ id: `producer-${item.id}`, title: item.name, subtitle: `${item.beatCount || 0} published beats`, kind: "Producer", href: creatorHref(item, true) })),
    ...(data.tracks || []).filter((item) => item.id && item.title).map((item) => ({ id: `track-${item.id}`, title: item.title, subtitle: item.artist, kind: "Music", href: surface ? searchPageHref(item.title, surface, "music") : `/catalogue?q=${encodeURIComponent(item.title)}` })),
    ...(data.beats || []).filter((item) => item.id && item.title).map((item) => ({ id: `beat-${item.id}`, title: item.title, subtitle: item.producer || "BVS BeatStore", kind: "Beat", href: `${surface ? `/app/${surface}` : ""}/beat/${encodeURIComponent(item.id)}` })),
  ];
}

export function filterSearchSuggestions(items: SearchSuggestion[], query: string) {
  const needle = query.trim().toLowerCase();
  if (needle.length < 2) return [];
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.kind}:${item.href}`;
    if (seen.has(key) || !`${item.title} ${item.subtitle} ${item.kind}`.toLowerCase().includes(needle)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => Number(b.title.toLowerCase().startsWith(needle)) - Number(a.title.toLowerCase().startsWith(needle))).slice(0, 8);
}
