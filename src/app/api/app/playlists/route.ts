import { NextResponse } from "next/server";
import { appServiceHeaders, appSupabaseService, appSupabaseUrl, requireAppUser } from "@/lib/app-api-auth";
import { publicStorageUrl } from "@/lib/beatstore-server";
import { mediaUrlForStoredValue } from "@/lib/media-url";

type PlaylistMembership = { playlist_id: string; track_id?: string | null; beat_id?: string | null; position?: number | null };

/** Up to four public cover images per playlist, in playlist order, for 2x2 mosaics. */
async function playlistCovers(memberships: PlaylistMembership[]) {
  const ordered = [...memberships].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const firstByPlaylist = new Map<string, PlaylistMembership[]>();
  for (const row of ordered) {
    const list = firstByPlaylist.get(row.playlist_id) || [];
    if (list.length < 4) list.push(row);
    firstByPlaylist.set(row.playlist_id, list);
  }
  const picked = [...firstByPlaylist.values()].flat();
  const trackIds = [...new Set(picked.map((row) => row.track_id).filter((id): id is string => Boolean(id)))];
  const beatIds = [...new Set(picked.map((row) => row.beat_id).filter((id): id is string => Boolean(id)))];
  const art = new Map<string, string>();
  const [tracks, beats] = await Promise.all([
    trackIds.length
      ? fetch(`${appSupabaseUrl}/rest/v1/tracks?id=in.(${trackIds.join(",")})&is_public=eq.true&select=id,artwork_url`, { headers: appServiceHeaders(), cache: "no-store" })
        .then((response) => (response.ok ? response.json() : []))
        .catch(() => [])
      : [],
    beatIds.length
      ? fetch(`${appSupabaseUrl}/rest/v1/beats?id=in.(${beatIds.join(",")})&is_public=eq.true&select=id,artwork_path`, { headers: appServiceHeaders(), cache: "no-store" })
        .then((response) => (response.ok ? response.json() : []))
        .catch(() => [])
      : [],
  ]) as [Array<{ id: string; artwork_url?: string | null }>, Array<{ id: string; artwork_path?: string | null }>];
  for (const track of tracks) {
    const url = mediaUrlForStoredValue(track.artwork_url);
    if (url) art.set(`track:${track.id}`, url);
  }
  for (const beat of beats) {
    const url = beat.artwork_path ? publicStorageUrl(beat.artwork_path) : null;
    if (url) art.set(`beat:${beat.id}`, url);
  }
  const covers: Record<string, string[]> = {};
  for (const [playlistId, rows] of firstByPlaylist) {
    covers[playlistId] = rows
      .map((row) => (row.beat_id ? art.get(`beat:${row.beat_id}`) : art.get(`track:${row.track_id}`)))
      .filter((url): url is string => Boolean(url));
  }
  return covers;
}

type PlaylistRow = {
  id: string;
  title: string;
  description?: string | null;
  cover_url?: string | null;
  is_public?: boolean;
  created_at?: string;
  updated_at?: string;
};

export async function GET(request: Request) {
  const user = await requireAppUser(request);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!appSupabaseUrl || !appSupabaseService) return NextResponse.json({ error: "Playlists are unavailable." }, { status: 503 });

  const response = await fetch(
    `${appSupabaseUrl}/rest/v1/playlists?user_id=eq.${encodeURIComponent(user.id)}&select=id,title,description,cover_url,is_public,created_at,updated_at&order=updated_at.desc`,
    { headers: appServiceHeaders(), cache: "no-store" },
  );
  if (!response.ok) return NextResponse.json({ error: "Could not load playlists." }, { status: 503 });
  const playlists = (await response.json()) as PlaylistRow[];
  if (!playlists.length) return NextResponse.json({ playlists: [] });

  const ids = playlists.map((item) => item.id).join(",");
  const tracksResponse = await fetch(
    `${appSupabaseUrl}/rest/v1/playlist_tracks?playlist_id=in.(${ids})&select=playlist_id,track_id,beat_id,position`,
    { headers: appServiceHeaders(), cache: "no-store" },
  );
  const memberships = tracksResponse.ok ? ((await tracksResponse.json()) as PlaylistMembership[]) : [];
  const counts = memberships.reduce<Record<string, number>>((memo, row) => {
    memo[row.playlist_id] = (memo[row.playlist_id] || 0) + 1;
    return memo;
  }, {});

  const covers = await playlistCovers(memberships).catch(() => ({} as Record<string, string[]>));

  return NextResponse.json({
    playlists: playlists.map((playlist) => ({
      ...playlist,
      trackCount: counts[playlist.id] || 0,
      coverArtwork: covers[playlist.id] || [],
    })),
  });
}

export async function POST(request: Request) {
  const user = await requireAppUser(request);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!appSupabaseUrl || !appSupabaseService) return NextResponse.json({ error: "Playlists are unavailable." }, { status: 503 });

  const body = (await request.json().catch(() => ({}))) as { title?: unknown; description?: unknown; isPublic?: unknown };
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 100) : "";
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 500) : "";
  if (!title) return NextResponse.json({ error: "Playlist name is required." }, { status: 400 });

  const response = await fetch(`${appSupabaseUrl}/rest/v1/playlists`, {
    method: "POST",
    headers: appServiceHeaders({ Prefer: "return=representation" }),
    body: JSON.stringify({
      user_id: user.id,
      title,
      description: description || null,
      is_public: body.isPublic !== false,
      updated_at: new Date().toISOString(),
    }),
  });
  if (!response.ok) return NextResponse.json({ error: "Could not create playlist." }, { status: 503 });
  const rows = (await response.json()) as PlaylistRow[];
  return NextResponse.json({ playlist: { ...(rows[0] || {}), trackCount: 0 } }, { status: 201 });
}
