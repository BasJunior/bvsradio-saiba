/** Catalogue collection shelf cards + engagement ranking helpers */

export type CollectionCard = {
  name: string
  detail: string
  img: string
  /** Optional ISO date for "New" sort (project go-live / pack drop) */
  launchedAt?: string
}

export type TrendingRow = {
  name: string
  score: number
  plays: number
  rank?: number
  badge?: string
  statLine?: string
}

export function formatPlayCount(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return ''
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M plays`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k plays`
  return `${Math.round(n)} plays`
}

export function normalizeCollectionKey(name: string): string {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
}

/** Map free-text titles / artist lines onto a shelf card name */
export function matchCollectionName(
  haystack: string,
  cardNames: string[],
): string | null {
  const h = normalizeCollectionKey(haystack)
  if (!h) return null
  let best: string | null = null
  let bestLen = 0
  for (const name of cardNames) {
    const n = normalizeCollectionKey(name)
    if (!n) continue
    if (h === n || h.includes(n) || n.includes(h)) {
      if (n.length > bestLen) {
        best = name
        bestLen = n.length
      }
    }
  }
  return best
}

export function rankCollections(
  cards: CollectionCard[],
  scores: Record<string, { score: number; plays: number }>,
  mode: 'featured' | 'trending' | 'new',
): Array<CollectionCard & TrendingRow> {
  const withMeta = cards.map((card) => {
    const key = normalizeCollectionKey(card.name)
    const hit = scores[key] || scores[card.name] || { score: 0, plays: 0 }
    return {
      ...card,
      score: hit.score,
      plays: hit.plays,
      statLine: hit.plays > 0 ? formatPlayCount(hit.plays) : undefined,
    }
  })

  if (mode === 'featured') {
    return withMeta.map((c, i) => ({
      ...c,
      rank: i + 1,
      badge: undefined,
    }))
  }

  if (mode === 'new') {
    const sorted = [...withMeta].sort((a, b) => {
      const da = a.launchedAt ? Date.parse(a.launchedAt) : 0
      const db = b.launchedAt ? Date.parse(b.launchedAt) : 0
      if (db !== da) return db - da
      return a.name.localeCompare(b.name)
    })
    return sorted.map((c, i) => ({
      ...c,
      rank: i + 1,
      badge: i === 0 ? 'New' : undefined,
    }))
  }

  // trending
  const sorted = [...withMeta].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (b.plays !== a.plays) return b.plays - a.plays
    return a.name.localeCompare(b.name)
  })
  const maxScore = sorted[0]?.score || 0
  return sorted.map((c, i) => {
    let badge: string | undefined
    if (i === 0 && c.score > 0) badge = '#1'
    else if (i < 3 && c.score > 0 && maxScore > 0 && c.score >= maxScore * 0.35) badge = 'Hot'
    return { ...c, rank: i + 1, badge }
  })
}
