
import { NextResponse } from "next/server";
import { can, editorialIdentity } from "@/lib/editorial-server";
import { presentBvsSignal, type BvsSignalSnapshot } from "@/lib/bvs-signal";
import { signalRpc } from "@/lib/bvs-signal-server";
import { UUID } from "@/lib/creator-promotion-server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store", Vary: "Authorization" } });
async function identityFor(request: Request) {
  const identity = await editorialIdentity(request);
  return identity && can(identity, "manage_rotation") ? identity : null;
}
export async function GET(request: Request) {
  if (!await identityFor(request)) return json({ error: "Rotation access required." }, 403);
  const rawPage = Number(new URL(request.url).searchParams.get("page") || 0);
  const page = Number.isSafeInteger(rawPage) && rawPage >= 0 ? Math.min(rawPage, 10000) : 0;
  type DeskTrack = { id: string; signal: BvsSignalSnapshot };
  const result = await signalRpc<DeskTrack[]>("bvs_signal_desk", { p_limit: 50, p_offset: page * 50 });
  if (!result.ok || !Array.isArray(result.data)) return json({ error: "Signal unavailable. Check the trusted-journey migration." }, 503);
  return json({
    tracks: result.data.map(track => ({ ...track, signal: presentBvsSignal(track.signal) })),
    page, hasMore: result.data.length === 50, signalAvailable: true,
    playoutConfigured: Boolean(process.env.BVS_PLAYOUT_STATION_ID && (process.env.BVS_PLAYOUT_SIGNING_SECRET || "").length >= 32),
  });
}
export async function PATCH(request: Request) {
  const identity = await identityFor(request);
  if (!identity) return json({ error: "Rotation access required." }, 403);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.trackId !== "string" || !UUID.test(body.trackId) ||
      !Number.isSafeInteger(body.revision) || Number(body.revision) < 0) return json({ error: "Track and current revision required. Refresh the desk." }, 400);
  if (body.action !== "set_track_signal" && body.action !== "set_track_breakout") return json({ error: "Unknown Signal action." }, 400);
  if (body.action === "set_track_breakout" && typeof body.breakout !== "boolean") return json({ error: "Breakout must be true or false." }, 400);
  let scheduled: string | null = null;
  let reason: string | null = null;
  if (body.action === "set_track_signal") {
    if (typeof body.editorialReason !== "string" || body.editorialReason.length > 500) return json({ error: "Selection reason must be at most 500 characters." }, 400);
    reason = body.editorialReason.trim() || null;
    if (body.firstSpinScheduledAt != null && body.firstSpinScheduledAt !== "") {
      if (typeof body.firstSpinScheduledAt !== "string" || !Number.isFinite(Date.parse(body.firstSpinScheduledAt))) return json({ error: "Invalid First Spin time." }, 400);
      scheduled = new Date(body.firstSpinScheduledAt).toISOString();
      if (!reason) return json({ error: "Explain why BVS selected this track before scheduling." }, 400);
    }
  }
  const result = await signalRpc("bvs_edit_signal", {
    p_track_id: body.trackId, p_actor_id: identity.user.id, p_revision: body.revision,
    p_action: body.action, p_scheduled_at: scheduled, p_reason: reason, p_breakout: body.breakout === true,
  });
  if (!result.ok) return json({ error: result.conflict
    ? "Another editor changed this track. Refresh, review their changes, then save again."
    : "Could not save. Breakout needs a selection reason and verified broadcast; check service availability." }, result.conflict ? 409 : 503);
  if (!result.data) return json({ error: "Track is no longer public and approved." }, 409);
  return json({ signal: result.data });
}
