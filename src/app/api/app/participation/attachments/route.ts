import { resolveParticipationTarget, participationRequestSurface } from "@/lib/participation-server";
import { NextResponse } from "next/server";
import type { AppSurface } from "@/lib/app-surface";
import { participationEnabled, participationRows } from "@/lib/participation-server";

function cleanQuery(value: string) {
  return value.trim().replace(/[%*(),]/g, "").slice(0, 80);
}

export async function GET(request: Request) {
  if (!participationEnabled()) return NextResponse.json({ items: [] });
  const url = new URL(request.url);
  const q = cleanQuery(url.searchParams.get("q") || "");
  const surface = (url.searchParams.get("surface") === "ios" || url.searchParams.get("surface") === "android")
    ? url.searchParams.get("surface") as AppSurface
    : null;
  if (q.length < 2) return NextResponse.json({ items: [] });
  const pattern = encodeURIComponent(`*${q}*`);
  const [tracks, releases, beats] = await Promise.all([
    participationRows<{ id: string; title: string; artist_name?: string | null; artwork_url?: string | null }>(
      `tracks?is_public=eq.true&editorial_status=eq.approved&title=ilike.${pattern}&select=id,title,artist_name,artwork_url&order=created_at.desc&limit=5`,
    ),
    participationRows<{ id: string; title: string; artist_name?: string | null; cover_url?: string | null }>(
      `releases?is_public=eq.true&editorial_status=eq.approved&title=ilike.${pattern}&select=id,title,artist_name,cover_url&order=created_at.desc&limit=5`,
    ),
    participationRows<{ id: string; title: string; genre?: string | null; artwork_path?: string | null }>(
      `beats?is_public=eq.true&status=eq.published&rights_confirmed=eq.true&title=ilike.${pattern}&select=id,title,genre,artwork_path&order=created_at.desc&limit=5`,
    ),
  ]);
  const candidateItems = [
    ...tracks.map((row) => ({ kind: "track" as const, id: row.id, title: row.title, subtitle: row.artist_name || "Track", artwork: row.artwork_url || null, href: surface ? `/app/${surface}/explore?q=${encodeURIComponent(row.title)}&kind=music` : `/catalogue?q=${encodeURIComponent(row.title)}` })),
    ...releases.map((row) => ({ kind: "release" as const, id: row.id, title: row.title, subtitle: row.artist_name || "Release", artwork: row.cover_url || null, href: surface ? `/app/${surface}/explore?q=${encodeURIComponent(row.title)}&kind=music` : `/album/${encodeURIComponent(row.id)}` })),
    ...beats.map((row) => ({ kind: "beat" as const, id: row.id, title: row.title, subtitle: row.genre || "Beat", artwork: row.artwork_path || null, href: surface ? `/app/${surface}/beat/${encodeURIComponent(row.id)}` : `/beat/${encodeURIComponent(row.id)}` })),
  ].slice(0, 8);
  const items = (await Promise.all(candidateItems.map(item => resolveParticipationTarget(item.kind, item.id, participationRequestSurface(request))))).filter(Boolean);
  return NextResponse.json({ items }, { headers: { "Cache-Control": "public, max-age=15, stale-while-revalidate=30" } });
}
