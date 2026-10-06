export type GrowthMetrics = {
  live: number; promotions: number; listeners: number; sales: number; activeWeeks: number;
};
export type GrowthRole = 'artist' | 'producer' | 'show_creator';
export type GrowthGoal = { id: keyof GrowthMetrics; label: string; target: number; value: number; done: boolean };
export const growthLevels = [
  { id: 'launch', name: 'Launch', live: 1, promotions: 1, listeners: 10, sales: 1, activeWeeks: 2 },
  { id: 'momentum', name: 'Momentum', live: 3, promotions: 3, listeners: 100, sales: 3, activeWeeks: 4 },
  { id: 'breakthrough', name: 'Breakthrough', live: 5, promotions: 5, listeners: 1000, sales: 10, activeWeeks: 8 },
] as const;

// Initial recognition thresholds. Cash rewards require a separately published,
// versioned campaign policy; these thresholds never create financial entries.
export function creatorGrowth(metrics: GrowthMetrics, role: GrowthRole) {
  const levels = growthLevels.map(level => {
    const specs: Array<[keyof GrowthMetrics, string, number]> = [
      ['live', role === 'producer' ? 'Publish beats' : role === 'show_creator' ? 'Publish episodes' : 'Publish music', level.live],
      ['promotions', 'Create promotion links', level.promotions],
      ['activeWeeks', 'Publish in different weeks', level.activeWeeks],
    ];
    if (role === 'artist') specs.push(['listeners', 'Reach validated listeners', level.listeners]);
    if (role !== 'show_creator') specs.push(['sales', 'Complete paid sales', level.sales]);
    const goals: GrowthGoal[] = specs.map(([id, label, target]) => ({ id, label, target, value: metrics[id], done: metrics[id] >= target }));
    return { id: level.id, name: level.name, goals, stars: goals.filter(goal => goal.done).length, total: goals.length, complete: goals.every(goal => goal.done) };
  });
  const current = levels.find(level => !level.complete) || null;
  return { levels, current, completed: levels.filter(level => level.complete).map(level => level.name), rewardStatus: 'not_launched' as const };
}

export type PromotionItem = { id: string; kind: 'track' | 'beat' | 'episode'; title: string; path: string; image?: string | null };
export function promotionCaption(item: PromotionItem) {
  return item.kind === 'beat'
    ? `Artists: hear “${item.title}” and buy your beat licence on BVS Radio.`
    : item.kind === 'episode'
      ? `My episode “${item.title}” is live. Listen on BVS Radio and follow the show.`
      : `My music “${item.title}” is live. Listen, save it and follow me on BVS Radio.`;
}
