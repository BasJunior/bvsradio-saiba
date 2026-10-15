export type ProgrammeItem = {
  id: string;
  kind: string;
  title: string;
  artist: string;
  src: string;
  artwork: string;
  trackId: string | null;
  startedAt: string | null;
  durationSeconds: number;
  segmentId: string | null;
};

export type ProgrammeSnapshot = {
  onAir: boolean;
  serverNow: string | null;
  liveStreamUrl: string | null;
  outputMode: string | null;
  item: ProgrammeItem | null;
  upNext: Array<{ id: string; kind: string; title: string; artist: string }>;
};

export type FollowDecision =
  | { action: "local" }
  | { action: "wait"; itemId: string }
  | {
      action: "follow";
      itemId: string;
      src: string;
      seekSeconds: number | null;
      replaceAudio: boolean;
      title: string;
      artist: string;
      trackId?: string;
      artwork: string;
      kind: string;
      upNext: ProgrammeSnapshot["upNext"];
      note: string;
    };

/** Public listener URL only. Source credentials never pass this gate. */
export function publicStreamUrl(value: unknown) {
  if (!value) return null;
  try {
    const url = new URL(String(value));
    if (url.username || url.password) return null;
    if (url.protocol === "https:") return url.toString();
    if (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)) return url.toString();
    return null;
  } catch {
    return null;
  }
}

function hostTitle(kind: string) {
  if (kind === "guest") return "BVS guest";
  if (kind === "human_voice") return "BVS presenter";
  return "BVS host";
}

export function presentProgramme(snapshot: {
  onAir?: boolean;
  serverNow?: string | null;
  liveStreamUrl?: string | null;
  live_stream_public_url?: string | null;
  outputMode?: string | null;
  item?: Record<string, unknown> | null;
  upNext?: Array<Record<string, unknown>> | null;
} | null): ProgrammeSnapshot {
  const empty: ProgrammeSnapshot = { onAir: false, item: null, upNext: [], serverNow: null, liveStreamUrl: null, outputMode: null };
  if (!snapshot || typeof snapshot !== "object") return empty;
  const liveStreamUrl = publicStreamUrl(snapshot.liveStreamUrl || snapshot.live_stream_public_url);
  const current = snapshot.item && typeof snapshot.item.kind === "string" ? snapshot.item : null;
  const kind = String(current?.kind || "");
  const music = kind === "music";
  const segmentId = typeof current?.segmentId === "string" ? current.segmentId : null;
  const audioRef = typeof current?.audioRef === "string" ? current.audioRef : "";
  const item: ProgrammeItem | null = current ? {
    id: String(current.id || ""),
    kind,
    title: music ? String(current.title || "") : hostTitle(kind),
    artist: music ? String(current.artistName || current.artist || "") : "BVS Radio",
    src: music ? audioRef : audioRef && segmentId ? `/api/station/voice/${segmentId}` : "",
    artwork: typeof current.artwork === "string" ? current.artwork : "",
    trackId: music && typeof current.trackId === "string" ? current.trackId : null,
    startedAt: typeof current.startedAt === "string" ? current.startedAt : null,
    durationSeconds: Number(current.durationSeconds) || 0,
    segmentId,
  } : null;
  const visible = item?.src ? item : null;
  return {
    onAir: Boolean(snapshot.onAir && visible),
    serverNow: typeof snapshot.serverNow === "string" ? snapshot.serverNow : null,
    liveStreamUrl,
    outputMode: typeof snapshot.outputMode === "string" ? snapshot.outputMode : null,
    item: visible,
    upNext: (snapshot.upNext || []).slice(0, 8).map((entry) => ({
      id: String(entry.id || ""),
      kind: String(entry.kind || ""),
      title: entry.kind === "music" ? String(entry.title || "") : hostTitle(String(entry.kind || "")),
      artist: entry.kind === "music" ? String(entry.artistName || entry.artist || "") : "BVS Radio",
    })),
  };
}

export function followSharedProgramme({
  mode,
  leftStation,
  snapshot,
  previousItemId,
  liveSrc,
}: {
  mode: string;
  leftStation: boolean;
  snapshot: ProgrammeSnapshot | null;
  previousItemId: string | null;
  liveSrc?: string | null;
}): FollowDecision {
  if (leftStation || mode !== "station" || !snapshot?.onAir || !snapshot.item?.src) return { action: "local" };
  const item = snapshot.item;
  const live = Boolean(snapshot.liveStreamUrl);
  const src = live ? snapshot.liveStreamUrl || "" : item.src;
  const elapsed = Math.max(0, (Date.parse(snapshot.serverNow || "") - Date.parse(item.startedAt || "")) / 1000);
  if (!live && !Number.isFinite(elapsed)) return { action: "wait", itemId: item.id };
  if (!live && item.durationSeconds > 0 && elapsed > item.durationSeconds - 0.4) return { action: "wait", itemId: item.id };
  const sameLive = live && liveSrc === src;
  return {
    action: "follow",
    itemId: item.id,
    src,
    seekSeconds: live ? null : Math.min(elapsed, Math.max(0, item.durationSeconds - 0.5)),
    replaceAudio: !sameLive && previousItemId !== item.id,
    title: item.title,
    artist: item.artist,
    trackId: item.kind === "music" && item.trackId ? item.trackId : undefined,
    artwork: item.artwork || "",
    kind: item.kind,
    upNext: snapshot.upNext,
    note: item.kind === "music" ? "Shared BVS programme" : "BVS host · shared programme",
  };
}
