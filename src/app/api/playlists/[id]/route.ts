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
  const response = await fetch(
    `${url}/rest/v1/playlists?id=eq.${encodeURIComponent(id)}&select=id,user_id,title,description,cover_url,is_public,created_at,updated_at&limit=1`,
    { headers: serviceHeaders(service), cache: "no-store" },
  );
  if (!response.ok) return null;
  const rows = (await response.json()) as Array<Record<string, unknown> & { id: string; user_id: string; is_public?: boolean }>;
  return rows[0] || null;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!url || !service) return NextResponse.json({ error: "Playlists are unavailable." }, { status: 503 });
  const { id } = await params;
  const row = await playlistRow(id);
  if (!row) return NextResponse.json({ error: "Playlist not found." }, { status: 404 });
  const user = await currentUser(request);
  const owner = Boolean(user?.id && user.id === row.user_id);
  if (!owner && row.is_public !== true) return NextResponse.json({ error: "Playlist not found." }, { status: 404 });
  return NextResponse.json({ playlist: { ...row, owner } });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await params;
  const row = await playlistRow(id);
  if (!row || row.user_id !== user.id) return NextResponse.json({ error: "Playlist not found." }, { status: 404 });

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

  const response = await fetch(`${url}/rest/v1/playlists?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(user.id)}`, {
    method: "PATCH",
    headers: { ...serviceHeaders(service), Prefer: "return=representation" },
    body: JSON.stringify(patch),
  });
  if (!response.ok) return NextResponse.json({ error: "Could not update playlist." }, { status: 503 });
  const rows = (await response.json()) as Array<Record<string, unknown>>;
  return NextResponse.json({ playlist: rows[0] || null });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await params;
  const row = await playlistRow(id);
  if (!row || row.user_id !== user.id) return NextResponse.json({ error: "Playlist not found." }, { status: 404 });

  const response = await fetch(`${url}/rest/v1/playlists?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(user.id)}`, {
    method: "DELETE",
    headers: serviceHeaders(service),
  });
  if (!response.ok) return NextResponse.json({ error: "Could not delete playlist." }, { status: 503 });
  return new Response(null, { status: 204 });
}
