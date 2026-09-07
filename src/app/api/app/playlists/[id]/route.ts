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

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAppUser(request);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!appSupabaseUrl || !appSupabaseService) return NextResponse.json({ error: "Playlists are unavailable." }, { status: 503 });
  const { id } = await params;
  if (!(await ownsPlaylist(user.id, id))) return NextResponse.json({ error: "Playlist not found." }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as { title?: unknown; description?: unknown; isPublic?: unknown };
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.title === "string") {
    const title = body.title.trim().slice(0, 100);
    if (!title) return NextResponse.json({ error: "Playlist name cannot be empty." }, { status: 400 });
    patch.title = title;
  }
  if (typeof body.description === "string") patch.description = body.description.trim().slice(0, 500) || null;
  if (typeof body.isPublic === "boolean") patch.is_public = body.isPublic;
  if (Object.keys(patch).length === 1) return NextResponse.json({ error: "No playlist changes supplied." }, { status: 400 });

  const response = await fetch(`${appSupabaseUrl}/rest/v1/playlists?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(user.id)}`, {
    method: "PATCH",
    headers: appServiceHeaders({ Prefer: "return=representation" }),
    body: JSON.stringify(patch),
  });
  if (!response.ok) return NextResponse.json({ error: "Could not update playlist." }, { status: 503 });
  const rows = (await response.json()) as Array<Record<string, unknown>>;
  return NextResponse.json({ playlist: rows[0] || null });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAppUser(request);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!appSupabaseUrl || !appSupabaseService) return NextResponse.json({ error: "Playlists are unavailable." }, { status: 503 });
  const { id } = await params;
  if (!(await ownsPlaylist(user.id, id))) return NextResponse.json({ error: "Playlist not found." }, { status: 404 });

  const response = await fetch(`${appSupabaseUrl}/rest/v1/playlists?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(user.id)}`, {
    method: "DELETE",
    headers: appServiceHeaders(),
  });
  if (!response.ok) return NextResponse.json({ error: "Could not delete playlist." }, { status: 503 });
  return new Response(null, { status: 204 });
}
