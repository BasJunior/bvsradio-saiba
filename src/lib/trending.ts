export type TrendingWindow = 'now' | 'week'
export type TrendingEntry = {
  id: string; title: string; artist: string; src: string; artwork?: string;
  rank: number; previousRank: number | null; reason: string;
}
export type TrendingBoard = { window: TrendingWindow; generatedAt: string | null; hasPrevious: boolean; entries: TrendingEntry[] }
export function rankMovement(rank: number, previous: number | null, hasPrevious: boolean) {
  if (!hasPrevious) return '—'
  if (previous === null) return 'NEW'
  const delta = previous - rank
  return delta > 0 ? `↑${delta}` : delta < 0 ? `↓${-delta}` : '—'
}
