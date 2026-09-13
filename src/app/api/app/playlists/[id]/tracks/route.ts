import { NextResponse } from "next/server";
import { appServiceHeaders, appSupabaseService, appSupabaseUrl, requireAppUser } from "@/lib/app-api-auth";
import { publicStorageUrl } from "@/lib/beatstore-server";
import { creatorPublicName } from "@/lib/public-name";
import { parsePlaylistItemKey, playlistItemKey } from "@/lib/playlist-item";

type Membership = { track_id?: string | null; beat_id?: string | null; position: number; added_at: string };
type BeatRow = { id: string; title: string; genre?: string | null; artwork_path?: string | null; preview_path?: string | null; duration_seconds?: number | null; producer_user_id: string };
type ProducerRow = { id: string; username?: string | null; creator_public_name?: string | null; creator_name_status?: string | null };

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

async function publicBeatExists(beatId: string) {
  const response = await fetch(
    `${appSupabaseUrl}/rest/v1/beats?id=eq.${encodeURIComponent(beatId)}&is_public=eq.true&select=id&limit=1`,
    { headers: appServiceHeaders(), cache: "no-store" },
  );
  if (!response.ok) return false;
  const rows = (await response.json()) as Array<{ id: string }>;
  return Boolean(rows[0]?.id);
}

function membershipKey(membership: Membership) {
  if (membership.beat_id) return playlistItemKey("beat", membership.beat_id);
  if (membership.track_id) return playlistItemKey("track", membership.track_id);
  return "";
}

async function loadPlaylistItems(memberships: Membership[]) {
  const trackIds = memberships.map((item) => item.track_id).filter((value): value is string => Boolean(value));
  const beatIds = memberships.map((item) => item.beat_id).filter((value): value is string => Boolean(value));
  const [tracksResponse, beatsResponse] = await Promise.all([
    trackIds.length ? fetch(
      `${appSupabaseUrl}/rest/v1/tracks?id=in.(${trackIds.join(",")})&is_public=eq.true&select=id,title,artist_name,genre,artwork_url,file_url,duration_sec,is_downloadable`,
      { headers: appServiceHeaders(), cache: "no-store" },
    ) : null,
    beatIds.length ? fetch(
      `${appSupabaseUrl}/rest/v1/beats?id=in.(${beatIds.join(",")})&is_public=eq.true&select=id,title,genre,artwork_path,preview_path,duration_seconds,producer_user_id`,
      { headers: appServiceHeaders(), cache: "no-store" },
    ) : null,
  ]);

  const tracks = tracksResponse?.ok ? ((await tracksResponse.json()) as Array<Record<string, unknown> & { id: string }>) : [];
  const beats = beatsResponse?.ok ? ((await beatsResponse.json()) as BeatRow[]) : [];
  const producerIds = [...new Set(beats.map((beat) => beat.producer_user_id).filter(Boolean))];
  const producerResponse = producerIds.length ? await fetch(
    `${appSupabaseUrl}/rest/v1/profiles?id=in.(${producerIds.join(",")})&select=id,username,creator_public_name,creator_name_status`,
    { headers: appServiceHeaders(), cache: "no-store" },
  ) : null;
  const producers = producerResponse?.ok ? ((await producerResponse.json()) as ProducerRow[]) : [];
  const trackById = new Map(tracks.map((track) => [track.id, track]));
  const producerById = new Map(producers.map((producer) => [producer.id, producer]));
  const beatById = new Map(beats.map((beat) => {
    const producer = producerById.get(beat.producer_user_id);
    return [beat.id, {
      id: beat.id,
      kind: "beat",
      item_id: beat.id,
      item_key: playlistItemKey("beat", beat.id),
      track_id: null,
      beat_id: beat.id,
      title: beat.title,
      artist_name: creatorPublicName({
        publicName: producer?.creator_public_name,
        publicNameStatus: producer?.creator_name_status,
        username: producer?.username,
      }) || "BVS producer",
      genre: beat.genre || undefined,
      artwork_url: publicStorageUrl(beat.artwork_path),
      file_url: publicStorageUrl(beat.preview_path),
      duration_sec: beat.duration_seconds || undefined,
      is_downloadable: false,
    }];
  }));

  return memberships.map((membership) => {
    if (membership.beat_id) {
      const beat = beatById.get(membership.beat_id);
      return beat ? { ...beat, ...membership } : null;
    }
    if (!membership.track_id) return null;
    const track = trackById.get(membership.track_id);
    return track ? {
      ...track,
      ...membership,
      kind: "track",
      item_id: membership.track_id,
      item_key: playlistItemKey("track", membership.track_id),
      beat_id: null,
    } : null;
  }).filter(Boolean);
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAppUser(request);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!appSupabaseUrl || !appSupabaseService) return NextResponse.json({ error: "Playlists are unavailable." }, { status: 503 });
  const { id } = await params;
  if (!(await ownsPlaylist(user.id, id))) return NextResponse.json({ error: "Playlist not found." }, { status: 404 });

  const membershipResponse = await fetch(
    `${appSupabaseUrl}/rest/v1/playlist_tracks?playlist_id=eq.${encodeURIComponent(id)}&select=track_id,beat_id,position,added_at&order=position.asc,added_at.asc`,
    { headers: appServiceHeaders(), cache: "no-store" },
  );
  if (!membershipResponse.ok) return NextResponse.json({ error: "Could not load playlist items." }, { status: 503 });
  const memberships = (await membershipResponse.json()) as Membership[];
  if (!memberships.length) return NextResponse.json({ tracks: [], items: [] });
  const items = await loadPlaylistItems(memberships);
  return NextResponse.json({ tracks: items, items });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAppUser(request);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!appSupabaseUrl || !appSupabaseService) return NextResponse.json({ error: "Playlists are unavailable." }, { status: 503 });
  const { id } = await params;
  if (!(await ownsPlaylist(user.id, id))) return NextResponse.json({ error: "Playlist not found." }, { status: 404 });
  const body = (await request.json().catch(() => ({}))) as { trackId?: unknown; beatId?: unknown };
  const trackId = typeof body.trackId === "string" ? body.trackId.trim() : "";
  const beatId = typeof body.beatId === "string" ? body.beatId.trim() : "";
  if ((!trackId && !beatId) || (trackId && beatId)) return NextResponse.json({ error: "Choose one playlist item." }, { status: 400 });
  if (trackId && !(await publicTrackExists(trackId))) return NextResponse.json({ error: "Track is not available for this playlist." }, { status: 400 });
  if (beatId && !(await publicBeatExists(beatId))) return NextResponse.json({ error: "Beat is not available for this playlist." }, { status: 400 });

  if (beatId) {
    const duplicateResponse = await fetch(
      `${appSupabaseUrl}/rest/v1/playlist_tracks?playlist_id=eq.${encodeURIComponent(id)}&beat_id=eq.${encodeURIComponent(beatId)}&select=id&limit=1`,
      { headers: appServiceHeaders(), cache: "no-store" },
    );
    const duplicateRows = duplicateResponse.ok ? ((await duplicateResponse.json()) as Array<{ id: string }>) : [];
    if (duplicateRows.length) return NextResponse.json({ ok: true, duplicate: true });
  }

  const positionResponse = await fetch(
    `${appSupabaseUrl}/rest/v1/playlist_tracks?playlist_id=eq.${encodeURIComponent(id)}&select=position&order=position.desc&limit=1`,
    { headers: appServiceHeaders(), cache: "no-store" },
  );
  const positions = positionResponse.ok ? ((await positionResponse.json()) as Array<{ position?: number }>) : [];
  const position = Number(positions[0]?.position ?? -1) + 1;
  const endpoint = trackId
    ? `${appSupabaseUrl}/rest/v1/playlist_tracks?on_conflict=playlist_id,track_id`
    : `${appSupabaseUrl}/rest/v1/playlist_tracks`;
  const headers = trackId
    ? appServiceHeaders({ Prefer: "resolution=ignore-duplicates,return=representation" })
    : appServiceHeaders({ Prefer: "return=representation" });
  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({ playlist_id: id, track_id: trackId || null, beat_id: beatId || null, position }),
  });
  if (!response.ok) return NextResponse.json({ error: `Could not add ${beatId ? "beat" : "track"} to playlist.` }, { status: 503 });
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
  const body = (await request.json().catch(() => ({}))) as { trackId?: unknown; beatId?: unknown };
  const trackId = typeof body.trackId === "string" ? body.trackId.trim() : "";
  const beatId = typeof body.beatId === "string" ? body.beatId.trim() : "";
  if ((!trackId && !beatId) || (trackId && beatId)) return NextResponse.json({ error: "Playlist item is required." }, { status: 400 });
  const filter = beatId ? `beat_id=eq.${encodeURIComponent(beatId)}` : `track_id=eq.${encodeURIComponent(trackId)}`;
  const response = await fetch(`${appSupabaseUrl}/rest/v1/playlist_tracks?playlist_id=eq.${encodeURIComponent(id)}&${filter}`, {
    method: "DELETE", headers: appServiceHeaders(),
  });
  if (!response.ok) return NextResponse.json({ error: "Could not remove playlist item." }, { status: 503 });
  return new Response(null, { status: 204 });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAppUser(request);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!appSupabaseUrl || !appSupabaseService) return NextResponse.json({ error: "Playlists are unavailable." }, { status: 503 });
  const { id } = await params;
  if (!(await ownsPlaylist(user.id, id))) return NextResponse.json({ error: "Playlist not found." }, { status: 404 });
  const body = (await request.json().catch(() => ({}))) as { itemKeys?: unknown; trackIds?: unknown };
  const legacyTrackIds = Array.isArray(body.trackIds) ? body.trackIds.filter((value): value is string => typeof value === "string") : [];
  const requestedKeys = Array.isArray(body.itemKeys)
    ? body.itemKeys.filter((value): value is string => typeof value === "string")
    : legacyTrackIds.map((trackId) => playlistItemKey("track", trackId));
  const parsed = requestedKeys.map(parsePlaylistItemKey);
  if (!requestedKeys.length || parsed.some((value) => !value) || new Set(requestedKeys).size !== requestedKeys.length) {
    return NextResponse.json({ error: "A unique ordered playlist item list is required." }, { status: 400 });
  }

  const existingResponse = await fetch(`${appSupabaseUrl}/rest/v1/playlist_tracks?playlist_id=eq.${encodeURIComponent(id)}&select=track_id,beat_id`, {
    headers: appServiceHeaders(), cache: "no-store",
  });
  const memberships = existingResponse.ok ? ((await existingResponse.json()) as Membership[]) : [];
  const existingKeys = memberships.map(membershipKey).filter(Boolean);
  if (existingKeys.length !== requestedKeys.length || existingKeys.some((key) => !requestedKeys.includes(key))) {
    return NextResponse.json({ error: "Reorder must contain every current playlist item exactly once." }, { status: 400 });
  }

  const responses = await Promise.all(parsed.map((item, position) => {
    if (!item) return Promise.resolve(new Response(null, { status: 400 }));
    const filter = item.kind === "beat" ? `beat_id=eq.${encodeURIComponent(item.id)}` : `track_id=eq.${encodeURIComponent(item.id)}`;
    return fetch(`${appSupabaseUrl}/rest/v1/playlist_tracks?playlist_id=eq.${encodeURIComponent(id)}&${filter}`, {
      method: "PATCH", headers: appServiceHeaders(), body: JSON.stringify({ position }),
    });
  }));
  if (responses.some((response) => !response.ok)) return NextResponse.json({ error: "Could not reorder playlist." }, { status: 503 });
  return NextResponse.json({ ok: true });
}
