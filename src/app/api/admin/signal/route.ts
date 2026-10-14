import { NextResponse } from "next/server";
import { audit, can, editorialIdentity, editorialUrl, serviceHeaders } from "@/lib/editorial-server";
import { deriveBvsSignal } from "@/lib/bvs-signal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SignalConfig = {
  track_id: string;
  first_spin_scheduled_at?: string | null;
  editorial_reason?: string | null;
  breakout_at?: string | null;
  updated_at?: string | null;
};

type SpinProof = {
  track_id: string;
  first_spin_played_at?: string | null;
};

type Track = {
  id: string;
  title: string;
  artist_name: string;
  artwork_url?: string | null;
  in_rotation?: boolean | null;
  rotation_added_at?: string | null;
  created_at?: string | null;
};

async function optionalRows<T>(path: string): Promise<{ ok: boolean; rows: T[] }> {
  const response = await fetch(editorialUrl(path), { headers: serviceHeaders, cache: "no-store" }).catch(() => null);
  if (!response?.ok) return { ok: false, rows: [] };
  const data = await response.json().catch(() => []);
  return { ok: true, rows: Array.isArray(data) ? (data as T[]) : [] };
}

async function currentConfig(trackId: string) {
  const result = await optionalRows<SignalConfig>(
    `track_signal_config?track_id=eq.${encodeURIComponent(trackId)}&select=track_id,first_spin_scheduled_at,editorial_reason,breakout_at,updated_at&limit=1`,
  );
  return { available: result.ok, config: result.rows[0] || null };
}

async function upsertConfig(config: SignalConfig & { updated_by: string }) {
  const response = await fetch(editorialUrl("track_signal_config?on_conflict=track_id"), {
    method: "POST",
    headers: { ...serviceHeaders, Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({ ...config, updated_at: new Date().toISOString() }),
  }).catch(() => null);
  if (!response?.ok) return null;
  const rows = await response.json().catch(() => []);
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function requireSignalTrack(trackId: string) {
  const result = await optionalRows<Track>(
    `tracks?id=eq.${encodeURIComponent(trackId)}&is_public=eq.true&editorial_status=eq.approved&select=id,title,artist_name,artwork_url,in_rotation,rotation_added_at,created_at&limit=1`,
  );
  return result.rows[0] || null;
}

export async function GET(request: Request) {
  const identity = await editorialIdentity(request);
  if (!identity) return NextResponse.json({ error: "Editorial access required." }, { status: 401 });
  if (!can(identity, "manage_rotation")) return NextResponse.json({ error: "Rotation access required." }, { status: 403 });

  const tracksResult = await optionalRows<Track>(
    "tracks?is_public=eq.true&editorial_status=eq.approved&select=id,title,artist_name,artwork_url,in_rotation,rotation_added_at,created_at&order=rotation_added_at.desc.nullslast,created_at.desc&limit=200",
  );
  if (!tracksResult.ok) return NextResponse.json({ error: "Could not load published tracks." }, { status: 500 });

  const [configResult, spinsResult, catchesResult] = await Promise.all([
    optionalRows<SignalConfig>("track_signal_config?select=track_id,first_spin_scheduled_at,editorial_reason,breakout_at,updated_at&limit=1000"),
    optionalRows<SpinProof>("track_first_station_spin?select=track_id,first_spin_played_at&limit=1000"),
    optionalRows<{ track_id: string }>("track_catches?select=track_id&limit=10000"),
  ]);
  const configs = new Map(configResult.rows.map((row) => [row.track_id, row]));
  const spins = new Map(spinsResult.rows.map((row) => [row.track_id, row]));
  const catches = new Map<string, number>();
  for (const row of catchesResult.rows) catches.set(row.track_id, (catches.get(row.track_id) || 0) + 1);

  const tracks = tracksResult.rows.map((track) => {
    const config = configs.get(track.id);
    const spin = spins.get(track.id);
    const catchCount = catches.get(track.id) || 0;
    const state = deriveBvsSignal({
      firstSpinScheduledAt: config?.first_spin_scheduled_at,
      firstSpinPlayedAt: spin?.first_spin_played_at,
      breakoutAt: config?.breakout_at,
      inRotation: Boolean(track.in_rotation),
      catchCount,
    });
    return {
      ...track,
      signal: {
        available: configResult.ok && spinsResult.ok && catchesResult.ok,
        status: state.status,
        label: state.label,
        first_spin_scheduled_at: config?.first_spin_scheduled_at || null,
        first_spin_played_at: spin?.first_spin_played_at || null,
        editorial_reason: config?.editorial_reason || null,
        breakout_at: config?.breakout_at || null,
        catch_count: catchCount,
      },
    };
  });

  return NextResponse.json({ tracks, signalAvailable: configResult.ok && spinsResult.ok && catchesResult.ok });
}

export async function PATCH(request: Request) {
  const identity = await editorialIdentity(request);
  if (!identity) return NextResponse.json({ error: "Editorial access required." }, { status: 401 });
  if (!can(identity, "manage_rotation")) return NextResponse.json({ error: "Rotation access required." }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action || "");
  const trackId = String(body.trackId || "").trim();
  if (!trackId) return NextResponse.json({ error: "trackId required." }, { status: 400 });
  const track = await requireSignalTrack(trackId);
  if (!track) return NextResponse.json({ error: "Publish an approved track before managing Signal." }, { status: 409 });

  const existing = await currentConfig(trackId);
  if (!existing.available) return NextResponse.json({ error: "Run the BVS Signal database migration first." }, { status: 503 });

  if (action === "set_track_signal") {
    const rawScheduled = String(body.firstSpinScheduledAt || "").trim();
    const parsedScheduled = rawScheduled ? Date.parse(rawScheduled) : Number.NaN;
    if (rawScheduled && !Number.isFinite(parsedScheduled)) {
      return NextResponse.json({ error: "First Spin schedule is invalid." }, { status: 400 });
    }
    const firstSpinScheduledAt = rawScheduled ? new Date(parsedScheduled).toISOString() : null;
    const editorialReason = String(body.editorialReason || "").trim().slice(0, 500) || null;
    const saved = await upsertConfig({
      track_id: trackId,
      first_spin_scheduled_at: firstSpinScheduledAt,
      editorial_reason: editorialReason,
      breakout_at: existing.config?.breakout_at || null,
      updated_by: identity.user.id,
    });
    if (!saved) return NextResponse.json({ error: "Could not save BVS Signal." }, { status: 500 });
    await audit(identity.user.id, "track_signal_updated", "track", trackId, { firstSpinScheduledAt, editorialReason });
    return NextResponse.json({ signal: saved });
  }

  if (action === "set_track_breakout") {
    const breakout = Boolean(body.breakout);
    const breakoutAt = breakout ? new Date().toISOString() : null;
    const saved = await upsertConfig({
      track_id: trackId,
      first_spin_scheduled_at: existing.config?.first_spin_scheduled_at || null,
      editorial_reason: existing.config?.editorial_reason || null,
      breakout_at: breakoutAt,
      updated_by: identity.user.id,
    });
    if (!saved) return NextResponse.json({ error: "Could not update Breakout state." }, { status: 500 });
    await audit(identity.user.id, breakout ? "track_signal_breakout" : "track_signal_breakout_removed", "track", trackId);
    return NextResponse.json({ signal: saved });
  }

  return NextResponse.json({ error: "Unknown Signal action." }, { status: 400 });
}
