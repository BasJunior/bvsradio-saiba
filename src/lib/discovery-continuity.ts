export const appExploreKinds = ["all", "music", "artists", "producers", "beats"] as const;
export type AppExploreKind = typeof appExploreKinds[number];

export const appExploreModes = ["fresh", "rotation", "creators", "beats"] as const;
export type AppExploreMode = typeof appExploreModes[number];

export type AppExploreState = {
  query: string;
  kind: AppExploreKind;
  genre: string;
  mode: AppExploreMode;
};

export const appLibrarySections = ["all", "liked", "playlists", "downloads", "following", "recent"] as const;
export type AppLibrarySection = typeof appLibrarySections[number];

type SearchReader = Pick<URLSearchParams, "get">;

function memberOf<T extends string>(values: readonly T[], value: string | null, fallback: T): T {
  return value && values.includes(value as T) ? value as T : fallback;
}

export function readAppExploreState(params: SearchReader): AppExploreState {
  return {
    query: String(params.get("q") || "").slice(0, 160),
    kind: memberOf(appExploreKinds, params.get("kind"), "all"),
    genre: String(params.get("genre") || "").slice(0, 80),
    mode: memberOf(appExploreModes, params.get("mode"), "fresh"),
  };
}

export function appExploreStatePath(surface: "ios" | "android", state: AppExploreState, current = new URLSearchParams()) {
  const params = new URLSearchParams(current);
  for (const key of ["q", "kind", "genre", "mode"]) params.delete(key);
  const query = state.query.trim();
  if (query) params.set("q", query);
  if (state.kind !== "all") params.set("kind", state.kind);
  if (state.genre) params.set("genre", state.genre);
  if (!query && state.mode !== "fresh") params.set("mode", state.mode);
  return `/app/${surface}/explore${params.size ? `?${params}` : ""}`;
}

export function readAppLibrarySection(params: SearchReader): AppLibrarySection {
  return memberOf(appLibrarySections, params.get("section"), "all");
}

export function appLibrarySectionPath(surface: "ios" | "android", section: AppLibrarySection, current = new URLSearchParams()) {
  const params = new URLSearchParams(current);
  params.delete("section");
  if (section !== "all") params.set("section", section);
  return `/app/${surface}/library${params.size ? `?${params}` : ""}`;
}
