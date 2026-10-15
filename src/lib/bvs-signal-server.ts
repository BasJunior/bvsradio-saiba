
import "server-only";
import { presentBvsSignal, type BvsSignalSnapshot } from "@/lib/bvs-signal";
import { creatorHeaders, creatorUrl } from "@/lib/creator-server";
import { UUID } from "@/lib/creator-promotion-server";
const CATCH_SOURCES = new Set(["station", "song", "share", "explore", "unknown"]);

export async function signalRpc<T>(name: string, body: Record<string, unknown>): Promise<{ ok: boolean; data: T | null; conflict: boolean }> {
  const response = await fetch(creatorUrl(`rpc/${name}`), {
    method: "POST", headers: creatorHeaders, body: JSON.stringify(body),
    cache: "no-store", signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  const payload = await response?.json().catch(() => null);
  return {
    ok: Boolean(response?.ok), data: response?.ok ? payload as T : null,
    conflict: !response?.ok && typeof payload?.message === "string" && payload.message.includes("conflict"),
  };
}
async function authUser(token: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!token || !url || !key) return null;
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: key, Authorization: `Bearer ${token}` },
    cache: "no-store", signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!response?.ok) return null;
  const user = await response.json().catch(() => null) as { id?: string; is_anonymous?: boolean } | null;
  return user?.id && UUID.test(user.id) && !user.is_anonymous ? { id: user.id } : null;
}
export async function getPublicTrackSignal(trackId: string, bearerToken = "") {
  if (!UUID.test(trackId)) return { status: 400, body: { error: "Invalid track." } };
  const user = bearerToken ? await authUser(bearerToken) : null;
  if (bearerToken && !user) return { status: 401, body: { error: "Sign in again to see your Catch." } };
  const result = await signalRpc<BvsSignalSnapshot>("bvs_signal_snapshot", { p_track_id: trackId, p_user_id: user?.id ?? null });
  if (!result.ok) return { status: 503, body: { error: "Signal is temporarily unavailable." } };
  if (!result.data) return { status: 404, body: { error: "Track unavailable." } };
  return { status: 200, body: presentBvsSignal(result.data) };
}
export async function catchPublicTrack(request: Request, trackId: string, requestedSource: string) {
  if (!UUID.test(trackId)) return { status: 400, body: { error: "Invalid track." } };
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const user = await authUser(token);
  if (!user) return { status: 401, body: { error: "Sign in to Catch this track." } };
  const result = await signalRpc<BvsSignalSnapshot>("bvs_catch_track", {
    p_track_id: trackId, p_user_id: user.id,
    p_source: CATCH_SOURCES.has(requestedSource) ? requestedSource : "unknown",
  });
  if (!result.ok) return { status: 503, body: { error: "Your Catch could not be confirmed. Try again; retries never create duplicates." } };
  if (!result.data) return { status: 404, body: { error: "Track unavailable." } };
  return { status: 200, body: presentBvsSignal(result.data) };
}
