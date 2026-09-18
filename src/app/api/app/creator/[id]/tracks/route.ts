import { NextResponse } from "next/server";
import { mediaUrlForStoredValue } from "@/lib/media-url";
import type { StationTrack } from "@/lib/station";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function publicAudioUrl(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const cleaned = raw.replace(/^\/+/, "");
  if (cleaned.startsWith("music/")) return `/${cleaned}`;
  return mediaUrlForStoredValue(raw) || raw;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid creator." }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.json({ tracks: [] }, { headers: { "Cache-Control": "no-store" } });

  const requestedSurface = new URL(request.url).searchParams.get("surface");
  const surface = requestedSurface === "ios" || requestedSurface === "android" ? requestedSurface : null;
  const mobileJoin = surface ? ",mobile_distribution_clearances!inner(surface,status)" : "";
  const mobileFilter = surface
    ? `&mobile_distribution_clearances.surface=eq.${surface}&mobile_distribution_clearances.status=eq.cleared`
    : "";

  try {
    const response = await fetch(
      `${url}/rest/v1/tracks?user_id=eq.${encodeURIComponent(id)}&is_public=eq.true&editorial_status=eq.approved${mobileFilter}&select=id,title,artist_name,file_url,artwork_url,genre,release_id${mobileJoin}&order=created_at.asc&limit=500`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
        cache: "no-store",
      },
    );
    if (!response.ok) {
      console.error("creator playable catalogue", response.status, await response.text().catch(() => ""));
      return NextResponse.json({ error: "Creator playback is temporarily unavailable." }, { status: 503 });
    }

    const rows = await response.json() as Array<{
      id: string;
      title: string;
      artist_name?: string | null;
      file_url?: string | null;
      artwork_url?: string | null;
      genre?: string | null;
      release_id?: string | null;
    }>;
    const tracks: StationTrack[] = rows.flatMap((row) => {
      const src = publicAudioUrl(row.file_url);
      if (!src) return [];
      return [{
        id: row.id,
        title: row.title,
        artist: row.artist_name || "BVS Radio",
        src,
        artwork: mediaUrlForStoredValue(row.artwork_url) || undefined,
        genre: row.genre || undefined,
        project: row.release_id ? "Artist release" : "BVS catalogue",
      } satisfies StationTrack];
    });

    return NextResponse.json(
      { tracks, count: tracks.length, surface: surface || "web" },
      { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" } },
    );
  } catch (error) {
    console.error("creator playable catalogue", error);
    return NextResponse.json({ error: "Creator playback is temporarily unavailable." }, { status: 503 });
  }
}
