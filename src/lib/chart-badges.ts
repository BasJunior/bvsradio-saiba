/**
 * Chart achievement badges from the BVS weekly chart.
 *
 * The hourly trending job stores the weekly Top 20 every hour and keeps 35 days.
 * A "chart week" is the last weekly chart published in each calendar week
 * (Monday to Sunday, UTC). An artist earns a badge when one of their tracks:
 *   chart_entry   – appears in a week's Top 20
 *   top_5         – reaches the Top 5
 *   chart_no1     – reaches #1
 *   chart_4_weeks – spends 4 chart weeks in the Top 20
 *   top5_4_weeks  – spends 4 chart weeks in the Top 5
 * Badges are stored permanently, so they outlive the 35-day chart history.
 */

export const CHART_BADGES = ["chart_entry", "top_5", "chart_no1", "chart_4_weeks", "top5_4_weeks"] as const;
export type ChartBadge = (typeof CHART_BADGES)[number];

export const CHART_BADGE_NAMES: Record<ChartBadge, string> = {
  chart_entry: "Charted",
  top_5: "Top 5",
  chart_no1: "#1 on BVS",
  chart_4_weeks: "4 Weeks Charting",
  top5_4_weeks: "Top 5 · 4 Weeks",
};

export type ChartRankingRow = { generated_at: string; track_id: string; rank: number };

/** Monday 00:00 UTC of the week containing `iso`, as a stable key. */
export function chartWeekKey(iso: string) {
  const date = new Date(iso);
  const day = (date.getUTCDay() + 6) % 7; // Monday = 0
  const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - day));
  return monday.toISOString().slice(0, 10);
}

/** The last weekly chart of each calendar week. */
export function weeklySnapshots(rows: ChartRankingRow[]) {
  const latestRun = new Map<string, string>();
  for (const row of rows) {
    const week = chartWeekKey(row.generated_at);
    const current = latestRun.get(week);
    if (!current || Date.parse(row.generated_at) > Date.parse(current)) latestRun.set(week, row.generated_at);
  }
  const runs = new Set(latestRun.values());
  return rows.filter((row) => runs.has(row.generated_at)).map((row) => ({ ...row, week: chartWeekKey(row.generated_at) }));
}

/** Badges each track has earned from the given chart history. */
export function trackChartBadges(rows: ChartRankingRow[]) {
  const stats = new Map<string, { best: number; top20Weeks: Set<string>; top5Weeks: Set<string> }>();
  for (const row of weeklySnapshots(rows)) {
    if (!(row.rank >= 1 && row.rank <= 20)) continue;
    const entry = stats.get(row.track_id) || { best: Infinity, top20Weeks: new Set<string>(), top5Weeks: new Set<string>() };
    entry.best = Math.min(entry.best, row.rank);
    entry.top20Weeks.add(row.week);
    if (row.rank <= 5) entry.top5Weeks.add(row.week);
    stats.set(row.track_id, entry);
  }
  const result = new Map<string, ChartBadge[]>();
  for (const [trackId, entry] of stats) {
    const badges: ChartBadge[] = ["chart_entry"];
    if (entry.best <= 5) badges.push("top_5");
    if (entry.best === 1) badges.push("chart_no1");
    if (entry.top20Weeks.size >= 4) badges.push("chart_4_weeks");
    if (entry.top5Weeks.size >= 4) badges.push("top5_4_weeks");
    result.set(trackId, badges);
  }
  return result;
}

/** Badge rows to store, one per artist and badge, from tracks to their owners. */
export function artistChartBadgeRows(rows: ChartRankingRow[], ownerByTrack: Map<string, string>) {
  const out = new Map<string, { user_id: string; badge_id: ChartBadge }>();
  for (const [trackId, badges] of trackChartBadges(rows)) {
    const owner = ownerByTrack.get(trackId);
    if (!owner) continue;
    for (const badge of badges) out.set(`${owner}:${badge}`, { user_id: owner, badge_id: badge });
  }
  return [...out.values()];
}
