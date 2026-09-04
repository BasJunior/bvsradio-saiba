import { NextResponse } from "next/server";
import { appServiceHeaders, appSupabaseService, appSupabaseUrl, requireAppUser } from "@/lib/app-api-auth";

async function ownsPlaylist(userId: string, playlistId: string) {
  const response = await fetch(
    `${appSupabaseUrl}/rest/v1/playlists?id=eq.${encodeURIComponent(playlistId)}&user_id=eq.${encodeURIComponent(userId)}&select=id&limit=1`,
    { headers: appServiceHeaders(), cache: "no-store" },
  );
  if (!response.ok) return false;
  const rows = (await response.json()) as Array<{ id: string }>;
  return Boolean(rows[0]?.id);
}

async function publicTrackExists(trackId: string) {
  const response = await fetch(
    `${appSupabaseUrl}/rest/v1/tracks?id=eq.${encodeURIComponent(trackId)}&is_public=eq.true&select=id&limit=1`,
    { headers: appServiceHeaders(), cache: "no-store" },
  );
  if (!response.ok) return false;
  const rows = (await response.json()) as Array<{ id: string }>;
  return Boolean(rows[0]?.id);
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAppUser(request);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!appSupabaseUrl || !appSupabaseService) return NextResponse.json({ error: "Playlists are unavailable." }, { status: 503 });
  const { id } = await params;
  if (!(await ownsPlaylist(user.id, id))) return NextResponse.json({ error: "Playlist not found." }, { status: 404 });

  const membershipResponse = await fetch(
    `${appSupabaseUrl}/rest/v1/playlist_tracks?playlist_id=eq.${encodeURIComponent(id)}&select=track_id,position,added_at&order=position.asc,added_at.asc`,
    { headers: appServiceHeaders(), cache: "no-store" },
  );
  if (!membershipResponse.ok) return NextResponse.json({ error: "Could not load playlist tracks." }, { status: 503 });
  const memberships = (await membershipResponse.json()) as Array<{ track_id: string; position: number; added_at: string }>;
  if (!memberships.length) return NextResponse.json({ tracks: [] });

  const ids = memberships.map((item) => item.track_id).join(",");
  const tracksResponse = await fetch(
    `${appSupabaseUrl}/rest/v1/tracks?id=in.(${ids})&select=id,title,artist_name,genre,artwork_url,file_url,duration_sec,is_downloadable`,
    { headers: appServiceHeaders(), cache: "no-store" },
  );
  const tracks = tracksResponse.ok ? ((await tracksResponse.json()) as Array<Record<string, unknown> & { id: string }>) : [];
  const byId = new Map(tracks.map((track) => [track.id, track]));
  return NextResponse.json({ tracks: memberships.map((membership) => ({ ...byId.get(membership.track_id), ...membership })).filter((item) => item.id) });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAppUser(request);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!appSupabaseUrl || !appSupabaseService) return NextResponse.json({ error: "Playlists are unavailable." }, { status: 503 });
  const { id } = await params;
  if (!(await ownsPlaylist(user.id, id))) return NextResponse.json({ error: "Playlist not found." }, { status: 404 });
  const body = (await request.json().catch(() => ({}))) as { trackId?: unknown };
  const trackId = typeof body.trackId === "string" ? body.trackId : "";
  if (!trackId || !(await publicTrackExists(trackId))) return NextResponse.json({ error: "Track is not available for this playlist." }, { status: 400 });

  const positionResponse = await fetch(
    `${appSupabaseUrl}/rest/v1/playlist_tracks?playlist_id=eq.${encodeURIComponent(id)}&select=position&order=position.desc&limit=1`,
    { headers: appServiceHeaders(), cache: "no-store" },
  );
  const positions = positionResponse.ok ? ((await positionResponse.json()) as Array<{ position?: number }>) : [];
  const position = Number(positions[0]?.position ?? -1) + 1;
  const response = await fetch(`${appSupabaseUrl}/rest/v1/playlist_tracks?on_conflict=playlist_id,track_id`, {
    method: "POST",
    headers: appServiceHeaders({ Prefer: "resolution=ignore-duplicates,return=representation" }),
    body: JSON.stringify({ playlist_id: id, track_id: trackId, position }),
  });
  if (!response.ok) return NextResponse.json({ error: "Could not add track to playlist." }, { status: 503 });
  await fetch(`${appSupabaseUrl}/rest/v1/playlists?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH", headers: appServiceHeaders(), body: JSON.stringify({ updated_at: new Date().toISOString() }),
  }).catch(() => undefined);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAppUser(request);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!appSupabaseUrl || !appSupabaseService) return NextResponse.json({ error: "Playlists are unavailable." }, { status: 503 });
  const { id } = await params;
  if (!(await ownsPlaylist(user.id, id))) return NextResponse.json({ error: "Playlist not found." }, { status: 404 });
  const body = (await request.json().catch(() => ({}))) as { trackId?: unknown };
  const trackId = typeof body.trackId === "string" ? body.trackId : "";
  if (!trackId) return NextResponse.json({ error: "Track is required." }, { status: 400 });
  const response = await fetch(`${appSupabaseUrl}/rest/v1/playlist_tracks?playlist_id=eq.${encodeURIComponent(id)}&track_id=eq.${encodeURIComponent(trackId)}`, {
    method: "DELETE", headers: appServiceHeaders(),
  });
  if (!response.ok) return NextResponse.json({ error: "Could not remove track." }, { status: 503 });
  return new Response(null, { status: 204 });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAppUser(request);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!appSupabaseUrl || !appSupabaseService) return NextResponse.json({ error: "Playlists are unavailable." }, { status: 503 });
  const { id } = await params;
  if (!(await ownsPlaylist(user.id, id))) return NextResponse.json({ error: "Playlist not found." }, { status: 404 });
  const body = (await request.json().catch(() => ({}))) as { trackIds?: unknown };
  const trackIds = Array.isArray(body.trackIds) ? body.trackIds.filter((value): value is string => typeof value === "string") : [];
  if (!trackIds.length || new Set(trackIds).size !== trackIds.length) return NextResponse.json({ error: "A unique ordered track list is required." }, { status: 400 });

  const existingResponse = await fetch(`${appSupabaseUrl}/rest/v1/playlist_tracks?playlist_id=eq.${encodeURIComponent(id)}&select=track_id`, {
    headers: appServiceHeaders(), cache: "no-store",
  });
  const existing = existingResponse.ok ? ((await existingResponse.json()) as Array<{ track_id: string }>).map((row) => row.track_id) : [];
  if (existing.length !== trackIds.length || existing.some((trackId) => !trackIds.includes(trackId))) {
    return NextResponse.json({ error: "Reorder must contain every current playlist track exactly once." }, { status: 400 });
  }
  const responses = await Promise.all(trackIds.map((trackId, position) => fetch(
    `${appSupabaseUrl}/rest/v1/playlist_tracks?playlist_id=eq.${encodeURIComponent(id)}&track_id=eq.${encodeURIComponent(trackId)}`,
    { method: "PATCH", headers: appServiceHeaders(), body: JSON.stringify({ position }) },
  )));
  if (responses.some((response) => !response.ok)) return NextResponse.json({ error: "Could not reorder playlist." }, { status: 503 });
  return NextResponse.json({ ok: true });
}
