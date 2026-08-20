import { NextResponse } from "next/server";
import { creatorHeaders, creatorIdentity, creatorUrl } from "@/lib/creator-server";

const clean = (value: unknown, max = 500) => String(value || "").trim().slice(0, max);
const isrcClean = (value: unknown) =>
  String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 15);

function httpUrl(value: string) {
  if (!value) return "";
  try {
    const u = new URL(value);
    if (u.protocol !== "https:" && u.protocol !== "http:") return "";
    return u.toString().slice(0, 500);
  } catch {
    return "";
  }
}

export async function POST(request: Request) {
  const identity = await creatorIdentity(request);
  if (!identity?.user?.id) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    trackId?: string;
    isrc?: string;
    spotifyUrl?: string;
  };
  const trackId = clean(body.trackId, 80);
  if (!trackId) return NextResponse.json({ error: "trackId required." }, { status: 400 });

  const isrc = isrcClean(body.isrc);
  const spotifyUrl = httpUrl(clean(body.spotifyUrl, 500));
  const patch: Record<string, string> = { updated_at: new Date().toISOString() };
  if (body.isrc !== undefined) patch.isrc = isrc;
  if (body.spotifyUrl !== undefined) patch.spotify_url = spotifyUrl;

  const res = await fetch(
    creatorUrl(
      `tracks?id=eq.${encodeURIComponent(trackId)}&user_id=eq.${identity.user.id}`,
    ),
    {
      method: "PATCH",
      headers: { ...creatorHeaders, Prefer: "return=representation" },
      body: JSON.stringify(patch),
    },
  );
  const rows = res.ok ? await res.json() : [];
  if (!rows?.[0]) {
    return NextResponse.json(
      { error: "Could not save store links. Confirm this track is yours." },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true, track: rows[0] });
}
