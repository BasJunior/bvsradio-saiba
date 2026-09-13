export type PlaylistItemKind = "track" | "beat";

export function playlistItemKey(kind: PlaylistItemKind, id: string) {
  return `${kind}:${id}`;
}

export function parsePlaylistItemKey(value: string): { kind: PlaylistItemKind; id: string } | null {
  const separator = value.indexOf(":");
  if (separator <= 0 || separator === value.length - 1) return null;
  const kind = value.slice(0, separator);
  const id = value.slice(separator + 1).trim();
  if ((kind !== "track" && kind !== "beat") || !id) return null;
  return { kind, id };
}
