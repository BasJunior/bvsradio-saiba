'use client';

import { useState } from 'react';
import { creatorGrowth, type GrowthMetrics, type GrowthRole } from '@/lib/creator-growth';

type Badge = { id: string; name: string; detail: string; role?: GrowthRole; metric: keyof GrowthMetrics; target: number };
const badges: Badge[] = [
  { id: 'first_release', name: 'First Release', detail: 'Publish your first music on BVS.', role: 'artist', metric: 'live', target: 1 },
  { id: 'beat_maker', name: 'Beat Maker', detail: 'Publish your first beat in BeatStore.', role: 'producer', metric: 'live', target: 1 },
  { id: 'on_air', name: 'On Air', detail: 'Publish your first show episode.', role: 'show_creator', metric: 'live', target: 1 },
  { id: 'first_audience', name: 'First Audience', detail: 'Reach 10 distinct validated listeners.', role: 'artist', metric: 'listeners', target: 10 },
  { id: 'first_100', name: 'First 100', detail: 'Reach 100 distinct validated listeners.', role: 'artist', metric: 'listeners', target: 100 },
  { id: 'first_sale', name: 'First Sale', detail: 'Complete your first paid sale.', metric: 'sales', target: 1 },
];

export default function CreatorRewards({ metrics, role, earned, levels }: {
  metrics: GrowthMetrics;
  role: GrowthRole;
  earned: Array<{ badge_id: string; earned_at: string }>;
  levels: ReturnType<typeof creatorGrowth>['levels'];
}) {
  const [view, setView] = useState('all');
  const earnedIds = new Set(earned.map(badge => badge.badge_id));
  const visible = badges.filter(badge => view !== 'earned' || earnedIds.has(badge.id));
  return <section aria-labelledby="creator-rewards-title" className="mt-7 border-t border-white/15 pt-6">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="text-xs uppercase tracking-[.16em] text-brand">Keep collecting stars</p><h3 id="creator-rewards-title" className="mt-2 text-2xl font-semibold">Your rewards & badges</h3><p className="mt-2 max-w-2xl text-sm text-text-secondary">See what you can earn, how to get there and the milestones you’ve already reached.</p></div>
      <div role="group" aria-label="Badge view" className="flex gap-2">{[['all', 'All badges'], ['earned', 'Earned']].map(([value, label]) => <button type="button" key={value} aria-pressed={view === value} onClick={() => setView(value)} className={`min-h-11 border px-4 text-sm ${view === value ? 'border-brand/40 bg-brand/10 text-brand' : 'border-white/15 text-text-secondary'}`}>{label}</button>)}</div>
    </div>
    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {visible.map(badge => {
        const achieved = earnedIds.has(badge.id);
        const applicable = (!badge.role || badge.role === role) && !(badge.id === 'first_sale' && role === 'show_creator');
        const value = applicable ? Math.min(metrics[badge.metric], badge.target) : 0;
        return <article key={badge.id} className={`border p-4 ${achieved ? 'border-brand/35 bg-brand/[.045]' : 'border-white/10'}`}>
          <div className="flex items-center justify-between gap-3"><span aria-hidden="true" className={`text-3xl ${achieved ? 'text-brand' : 'text-text-secondary'}`}>{achieved ? '★' : '☆'}</span><span className="text-xs text-text-secondary">{achieved ? 'Earned' : applicable ? 'To unlock' : badge.role === 'artist' ? 'Artist badge' : badge.role === 'producer' ? 'Producer badge' : badge.role === 'show_creator' ? 'Show creator badge' : 'Artist / producer badge'}</span></div>
          <h4 className="mt-3 font-semibold">{badge.name}</h4><p className="mt-2 text-sm leading-6 text-text-secondary">{badge.detail}</p>
          {applicable && !achieved ? <><progress className="mt-4 h-2 w-full accent-brand" value={value} max={badge.target} aria-label={`${badge.name} progress`} /><p className="mt-1 text-xs text-text-secondary">{value}/{badge.target}{value >= badge.target ? ' · Updating recognition' : ''}</p></> : null}
        </article>;
      })}
    </div>
    {!visible.length ? <p role="status" className="mt-4 text-sm text-text-secondary">Your earned badges will appear here. Browse all badges to choose your next goal.</p> : null}
    <h4 className="mt-7 text-lg font-semibold">The star path</h4><p className="mt-2 text-sm text-text-secondary">Each completed goal fills one star. Complete every goal in a level to earn its badge. Requirements below follow your selected creator role.</p>
    <div className="mt-4 grid gap-3 lg:grid-cols-3">{levels.map((level, index) => <article key={level.id} className={`border p-4 ${level.complete ? 'border-brand/35 bg-brand/[.045]' : 'border-white/10'}`}>
      <p className="text-xs text-text-secondary">Level {index + 1} · {earnedIds.has(level.id) ? 'Badge earned' : level.complete ? 'Goals complete' : `${level.stars}/${level.total} stars`}</p><h4 className="mt-2 text-xl font-semibold">{level.name}</h4>
      <div aria-label={`${level.stars} of ${level.total} stars`} className="mt-3 text-xl tracking-widest text-brand">{level.goals.map(goal => <span key={goal.id} aria-hidden="true">{goal.done ? '★' : '☆'}</span>)}</div>
      <ul className="mt-4 space-y-3">{level.goals.map(goal => <li key={goal.id} className="flex justify-between gap-3 text-xs"><span className="text-text-secondary">{goal.label}</span><span className={goal.done ? 'text-brand' : ''}>{Math.min(goal.value, goal.target)}/{goal.target}<span className="sr-only">{goal.done ? ' complete' : ''}</span></span></li>)}</ul>
      <p className="mt-4 border-t border-white/10 pt-3 text-xs text-text-secondary">Recognition: {level.name} badge</p>
    </article>)}</div>
    <div className="mt-4 border border-white/10 bg-white/[.02] p-4"><p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Coming later · Not currently unlockable</p><h4 className="mt-2 font-semibold">Global Stage & campaign rewards</h4><p className="mt-2 text-sm leading-6 text-text-secondary">Credit rewards and affiliate earnings are not open yet. Amounts, eligibility and payout terms will be published before a paid campaign starts. Global Stage is planned for consideration for international tour support.</p></div>
    <p className="mt-3 text-xs leading-5 text-text-secondary">Badges recognise achievements; editorial selection and account verification are separate. Stars do not currently grant cash, credits or guaranteed opportunities.</p>
  </section>;
}
