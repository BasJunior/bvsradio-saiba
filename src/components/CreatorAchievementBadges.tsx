import { promotionRows, UUID } from '@/lib/creator-promotion-server';
const names: Record<string,string> = { first_release: 'First Release', beat_maker: 'Beat Maker', on_air: 'On Air', first_audience: 'First Audience', first_100: 'First 100', first_sale: 'First Sale', launch: 'Launch', momentum: 'Momentum', breakthrough: 'Breakthrough' };
export default async function CreatorAchievementBadges({ creatorId }: { creatorId: string }) {
  if (!UUID.test(creatorId)) return null;
  // Parent pages already resolve the public creator; never expose financial data.
  const badges = await promotionRows(`creator_achievements?user_id=eq.${creatorId}&select=badge_id&order=earned_at.desc&limit=10`).catch(() => []);
  if (!badges.length) return null;
  return <div className="mt-4 flex flex-wrap gap-2" aria-label="Creator achievements">{badges.map((badge: { badge_id: string }) => <span key={badge.badge_id} title="Achievement, separate from account verification" className="rounded-full border border-brand/25 bg-brand/[.06] px-3 py-2 text-sm text-brand">★ {names[badge.badge_id] || badge.badge_id}</span>)}</div>;
}
