import type { SearchItem, SearchKind } from './discovery-experience'
import { discoveryQueryScore } from './discovery-search'
import { discoverySounds, matchesSound } from './discovery-experience'
import { fairCreatorDailyOrder } from './fair-discovery-order'

export const searchKinds: SearchKind[] = ['track', 'release', 'playlist', 'artist', 'producer', 'beat', 'show', 'story', 'service', 'product']
export type DiscoverySearchResponse = {
  items: SearchItem[]
  counts: Partial<Record<SearchKind, number>>
  total: number
  sounds: Array<{ key: string; label: string }>
  unavailable: string[]
  offset: number
  limit: number
}
export function selectDiscoveryResults(items: SearchItem[], params: URLSearchParams) {
  const query = (params.get('q') || '').slice(0, 160).trim()
  const type = params.get('type') || 'all'
  const genre = params.get('genre') || ''
  const mode = params.get('mode') || 'all'
  const number = (key: string, fallback: number, max: number) => {
    const value = Number(params.get(key) ?? fallback)
    return Number.isFinite(value) ? Math.min(max, Math.max(0, Math.floor(value))) : fallback
  }
  const limit = Math.max(1, number('limit', 40, 100))
  const offset = number('offset', 0, Number.MAX_SAFE_INTEGER)
  const modeKinds: Record<string, SearchKind[]> = { fresh: ['track', 'release', 'playlist', 'beat', 'story'], rotation: ['track'], playlists: ['playlist'], creators: ['artist', 'producer'], beats: ['beat', 'producer', 'service', 'product'], culture: ['show', 'story'] }
  const scored = items.map(item => ({ item, score: discoveryQueryScore(query, [item.title, item.subtitle, ...(item.tags || [])]) }))
    .filter(({ item, score }) => score > 0 && matchesSound(item, genre) && (query || type !== 'all' || !modeKinds[mode] || (modeKinds[mode].includes(item.kind) && (mode !== 'rotation' || item.onBvs))))
  // Category counts describe the query before the category tab, so zero matches are clear.
  const counts: Partial<Record<SearchKind, number>> = {}
  for (const { item } of scored) counts[item.kind] = (counts[item.kind] || 0) + 1
  const filtered = scored.filter(({ item }) => type === 'all' || item.kind === type)
  let ordered: SearchItem[]
  if (query) {
    ordered = filtered.sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title) || a.item.id.localeCompare(b.item.id)).map(({ item }) => item)
  } else if (['fresh', 'playlists', 'beats', 'culture'].includes(mode)) {
    const date = (value?: string) => Date.parse(value || '') || 0
    ordered = filtered.map(({ item }) => item).sort((a, b) => date(b.publishedAt) - date(a.publishedAt) || a.id.localeCompare(b.id))
  } else {
    ordered = fairCreatorDailyOrder(filtered.map(({ item }) => item), 'search-browse', item => item.detail?.artist || item.subtitle.split('·')[0])
  }
  const suggestions = params.get('view') === 'suggestions'
  const page = suggestions || type !== 'all' ? ordered.slice(offset, offset + limit) : searchKinds.flatMap(kind => ordered.filter(item => item.kind === kind).slice(offset, offset + limit))
  return { items: page, counts, total: filtered.length, sounds: discoverySounds(items), offset, limit }
}
