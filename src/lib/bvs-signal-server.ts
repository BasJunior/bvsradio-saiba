import "server-only";

import { deriveBvsSignal } from "@/lib/bvs-signal";
import { creatorHeaders, creatorUrl } from "@/lib/creator-server";
import { UUID } from "@/lib/creator-promotion-server";

export type BvsCatchSource = "station" | "song" | "share" | "explore" | "unknown";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const AUTH_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const CATCH_SOURCES = new Set<BvsCatchSource>(["station", "song", "share", "explore", "unknown"]);

type PublicTrack = {
  id: string;
  in_rotation?: boolean | null;
  rotation_added_at?: string | null;
};

type SignalConfig = {
  track_id: string;
  first_spin_scheduled_at?: string | null;
  editorial_reason?: string | null;
  breakout_at?: string | null;
};

type SpinProof = {
  track_id: string;
  first_spin_played_at?: string | null;
};

type CatchRow = {
  id: number;
  track_id: string;
  user_id: string;
  created_at: string;
};

async function authUser(token: string) {
  if (!token || !SUPABASE_URL || !AUTH_KEY) return null;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: AUTH_KEY, Authorization: `Bearer ${token}` },
    cache: "no-store",
  }).catch(() => null);
  if (!response?.ok) return null;
  return (await response.json()) as { id: string };
}

async function rows<T>(path: string): Promise<{ ok: boolean; rows: T[] }> {
  const response = await fetch(creatorUrl(path), {
    headers: creatorHeaders,
    cache: "no-store",
  }).catch(() => null);
  if (!response?.ok) return { ok: false, rows: [] };
  const payload = await response.json().catch(() => []);
  return { ok: true, rows: Array.isArray(payload) ? (payload as T[]) : [] };
}

async function exactCount(path: string): Promise<{ ok: boolean; count: number }> {
  const response = await fetch(creatorUrl(path), {
    headers: { ...creatorHeaders, Prefer: "count=exact", Range: "0-0" },
    cache: "no-store",
  }).catch(() => null);
  if (!response?.ok) return { ok: false, count: 0 };
  const range = response.headers.get("content-range") || "";
  const total = Number(range.split("/").pop());
  return { ok: true, count: Number.isFinite(total) ? total : 0 };
}

async function publicTrack(trackId: string) {
  const result = await rows<PublicTrack>(
    `tracks?id=eq.${encodeURIComponent(trackId)}&is_public=eq.true&editorial_status=eq.approved&select=id,in_rotation,rotation_added_at&limit=1`,
  );
  return result.rows[0] || null;
}

export async function getPublicTrackSignal(trackId: string, bearerToken = "") {
  if (!UUID.test(trackId)) return null;
  const track = await publicTrack(trackId);
  if (!track) return null;

  const [configResult, spinResult, catchCountResult] = await Promise.all([
    rows<SignalConfig>(
      `track_signal_config?track_id=eq.${encodeURIComponent(trackId)}&select=track_id,first_spin_scheduled_at,editorial_reason,breakout_at&limit=1`,
    ),
    rows<SpinProof>(
      `track_first_station_spin?track_id=eq.${encodeURIComponent(trackId)}&select=track_id,first_spin_played_at&limit=1`,
    ),
    exactCount(`track_catches?track_id=eq.${encodeURIComponent(trackId)}&select=id`),
  ]);

  const config = configResult.rows[0];
  const spin = spinResult.rows[0];
  const user = bearerToken ? await authUser(bearerToken) : null;
  let caughtAt: string | null = null;
  let catchPosition: number | null = null;

  if (user?.id && catchCountResult.ok) {
    const caught = await rows<CatchRow>(
      `track_catches?track_id=eq.${encodeURIComponent(trackId)}&user_id=eq.${encodeURIComponent(user.id)}&select=id,track_id,user_id,created_at&limit=1`,
    );
    caughtAt = caught.rows[0]?.created_at || null;
    if (caughtAt) {
      const position = await exactCount(
        `track_catches?track_id=eq.${encodeURIComponent(trackId)}&created_at=lte.${encodeURIComponent(caughtAt)}&select=id`,
      );
      catchPosition = position.ok ? Math.max(1, position.count) : null;
    }
  }

  const catchCount = catchCountResult.count;
  const signal = deriveBvsSignal({
    firstSpinScheduledAt: config?.first_spin_scheduled_at,
    firstSpinPlayedAt: spin?.first_spin_played_at,
    breakoutAt: config?.breakout_at,
    inRotation: Boolean(track.in_rotation),
    catchCount,
  });

  return {
    available: configResult.ok && spinResult.ok && catchCountResult.ok,
    trackId,
    status: signal.status,
    label: signal.label,
    inRotation: Boolean(track.in_rotation),
    rotationAddedAt: track.rotation_added_at || null,
    firstSpinScheduledAt: config?.first_spin_scheduled_at || null,
    firstSpinPlayedAt: spin?.first_spin_played_at || null,
    editorialReason: config?.editorial_reason || null,
    breakoutAt: config?.breakout_at || null,
    catchCount,
    caught: Boolean(caughtAt),
    caughtAt,
    catchPosition,
  };
}

export async function catchPublicTrack(request: Request, trackId: string, requestedSource: string) {
  if (!UUID.test(trackId)) return { status: 400, body: { error: "Invalid track." } };
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return { status: 401, body: { error: "Sign in to Catch this track." } };
  const user = await authUser(token);
  if (!user?.id) return { status: 401, body: { error: "Session expired. Sign in again." } };
  if (!(await publicTrack(trackId))) return { status: 404, body: { error: "Track unavailable." } };

  const source = CATCH_SOURCES.has(requestedSource as BvsCatchSource)
    ? (requestedSource as BvsCatchSource)
    : "unknown";

  const insert = await fetch(
    creatorUrl("track_catches?on_conflict=track_id,user_id"),
    {
      method: "POST",
      headers: { ...creatorHeaders, Prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify({ track_id: trackId, user_id: user.id, source }),
    },
  ).catch(() => null);

  if (!insert?.ok) {
    return { status: 503, body: { error: "BVS Signal is not available yet." } };
  }

  const signal = await getPublicTrackSignal(trackId, token);
  return signal
    ? { status: 200, body: signal }
    : { status: 404, body: { error: "Track unavailable." } };
}
