import "server-only";
import { creatorHeaders, creatorUrl } from "@/lib/creator-server";
import { artistChartBadgeRows, type ChartRankingRow } from "@/lib/chart-badges";

/**
 * Award chart badges from the stored weekly chart history (last 35 days).
 * Best effort: the hourly chart refresh must never fail because of badges.
 */
export async function awardChartBadges() {
  const since = new Date(Date.now() - 36 * 24 * 60 * 60 * 1000).toISOString();
  const rankingsResponse = await fetch(
    creatorUrl(`bvs_trending_rankings?window_key=eq.week&generated_at=gte.${encodeURIComponent(since)}&select=generated_at,track_id,rank&order=generated_at.asc&limit=20000`),
    { headers: creatorHeaders, cache: "no-store", signal: AbortSignal.timeout(15000) },
  );
  if (!rankingsResponse.ok) return { awarded: 0, error: "rankings_unavailable" };
  const rankings = (await rankingsResponse.json()) as ChartRankingRow[];
  const trackIds = [...new Set(rankings.map((row) => row.track_id))];
  if (!trackIds.length) return { awarded: 0 };

  const tracksResponse = await fetch(
    creatorUrl(`tracks?id=in.(${trackIds.join(",")})&select=id,user_id`),
    { headers: creatorHeaders, cache: "no-store", signal: AbortSignal.timeout(15000) },
  );
  if (!tracksResponse.ok) return { awarded: 0, error: "tracks_unavailable" };
  const owners = new Map(((await tracksResponse.json()) as Array<{ id: string; user_id: string | null }>).filter((track) => track.user_id).map((track) => [track.id, track.user_id as string]));

  const rows = artistChartBadgeRows(rankings, owners);
  if (!rows.length) return { awarded: 0 };
  const saved = await fetch(creatorUrl("creator_achievements?on_conflict=user_id,badge_id"), {
    method: "POST",
    headers: { ...creatorHeaders, Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify(rows),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!saved.ok) {
    // Most likely the chart badge migration hasn't been applied yet.
    console.error("Chart badges could not be saved", saved.status, await saved.text().catch(() => ""));
    return { awarded: 0, error: "save_failed" };
  }
  return { awarded: rows.length };
}
