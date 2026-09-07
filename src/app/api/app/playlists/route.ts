import { NextResponse } from "next/server";
import { appServiceHeaders, appSupabaseService, appSupabaseUrl, requireAppUser } from "@/lib/app-api-auth";

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
    `${appSupabaseUrl}/rest/v1/playlist_tracks?playlist_id=in.(${ids})&select=playlist_id`,
    { headers: appServiceHeaders(), cache: "no-store" },
  );
  const memberships = tracksResponse.ok ? ((await tracksResponse.json()) as Array<{ playlist_id: string }>) : [];
  const counts = memberships.reduce<Record<string, number>>((memo, row) => {
    memo[row.playlist_id] = (memo[row.playlist_id] || 0) + 1;
    return memo;
  }, {});

  return NextResponse.json({ playlists: playlists.map((playlist) => ({ ...playlist, trackCount: counts[playlist.id] || 0 })) });
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
