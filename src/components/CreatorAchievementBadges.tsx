import { promotionRows, UUID } from '@/lib/creator-promotion-server';
import { CHART_BADGES, CHART_BADGE_NAMES, type ChartBadge } from '@/lib/chart-badges';

const names: Record<string, string> = { first_release: 'First Release', beat_maker: 'Beat Maker', on_air: 'On Air', first_audience: 'First Audience', first_100: 'First 100', first_sale: 'First Sale', launch: 'Launch', momentum: 'Momentum', breakthrough: 'Breakthrough', ...CHART_BADGE_NAMES };
// Chart achievements lead, best first.
const order = ['chart_no1', 'top5_4_weeks', 'top_5', 'chart_4_weeks', 'chart_entry'];
const isChart = (id: string) => (CHART_BADGES as readonly string[]).includes(id as ChartBadge);

export default async function CreatorAchievementBadges({ creatorId }: { creatorId: string }) {
  if (!UUID.test(creatorId)) return null;
  // Parent pages already resolve the public creator; never expose financial data.
  const rows = await promotionRows(`creator_achievements?user_id=eq.${creatorId}&select=badge_id&order=earned_at.desc&limit=20`).catch(() => []);
  if (!rows.length) return null;
  const badges = (rows as Array<{ badge_id: string }>).map((row) => row.badge_id)
    .sort((a, b) => (order.indexOf(a) === -1 ? 99 : order.indexOf(a)) - (order.indexOf(b) === -1 ? 99 : order.indexOf(b)))
    .slice(0, 8);
  return <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start" aria-label="Creator achievements">{badges.map((badge) => (
    <span key={badge} title={isChart(badge) ? 'Earned on the BVS weekly chart' : 'Achievement, separate from account verification'} className={`inline-flex min-h-8 items-center gap-1.5 border px-2.5 text-xs font-semibold ${isChart(badge) ? 'border-[#ffd25c]/40 bg-[#ffd25c]/[.08] text-[#ffd25c]' : 'border-brand/30 bg-brand/[.06] text-brand'}`}>
      <span aria-hidden="true">{isChart(badge) ? '▲' : '★'}</span>{names[badge] || badge}
    </span>
  ))}</div>;
}
