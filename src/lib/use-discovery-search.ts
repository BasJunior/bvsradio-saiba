'use client'
import { useEffect, useRef, useState } from 'react'
import type { DiscoverySearchResponse } from './discovery-search-results'

const empty: DiscoverySearchResponse = { items: [], counts: {}, total: 0, sounds: [], unavailable: [], offset: 0, limit: 40 }

/** Debounced, abortable search. Load more appends database pages, without a result ceiling. */
export function useDiscoverySearch(params: { q: string; type?: string; genre?: string; mode?: string; surface?: string; limit?: number; view?: string }, enabled = true) {
  const { limit = 40, ...filters } = params
  const base = new URLSearchParams(Object.entries(filters).map(([key, value]) => [key, String(value ?? '')])).toString()
  const key = `${base}&requested=${limit}`
  const [state, setState] = useState<{ key: string; data: DiscoverySearchResponse; loading: boolean }>({ key: '', data: empty, loading: true })
  const completed = useRef<{ base: string; limit: number; data: DiscoverySearchResponse } | null>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    const previous = completed.current
    const resume = previous?.base === base && previous.limit < limit && !previous.data.unavailable.length
    const initial = resume ? previous.data : empty
    setState({ key, data: initial, loading: true })
    const timer = window.setTimeout(async () => {
      let data = initial
      try {
        for (let offset = resume ? previous.limit : 0; offset < limit;) {
          const size = Math.min(100, limit - offset)
          const response = await fetch(`/api/search?${base}&offset=${offset}&limit=${size}`, { signal: controller.signal, cache: 'no-store' })
          if (!response.ok) throw new Error('Search unavailable')
          const page = await response.json() as DiscoverySearchResponse
          if (!Array.isArray(page.items) || !page.counts || !Array.isArray(page.unavailable)) throw new Error('Invalid search response')
          data = { ...page, items: [...new Map([...data.items, ...page.items].map(item => [item.id, item])).values()] }
          offset += size
          if (!page.items.length) break
        }
        if (!controller.signal.aborted) {
          completed.current = { base, limit, data }
          setState({ key, data, loading: false })
        }
      } catch {
        if (!controller.signal.aborted) setState({ key, data: { ...data, unavailable: ['search'] }, loading: false })
      }
    }, new URLSearchParams(base).get('q')?.trim() ? 200 : 0)
    return () => { controller.abort(); window.clearTimeout(timer) }
  }, [base, key, limit, enabled, attempt])
  const current = state.key === key && enabled ? state : { data: empty, loading: enabled }
  return { ...current.data, loading: current.loading, retry: () => { completed.current = null; setAttempt(value => value + 1) } }
}
