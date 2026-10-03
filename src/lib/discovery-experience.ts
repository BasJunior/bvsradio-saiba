import type { ExploreDetail } from '@/components/ExploreItemDetails'
import { fairCreatorDailyOrder } from '@/lib/fair-discovery-order'

export type SearchKind = 'track' | 'release' | 'playlist' | 'artist' | 'producer' | 'beat' | 'show' | 'story' | 'service'
export type SearchItem = {
  id: string
  kind: SearchKind
  title: string
  subtitle: string
  href: string
  image?: string
  tags?: string[]
  badge?: string
  publishedAt?: string
  onBvs?: boolean
  detail?: ExploreDetail
}

// Keep spelling variants together without turning artists or moods into genres.
export function soundKey(value?: string) {
  return (value || '').trim().toLowerCase().replace(/hip[ -]?hop/g, 'hip-hop').replace(/r\s*&\s*b|rnb/g, 'r&b')
}
export function itemSounds(item: SearchItem) {
  const genres = item.detail?.genre ? [item.detail.genre] : item.kind === 'artist' || item.kind === 'producer' ? item.tags || [] : []
  return genres.flatMap(value => value.split(/[,/|]/)).map(soundKey).filter(Boolean)
}
export function discoverySounds(items: SearchItem[]) {
  const counts = new Map<string, number>()
  for (const item of items) for (const sound of new Set(itemSounds(item))) counts.set(sound, (counts.get(sound) || 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 10).map(([key]) => ({ key, label: key === 'hip-hop' ? 'Hip-Hop' : key === 'r&b' ? 'R&B' : key.replace(/\b\w/g, c => c.toUpperCase()) }))
}
export function matchesSound(item: SearchItem, genre: string) {
  return !genre || itemSounds(item).includes(soundKey(genre))
}
export function discoveryCreatorKey(value?: string) {
  return (value || '').split(/,|\s+(?:ft\.?|feat\.?|featuring|x|&)\s+/i)[0].trim().toLowerCase()
}
export function toDiscoveryTrack(item: SearchItem) {
  const detail = item.detail
  if ((item.kind !== 'track' && item.kind !== 'beat') || !detail?.src) return null
  return { id: detail.id, title: item.title, artist: detail.artist, src: detail.src, artwork: item.image, genre: detail.genre, project: item.kind === 'beat' ? 'BVS BeatStore' : detail.collection || 'Discover BVS' }
}
export type DiscoveryShelf = { id: string; title: string; description: string; kind: SearchKind; items: SearchItem[] }
const date = (value?: string) => { const parsed = Date.parse(value || ''); return Number.isFinite(parsed) ? parsed : 0 }

export function buildDiscoveryShelves(items: SearchItem[], round = 0, genre = '', now = new Date()): DiscoveryShelf[] {
  const unique = [...new Map(items.filter(item => matchesSound(item, genre)).map(item => [`${item.kind}:${item.id}`, item])).values()]
  const pick = (pool: SearchItem[], scope: string, size = 6) => {
    const ordered = fairCreatorDailyOrder(pool, `discover:${scope}`, item => discoveryCreatorKey(item.detail?.artist) || (item.kind === 'artist' || item.kind === 'producer' ? item.id : item.subtitle.split('·')[0]), now)
    if (!ordered.length) return []
    const offset = (Math.max(0, round) * Math.min(size, Math.max(1, ordered.length - size))) % ordered.length
    return [...ordered.slice(offset), ...ordered.slice(0, offset)].slice(0, size)
  }
  const tracks = unique.filter(item => item.kind === 'track' && toDiscoveryTrack(item))
  const fresh = unique.filter(item => (item.kind === 'release' || item.kind === 'track') && date(item.publishedAt) > 0).sort((a, b) => date(b.publishedAt) - date(a.publishedAt)).slice(0, 6)
  return [
    { id:'listen', title:'A new sound for you', description:'A rotating selection across BVS artists. Press play and see what stays with you.', kind:'track' as const, items:pick(tracks, 'music') },
    { id:'fresh', title:'Fresh arrivals', description:'The latest published tracks and releases, newest first.', kind:'release' as const, items:fresh },
    { id:'creators', title:'Meet your next favourite artist', description:'Explore their music. Follow the people behind it.', kind:'artist' as const, items:pick(unique.filter(item => item.kind === 'artist' || item.kind === 'producer'), 'creators') },
    { id:'beats', title:'Find your next beat', description:'New directions for your next track. Listen to the tagged previews.', kind:'beat' as const, items:pick(unique.filter(item => item.kind === 'beat' && item.detail), 'beats') },
    { id:'playlists', title:'Take the longer route', description:'Public playlists built by BVS listeners and creators.', kind:'playlist' as const, items:pick(unique.filter(item => item.kind === 'playlist'), 'playlists') },
    { id:'culture', title:'Beyond the music', description:'Stories from the scene and BVS programme previews.', kind:'story' as const, items:pick(unique.filter(item => item.kind === 'story' || item.kind === 'show'), 'culture', 4) },
  ].filter(shelf => shelf.items.length)
}
