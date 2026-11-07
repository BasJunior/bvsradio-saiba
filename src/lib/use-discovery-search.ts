'use client'
import { useEffect, useRef, useState } from 'react'
import type { DiscoverySearchResponse } from './discovery-search-results'

const empty: DiscoverySearchResponse = { items: [], counts: {}, total: 0, sounds: [], unavailable: [], offset: 0, limit: 40 }

/**
 * Short-lived session cache of complete results, so returning to Discover from
 * another tab shows the same picks instantly (and the remembered scroll
 * position exists) instead of reloading and reshuffling.
 */
const RESULT_TTL_MS = 3 * 60 * 1000
const results = new Map<string, { at: number; base: string; limit: number; data: DiscoverySearchResponse }>()
function freshResult(key: string) {
  const hit = results.get(key)
  if (!hit) return null
  if (Date.now() - hit.at > RESULT_TTL_MS) { results.delete(key); return null }
  return hit
}

/** Debounced, abortable search. Load more appends database pages, without a result ceiling. */
export function useDiscoverySearch(params: { q: string; type?: string; genre?: string; mode?: string; surface?: string; limit?: number; view?: string }, enabled = true) {
  const { limit = 40, ...filters } = params
  const base = new URLSearchParams(Object.entries(filters).map(([key, value]) => [key, String(value ?? '')])).toString()
  const key = `${base}&requested=${limit}`
  const [state, setState] = useState<{ key: string; data: DiscoverySearchResponse; loading: boolean }>(() => {
    const cached = enabled ? freshResult(key) : null
    return cached ? { key, data: cached.data, loading: false } : { key: '', data: empty, loading: true }
  })
  const completed = useRef<{ base: string; limit: number; data: DiscoverySearchResponse } | null>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!enabled) return
    const cached = attempt === 0 ? freshResult(key) : null
    if (cached) {
      completed.current = { base: cached.base, limit: cached.limit, data: cached.data }
      // Pin the cached result into state so it outlives the cache entry.
      const pin = window.setTimeout(() => setState({ key, data: cached.data, loading: false }), 0)
      return () => window.clearTimeout(pin)
    }
    const controller = new AbortController()
    let active = true
    let deadline: number | undefined
    const previous = completed.current
    const resume = previous?.base === base && previous.limit < limit && !previous.data.unavailable.length
    const initial = resume ? previous.data : empty
    setState({ key, data: initial, loading: true })
    const timer = window.setTimeout(async () => {
      deadline = window.setTimeout(() => controller.abort(), 12000)
      let data = initial
      try {
        for (let offset = resume ? previous.limit : 0; offset < limit;) {
          const size = Math.min(100, limit - offset)
          const response = await fetch(`/api/search?${base}&offset=${offset}&limit=${size}`, { signal: controller.signal, cache: 'no-store' })
          if (!response.ok) throw new Error('Search unavailable')
          const page = await response.json() as DiscoverySearchResponse
          if (!page || !Array.isArray(page.items) || !page.counts || !Array.isArray(page.unavailable)) throw new Error('Invalid search response')
          data = { ...page, items: [...new Map([...data.items, ...page.items].map(item => [item.id, item])).values()] }
          offset += size
          if (!page.items.length) break
        }
        if (!controller.signal.aborted) {
          completed.current = { base, limit, data }
          if (!data.unavailable.length) results.set(key, { at: Date.now(), base, limit, data })
          setState({ key, data, loading: false })
        }
      } catch {
        if (active) setState({ key, data: { ...data, unavailable: ['search'] }, loading: false })
      } finally {
        window.clearTimeout(deadline)
      }
    }, new URLSearchParams(base).get('q')?.trim() ? 200 : 0)
    return () => { active = false; controller.abort(); window.clearTimeout(timer); window.clearTimeout(deadline) }
  }, [base, key, limit, enabled, attempt])
  const cachedNow = enabled && attempt === 0 && state.key !== key ? freshResult(key) : null
  const current = state.key === key && enabled ? state : cachedNow ? { data: cachedNow.data, loading: false } : { data: empty, loading: enabled }
  return { ...current.data, loading: current.loading, retry: () => { completed.current = null; setAttempt(value => value + 1) } }
}
