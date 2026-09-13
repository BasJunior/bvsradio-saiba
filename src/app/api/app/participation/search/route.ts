import { resolveParticipationTarget, participationRequestSurface } from "@/lib/participation-server";
import { NextResponse } from "next/server";
import type { AppSurface } from "@/lib/app-surface";
import {
  participationEnabled,
  participationReady,
  participationRows,
  searchMentionProfiles,
  type ParticipationObjectKind,
  type ParticipationTarget,
} from "@/lib/participation-server";

function safeNeedle(value: string) {
  return String(value || "").trim().replace(/[%*(),]/g, "").slice(0, 60);
}

function surfaceFrom(value: string | null): AppSurface | null {
  return value === "ios" || value === "android" ? value : null;
}

function artwork(value?: string | null) {
  return value || null;
}

export async function GET(request: Request) {
  if (!participationEnabled()) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!participationReady()) return NextResponse.json({ error: "Participation is unavailable." }, { status: 503 });
  const url = new URL(request.url);
  const q = safeNeedle(url.searchParams.get("q") || "");
  if (q.length < 2) return NextResponse.json({ profiles: [], attachments: [] });
  const surface = surfaceFrom(url.searchParams.get("surface"));
  const encoded = encodeURIComponent(`*${q}*`);

  const [profiles, tracks, releases, beats] = await Promise.all([
    searchMentionProfiles(q),
    participationRows<{ id: string; user_id?: string | null; title: string; artist_name?: string | null; artwork_url?: string | null }>(
      `tracks?is_public=eq.true&editorial_status=eq.approved&title=ilike.${encoded}&select=id,user_id,title,artist_name,artwork_url&order=created_at.desc&limit=5`,
    ),
    participationRows<{ id: string; user_id?: string | null; title: string; artist_name?: string | null; cover_url?: string | null }>(
      `releases?is_public=eq.true&editorial_status=eq.approved&title=ilike.${encoded}&select=id,user_id,title,artist_name,cover_url&order=created_at.desc&limit=5`,
    ),
    participationRows<{ id: string; producer_user_id?: string | null; title: string; genre?: string | null; artwork_path?: string | null }>(
      `beats?is_public=eq.true&status=eq.published&rights_confirmed=eq.true&title=ilike.${encoded}&select=id,producer_user_id,title,genre,artwork_path&order=published_at.desc.nullslast,created_at.desc&limit=5`,
    ),
  ]);

  const candidateAttachments: ParticipationTarget[] = [
    ...tracks.map((row) => ({
      kind: "track" as ParticipationObjectKind,
      id: row.id,
      title: row.title,
      subtitle: row.artist_name || null,
      artwork: artwork(row.artwork_url),
      ownerUserId: row.user_id || null,
      href: surface ? `/app/${surface}/explore?q=${encodeURIComponent(row.title)}&kind=music` : `/catalogue?q=${encodeURIComponent(row.title)}`,
    })),
    ...releases.map((row) => ({
      kind: "release" as ParticipationObjectKind,
      id: row.id,
      title: row.title,
      subtitle: row.artist_name || null,
      artwork: artwork(row.cover_url),
      ownerUserId: row.user_id || null,
      href: surface ? `/app/${surface}/explore?q=${encodeURIComponent(row.title)}&kind=music` : `/album/${encodeURIComponent(row.id)}`,
    })),
    ...beats.map((row) => ({
      kind: "beat" as ParticipationObjectKind,
      id: row.id,
      title: row.title,
      subtitle: row.genre || null,
      artwork: artwork(row.artwork_path),
      ownerUserId: row.producer_user_id || null,
      href: surface ? `/app/${surface}/beat/${encodeURIComponent(row.id)}` : `/beat/${encodeURIComponent(row.id)}`,
    })),
  ].slice(0, 12);

  const attachments = (await Promise.all(candidateAttachments.map(item => resolveParticipationTarget(item.kind, item.id, participationRequestSurface(request))))).filter(Boolean);
  return NextResponse.json({ profiles, attachments }, { headers: { "Cache-Control": "public, max-age=20, stale-while-revalidate=30" } });
}
