/**
 * Helpers for editorial ISRC suggestions from known_isrc_map.
 * Used when linking Amuse/DSP catalogue codes to BVS release tracks.
 */

export type KnownIsrcEntry = {
  isrc: string
  title?: string | null
  artist_name?: string | null
  upc?: string | null
  spotify_album_url?: string | null
  source?: string | null
}

export type KnownIsrcSuggestion = KnownIsrcEntry & {
  score: number
}

/** Normalize titles for loose matching (case, punctuation, spacing). */
export function normalizeTitle(value: string): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’`]/g, "'")
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9'\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenSet(value: string): Set<string> {
  return new Set(
    normalizeTitle(value)
      .split(' ')
      .map((token) => token.trim())
      .filter((token) => token.length > 1),
  )
}

/** Jaccard similarity on title tokens, with exact/prefix bonuses. Range 0–1. */
export function titleSimilarity(a: string, b: string): number {
  const na = normalizeTitle(a)
  const nb = normalizeTitle(b)
  if (!na || !nb) return 0
  if (na === nb) return 1

  const shorter = na.length <= nb.length ? na : nb
  const longer = na.length <= nb.length ? nb : na
  if (longer.startsWith(shorter) && shorter.length >= 4) {
    return 0.92
  }
  if (longer.includes(shorter) && shorter.length >= 5) {
    return 0.85
  }

  const ta = tokenSet(na)
  const tb = tokenSet(nb)
  if (!ta.size || !tb.size) return 0

  let intersection = 0
  for (const token of ta) {
    if (tb.has(token)) intersection += 1
  }
  const union = ta.size + tb.size - intersection
  if (!union) return 0
  return intersection / union
}

function artistBoost(entryArtist: string | null | undefined, preferredArtist?: string): number {
  if (!preferredArtist) return 0
  const a = normalizeTitle(preferredArtist)
  const b = normalizeTitle(entryArtist || '')
  if (!a || !b) return 0
  if (a === b) return 0.12
  if (a.includes(b) || b.includes(a)) return 0.08
  return 0
}

/**
 * Rank known_isrc_map rows against a track title (optional artist bias).
 * Returns top matches above a soft threshold.
 */
export function suggestIsrcs(
  title: string,
  map: KnownIsrcEntry[],
  options?: { artistName?: string; limit?: number; minScore?: number; query?: string },
): KnownIsrcSuggestion[] {
  const limit = Math.max(1, Math.min(20, options?.limit ?? 6))
  const minScore = options?.minScore ?? 0.35
  const query = options?.query?.trim()
  const baseTitle = query || title

  const ranked = map
    .map((entry) => {
      let titleScore = titleSimilarity(baseTitle, entry.title || '')
      // Allow direct ISRC prefix search when the editor types a code.
      if (query) {
        const q = query.toLowerCase()
        const isrc = String(entry.isrc || '').toLowerCase()
        if (isrc.startsWith(q) || isrc.includes(q)) {
          titleScore = Math.max(titleScore, q.length >= 4 ? 0.95 : 0.7)
        }
        titleScore = Math.max(titleScore, titleSimilarity(query, entry.title || ''))
      }
      const boost = artistBoost(entry.artist_name, options?.artistName)
      const score = Math.min(1, titleScore + boost)
      return { ...entry, score, titleScore }
    })
    .filter((entry) => entry.score >= minScore)
    // Prefer stronger title match, then combined score, then shorter/more exact titles.
    .sort((a, b) =>
      b.titleScore - a.titleScore ||
      b.score - a.score ||
      String(a.title || '').length - String(b.title || '').length ||
      String(a.title || '').localeCompare(String(b.title || '')),
    )

  const seen = new Set<string>()
  const unique: KnownIsrcSuggestion[] = []
  for (const entry of ranked) {
    const key = String(entry.isrc || '').toUpperCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    unique.push(entry)
    if (unique.length >= limit) break
  }
  return unique
}

/** Best single auto-suggestion for a track title, or null. */
export function bestIsrcMatch(
  title: string,
  map: KnownIsrcEntry[],
  options?: { artistName?: string; minScore?: number },
): KnownIsrcSuggestion | null {
  const [top] = suggestIsrcs(title, map, {
    artistName: options?.artistName,
    limit: 1,
    minScore: options?.minScore ?? 0.72,
  })
  return top || null
}

/** Normalize user-entered ISRC (strip spaces/dashes, uppercase). */
export function normalizeIsrc(value: string): string {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 15)
}

export function isValidIsrcFormat(value: string): boolean {
  const normalized = normalizeIsrc(value)
  // ISRC: 2 letter country + 3 alnum registrant + 2 year + 5 designation = 12
  return /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(normalized)
}
