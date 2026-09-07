import { NextResponse } from "next/server";
import { authUserId, serviceHeaders } from "@/lib/storage-upload";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

async function currentUser(request: Request) {
  if (!url || !service) return null;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  return authUserId(url, service, token);
}

async function playlistRow(id: string) {
  const response = await fetch(`${url}/rest/v1/playlists?id=eq.${encodeURIComponent(id)}&select=id,user_id,is_public&limit=1`, {
    headers: serviceHeaders(service), cache: "no-store",
  });
  if (!response.ok) return null;
  const rows = (await response.json()) as Array<{ id: string; user_id: string; is_public?: boolean }>;
  return rows[0] || null;
}

async function owner(request: Request, id: string) {
  const [user, playlist] = await Promise.all([currentUser(request), playlistRow(id)]);
  return user && playlist && user.id === playlist.user_id ? { user, playlist } : null;
}

async function publicTrackExists(trackId: string) {
  const response = await fetch(`${url}/rest/v1/tracks?id=eq.${encodeURIComponent(trackId)}&is_public=eq.true&select=id&limit=1`, {
    headers: serviceHeaders(service), cache: "no-store",
  });
  if (!response.ok) return false;
  const rows = (await response.json()) as Array<{ id: string }>;
  return Boolean(rows[0]?.id);
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!url || !service) return NextResponse.json({ error: "Playlists are unavailable." }, { status: 503 });
  const { id } = await params;
  const playlist = await playlistRow(id);
  if (!playlist) return NextResponse.json({ error: "Playlist not found." }, { status: 404 });
  const user = await currentUser(request);
  if (playlist.is_public !== true && user?.id !== playlist.user_id) return NextResponse.json({ error: "Playlist not found." }, { status: 404 });

  const membershipResponse = await fetch(`${url}/rest/v1/playlist_tracks?playlist_id=eq.${encodeURIComponent(id)}&select=track_id,position,added_at&order=position.asc,added_at.asc`, {
    headers: serviceHeaders(service), cache: "no-store",
  });
  if (!membershipResponse.ok) return NextResponse.json({ error: "Could not load playlist tracks." }, { status: 503 });
  const memberships = (await membershipResponse.json()) as Array<{ track_id: string; position: number; added_at: string }>;
  if (!memberships.length) return NextResponse.json({ tracks: [] });

  const ids = memberships.map((item) => item.track_id).join(",");
  const tracksResponse = await fetch(`${url}/rest/v1/tracks?id=in.(${ids})&select=id,title,artist_name,genre,artwork_url,file_url,duration_sec,is_downloadable`, {
    headers: serviceHeaders(service), cache: "no-store",
  });
  const tracks = tracksResponse.ok ? ((await tracksResponse.json()) as Array<Record<string, unknown> & { id: string }>) : [];
  const byId = new Map(tracks.map((track) => [track.id, track]));
  return NextResponse.json({ tracks: memberships.map((membership) => ({ ...byId.get(membership.track_id), ...membership })).filter((item) => item.id) });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await owner(request, id);
  if (!access) return NextResponse.json({ error: "Sign in or playlist ownership required." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { trackId?: unknown };
  const trackId = typeof body.trackId === "string" ? body.trackId : "";
  if (!trackId || !(await publicTrackExists(trackId))) return NextResponse.json({ error: "Track is not available for this playlist." }, { status: 400 });

  const positionResponse = await fetch(`${url}/rest/v1/playlist_tracks?playlist_id=eq.${encodeURIComponent(id)}&select=position&order=position.desc&limit=1`, {
    headers: serviceHeaders(service), cache: "no-store",
  });
  const positions = positionResponse.ok ? ((await positionResponse.json()) as Array<{ position?: number }>) : [];
  const position = Number(positions[0]?.position ?? -1) + 1;
  const response = await fetch(`${url}/rest/v1/playlist_tracks?on_conflict=playlist_id,track_id`, {
    method: "POST",
    headers: { ...serviceHeaders(service), Prefer: "resolution=ignore-duplicates,return=representation" },
    body: JSON.stringify({ playlist_id: id, track_id: trackId, position }),
  });
  if (!response.ok) return NextResponse.json({ error: "Could not add track to playlist." }, { status: 503 });
  void fetch(`${url}/rest/v1/playlists?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH", headers: serviceHeaders(service), body: JSON.stringify({ updated_at: new Date().toISOString() }),
  }).catch(() => undefined);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await owner(request, id);
  if (!access) return NextResponse.json({ error: "Sign in or playlist ownership required." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { trackId?: unknown };
  const trackId = typeof body.trackId === "string" ? body.trackId : "";
  if (!trackId) return NextResponse.json({ error: "Track is required." }, { status: 400 });
  const response = await fetch(`${url}/rest/v1/playlist_tracks?playlist_id=eq.${encodeURIComponent(id)}&track_id=eq.${encodeURIComponent(trackId)}`, {
    method: "DELETE", headers: serviceHeaders(service),
  });
  if (!response.ok) return NextResponse.json({ error: "Could not remove track." }, { status: 503 });
  return new Response(null, { status: 204 });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await owner(request, id);
  if (!access) return NextResponse.json({ error: "Sign in or playlist ownership required." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { trackIds?: unknown };
  const trackIds = Array.isArray(body.trackIds) ? body.trackIds.filter((value): value is string => typeof value === "string") : [];
  if (!trackIds.length || new Set(trackIds).size !== trackIds.length) return NextResponse.json({ error: "A unique ordered track list is required." }, { status: 400 });

  const existingResponse = await fetch(`${url}/rest/v1/playlist_tracks?playlist_id=eq.${encodeURIComponent(id)}&select=track_id`, {
    headers: serviceHeaders(service), cache: "no-store",
  });
  const existing = existingResponse.ok ? ((await existingResponse.json()) as Array<{ track_id: string }>).map((row) => row.track_id) : [];
  if (existing.length !== trackIds.length || existing.some((trackId) => !trackIds.includes(trackId))) {
    return NextResponse.json({ error: "Reorder must contain every current playlist track exactly once." }, { status: 400 });
  }
  const responses = await Promise.all(trackIds.map((trackId, position) => fetch(`${url}/rest/v1/playlist_tracks?playlist_id=eq.${encodeURIComponent(id)}&track_id=eq.${encodeURIComponent(trackId)}`, {
    method: "PATCH", headers: serviceHeaders(service), body: JSON.stringify({ position }),
  })));
  if (responses.some((response) => !response.ok)) return NextResponse.json({ error: "Could not reorder playlist." }, { status: 503 });
  return NextResponse.json({ ok: true });
}
