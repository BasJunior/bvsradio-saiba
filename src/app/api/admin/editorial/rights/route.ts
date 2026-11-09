import { NextResponse } from "next/server";
import { audit, can, editorialIdentity, editorialUrl, serviceHeaders } from "@/lib/editorial-server";
import { isRotationCleared, type RightsDeclarationRow } from "@/lib/rights-declarations";

export const runtime = "nodejs";

type Track = { id: string; title?: string; artist_name?: string; user_id?: string | null; release_id?: string | null };
const uuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const RESULTS = new Set(["clear", "found", "unclear"]);
const CLEARANCES = new Set(["society_consent", "bvs_licence"]);

async function rows<T>(path: string): Promise<T[]> {
  const response = await fetch(editorialUrl(path), { headers: serviceHeaders, cache: "no-store" });
  if (!response.ok) throw new Error("Rights data unavailable");
  return (await response.json()) as T[];
}

async function optional<T>(path: string) {
  try {
    return { rows: await rows<T>(path), available: true };
  } catch {
    return { rows: [] as T[], available: false };
  }
}

async function access(request: Request) {
  const identity = await editorialIdentity(request);
  if (!identity) return { error: NextResponse.json({ error: "Active Editorial staff access is required." }, { status: 403 }) };
  if (!can(identity, "approve_submissions")) return { error: NextResponse.json({ error: "Rights review needs editorial approval access." }, { status: 403 }) };
  return { identity };
}

const findDeclaration = (declarations: RightsDeclarationRow[], track: Track) =>
  declarations.find((row) => row.track_id === track.id) || declarations.find((row) => track.release_id && row.release_id === track.release_id);

export async function GET(request: Request) {
  const allowed = await access(request);
  if (allowed.error) return allowed.error;
  try {
    const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const [tracks, declarations, countries] = await Promise.all([
      rows<Track>("tracks?in_rotation=eq.true&is_public=eq.true&editorial_status=eq.approved&select=id,title,artist_name,user_id,release_id&order=rotation_added_at.desc&limit=500"),
      optional<RightsDeclarationRow>("music_rights_declarations?select=*&limit=5000"),
      optional<{ country: string; plays: number }>(`listener_country_daily?day=gte.${since}&select=country,plays&limit=5000`),
    ]);
    const totals = new Map<string, number>();
    for (const row of countries.rows) totals.set(row.country, (totals.get(row.country) || 0) + Number(row.plays || 0));
    return NextResponse.json({
      available: declarations.available,
      enforcing: process.env.BVS_ENFORCE_RIGHTS_ROTATION === "true",
      tracks: tracks.map((track) => {
        const declaration = findDeclaration(declarations.rows, track);
        return {
          id: track.id,
          title: track.title || "Untitled",
          artist: track.artist_name || "Unknown artist",
          linkedCreator: Boolean(track.user_id),
          societyStatus: declaration?.society_status || "not_declared",
          societyName: declaration?.society_name || null,
          grantAccepted: Boolean(declaration?.grant_accepted_at),
          spotCheck: declaration?.spot_check_result || null,
          spotCheckNote: declaration?.spot_check_note || null,
          clearance: declaration?.clearance_basis || null,
          clearanceReference: declaration?.clearance_reference || null,
          cleared: isRotationCleared(declaration),
        };
      }),
      countries: [...totals.entries()].map(([country, plays]) => ({ country, plays })).sort((a, b) => b.plays - a.plays),
    });
  } catch {
    return NextResponse.json({ error: "Rights data could not load. Nothing has been changed." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const allowed = await access(request);
  if (allowed.error) return allowed.error;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const trackId = String(body.trackId || "");
  const result = String(body.result || "");
  const note = String(body.note || "").trim().slice(0, 500) || null;
  const clearance = String(body.clearance || "");
  const reference = String(body.reference || "").trim().slice(0, 300);
  const isClearance = Boolean(clearance);
  if (!uuid(trackId)) return NextResponse.json({ error: "Choose a track." }, { status: 400 });
  if (isClearance && clearance !== "remove" && !CLEARANCES.has(clearance)) return NextResponse.json({ error: "Choose what is on file." }, { status: 400 });
  if (isClearance && clearance !== "remove" && !reference) return NextResponse.json({ error: "Say where the consent or licence is kept." }, { status: 400 });
  if (!isClearance && !RESULTS.has(result)) return NextResponse.json({ error: "Choose a track and a result." }, { status: 400 });
  try {
    const [track] = await rows<Track>(`tracks?id=eq.${trackId}&select=id,title,user_id,release_id&limit=1`);
    if (!track) return NextResponse.json({ error: "Track not found." }, { status: 404 });
    const filter = track.release_id ? `release_id=eq.${track.release_id}` : `track_id=eq.${track.id}`;
    const [existing] = await rows<RightsDeclarationRow>(`music_rights_declarations?${filter}&select=id&limit=1`);
    const now = new Date().toISOString();
    const removing = clearance === "remove";
    const check = isClearance
      ? { clearance_basis: removing ? null : clearance, clearance_reference: removing ? null : reference, clearance_recorded_by: removing ? null : allowed.identity.user.id, clearance_recorded_at: removing ? null : now, updated_at: now }
      : { spot_check_result: result, spot_check_note: note, spot_checked_by: allowed.identity.user.id, spot_checked_at: now, updated_at: now };
    const response = await fetch(editorialUrl(existing ? `music_rights_declarations?id=eq.${existing.id}` : "music_rights_declarations"), {
      method: existing ? "PATCH" : "POST",
      headers: { ...serviceHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(existing ? check : { ...check, owner_user_id: track.user_id || null, release_id: track.release_id || null, track_id: track.release_id ? null : track.id, society_status: "not_declared" }),
    });
    if (!response.ok) throw new Error("Rights record not saved");
    await audit(allowed.identity.user.id, isClearance ? "music_rights_clearance" : "music_rights_spot_check", "track", trackId, isClearance ? { clearance } : { result });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "The spot check could not be saved." }, { status: 503 });
  }
}
