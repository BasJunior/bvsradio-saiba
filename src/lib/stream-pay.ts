/** Pure monthly stream pay rules: base rate per counted listen plus a capped share of the pot. */

export const STREAM_PAY_RULES_VERSION = "stream-pay-2026-11-10";
export const MAX_DAILY_PLAYS_PER_SONG = 3;
export const MIN_LISTENERS_FOR_POT = 3;

export type StreamPaySettings = { baseRateUsd: number; monthlyPotUsd: number; maxArtistPotShare: number; reviewDays: number };
export const DEFAULT_STREAM_PAY_SETTINGS: StreamPaySettings = { baseRateUsd: 0.00025, monthlyPotUsd: 5, maxArtistPotShare: 0.2, reviewDays: 7 };

export type StreamListen = { track_id: string; user_id?: string | null; listener_key?: string | null; qualified_at: string };
export type StreamTrack = { id: string; user_id?: string | null; release_id?: string | null; artist_name?: string | null };
export type StreamDeclaration = { release_id?: string | null; track_id?: string | null; society_status?: string | null; grant_accepted_at?: string | null; spot_check_result?: string | null; clearance_basis?: string | null };
export type PotStatus = "sharing" | "staff" | "too_few_listeners" | "not_confirmed";
export type StreamPayLine = { artistUserId: string; artistName: string; listens: number; listeners: number; potListens: number; potStatus: PotStatus; baseUsd: number; potUsd: number; totalUsd: number };
export type ExcludedCounts = { staff_listener: number; own_music: number; repeat_limit: number; no_artist_account: number };

export function cleanStreamPaySettings(value: unknown): StreamPaySettings {
  const row = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const read = (key: keyof StreamPaySettings, min: number, max: number) => {
    const amount = Number(row[key]);
    return Number.isFinite(amount) && amount >= min && amount <= max ? amount : DEFAULT_STREAM_PAY_SETTINGS[key];
  };
  return { baseRateUsd: read("baseRateUsd", 0, 0.05), monthlyPotUsd: read("monthlyPotUsd", 0, 100000), maxArtistPotShare: read("maxArtistPotShare", 0.01, 1), reviewDays: Math.round(read("reviewDays", 0, 60)) };
}

/** A confirmed track can share the pot unless a society match has no consent or licence on file. */
export function canSharePot(declaration?: StreamDeclaration | null) {
  if (!declaration?.grant_accepted_at) return false;
  if (!["none", "member", "unsure"].includes(String(declaration.society_status))) return false;
  return declaration.spot_check_result !== "found" || Boolean(declaration.clearance_basis);
}

const floorCents = (value: number) => Math.floor((value + 1e-9) * 100) / 100;

/** Shares the pot by listens, holding anyone over the cap at the cap and sharing the excess among the rest. */
export function allocatePot(weights: Map<string, number>, pot: number, maxShare: number) {
  const result = new Map<string, number>();
  const cap = pot * maxShare;
  let open = [...weights.entries()].filter(([, weight]) => weight > 0);
  let remaining = pot;
  while (open.length && remaining > 1e-9) {
    const total = open.reduce((sum, [, weight]) => sum + weight, 0);
    const over = open.filter(([id, weight]) => (result.get(id) || 0) + (remaining * weight) / total > cap + 1e-9);
    if (!over.length) {
      for (const [id, weight] of open) result.set(id, (result.get(id) || 0) + (remaining * weight) / total);
      remaining = 0;
      break;
    }
    for (const [id] of over) {
      remaining -= cap - (result.get(id) || 0);
      result.set(id, cap);
    }
    const capped = new Set(over.map(([id]) => id));
    open = open.filter(([id]) => !capped.has(id));
  }
  return result;
}

export function calculateStreamPay(input: { listens: StreamListen[]; tracks: StreamTrack[]; staffIds: Set<string>; declarations: StreamDeclaration[]; settings: StreamPaySettings; potUsd: number }) {
  const tracks = new Map(input.tracks.map((track) => [track.id, track]));
  const byTrack = new Map(input.declarations.filter((row) => row.track_id).map((row) => [row.track_id as string, row]));
  const byRelease = new Map(input.declarations.filter((row) => row.release_id).map((row) => [row.release_id as string, row]));
  const excluded: ExcludedCounts = { staff_listener: 0, own_music: 0, repeat_limit: 0, no_artist_account: 0 };
  const dailyPlays = new Map<string, number>();
  const artists = new Map<string, { name: string; listens: number; potListens: number; listeners: Set<string> }>();
  const ordered = [...input.listens].sort((a, b) => a.qualified_at.localeCompare(b.qualified_at));
  let counted = 0;

  for (const listen of ordered) {
    const track = tracks.get(listen.track_id);
    const owner = track?.user_id || "";
    if (!owner) { excluded.no_artist_account += 1; continue; }
    if (listen.user_id && input.staffIds.has(listen.user_id)) { excluded.staff_listener += 1; continue; }
    if (listen.user_id && listen.user_id === owner) { excluded.own_music += 1; continue; }
    const listener = listen.user_id || listen.listener_key || "guest";
    const key = `${listener}|${listen.track_id}|${listen.qualified_at.slice(0, 10)}`;
    const plays = (dailyPlays.get(key) || 0) + 1;
    dailyPlays.set(key, plays);
    if (plays > MAX_DAILY_PLAYS_PER_SONG) { excluded.repeat_limit += 1; continue; }
    const row = artists.get(owner) || { name: track?.artist_name || "Unknown artist", listens: 0, potListens: 0, listeners: new Set<string>() };
    row.listens += 1;
    row.listeners.add(listener);
    if (canSharePot(byTrack.get(listen.track_id) || (track?.release_id ? byRelease.get(track.release_id) : undefined))) row.potListens += 1;
    artists.set(owner, row);
    counted += 1;
  }

  const status = (id: string, row: { listeners: Set<string>; potListens: number }): PotStatus => {
    if (input.staffIds.has(id)) return "staff";
    if (row.listeners.size < MIN_LISTENERS_FOR_POT) return "too_few_listeners";
    return row.potListens > 0 ? "sharing" : "not_confirmed";
  };
  const weights = new Map([...artists.entries()].filter(([id, row]) => status(id, row) === "sharing").map(([id, row]) => [id, row.potListens]));
  const shares = allocatePot(weights, input.potUsd, input.settings.maxArtistPotShare);
  const lines: StreamPayLine[] = [...artists.entries()].map(([id, row]) => {
    const baseUsd = row.listens * input.settings.baseRateUsd;
    const potUsd = floorCents(shares.get(id) || 0);
    return { artistUserId: id, artistName: row.name, listens: row.listens, listeners: row.listeners.size, potListens: row.potListens, potStatus: status(id, row), baseUsd, potUsd, totalUsd: floorCents(baseUsd + potUsd) };
  }).sort((a, b) => b.totalUsd - a.totalUsd || b.listens - a.listens);

  const potPaidUsd = Math.round(lines.reduce((sum, line) => sum + line.potUsd, 0) * 100) / 100;
  return {
    lines,
    excluded,
    countedListens: counted,
    potPaidUsd,
    potRolloverUsd: Math.max(0, Math.round((input.potUsd - potPaidUsd) * 100) / 100),
    totalPaidUsd: Math.round(lines.reduce((sum, line) => sum + line.totalUsd, 0) * 100) / 100,
  };
}

export function monthBounds(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return null;
  const [year, value] = month.split("-").map(Number);
  return { start: `${month}-01`, startIso: new Date(Date.UTC(year, value - 1, 1)).toISOString(), endIso: new Date(Date.UTC(year, value, 1)).toISOString() };
}
