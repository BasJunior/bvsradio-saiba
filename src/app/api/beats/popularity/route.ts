import { NextResponse } from "next/server";
import { beatHeaders, beatUrl } from "@/lib/beatstore-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Recent public engagement scores for published BeatStore beats. */
export async function GET() {
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const scores: Record<string, number> = {};
    // Only include actual beat IDs from the published catalogue; not music plays.
    const published = await fetch(
      beatUrl("beats?is_public=eq.true&status=eq.published&rights_confirmed=eq.true&select=id&limit=10000"),
      { headers: beatHeaders, next: { revalidate: 60 } },
    );
    if (!published.ok) return NextResponse.json({ scores: {}, available: false });
    const ids = new Set(
      ((await published.json()) as Array<{ id: string }>).map((beat) => String(beat.id)),
    );
    const events = await fetch(
      beatUrl(
        `analytics_events?event_name=eq.player_start&created_at=gte.${encodeURIComponent(since)}&select=properties&order=created_at.desc&limit=10000`,
      ),
      { headers: beatHeaders, next: { revalidate: 300 } },
    );
    if (!events.ok) return NextResponse.json({ scores: {}, available: false });
    const rows = (await events.json()) as Array<{ properties?: { track_id?: string } }>;
    for (const event of rows) {
      const id = String(event.properties?.track_id || "");
      if (ids.has(id)) scores[id] = (scores[id] || 0) + 1;
    }
    return NextResponse.json(
      { scores, available: true, windowDays: 30 },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } },
    );
  } catch {
    return NextResponse.json({ scores: {}, available: false });
  }
}
