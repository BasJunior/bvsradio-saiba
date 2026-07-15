'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import LibraryAction from '@/components/LibraryAction'
import { discoveryItems, type DiscoveryKind } from '@/lib/discovery'
import { recordListening } from '@/lib/library'
import { trackEvent } from '@/lib/analytics'

const filters: Array<{ label: string; value: 'all' | DiscoveryKind }> = [
  { label: 'All', value: 'all' }, { label: 'Tracks', value: 'track' }, { label: 'Artists', value: 'artist' }, { label: 'Shows', value: 'show' },
]

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | DiscoveryKind>('all')
  const results = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return discoveryItems.filter((item) => (filter === 'all' || item.kind === filter) && (!needle || [item.title, item.subtitle, ...(item.tags || [])].join(' ').toLowerCase().includes(needle)))
  }, [query, filter])

  useEffect(() => {
    const term = query.trim()
    if (term.length < 2 || results.length > 0) return
    const timer = window.setTimeout(() => {
      const sensitive = /@|\+?\d[\d\s()-]{6,}/.test(term)
      trackEvent('search_no_results', { query: sensitive ? '[redacted]' : term.toLowerCase().slice(0, 80), query_length: term.length, filter })
    }, 800)
    return () => window.clearTimeout(timer)
  }, [filter, query, results.length])

  return <main className="mx-auto min-h-[70vh] max-w-6xl px-6 py-12">
    <p className="mb-3 text-xs uppercase tracking-[0.25em] text-brand">Discover BVS</p>
    <h1 className="text-4xl md:text-5xl">Search music, artists and shows</h1>
    <p className="mt-3 max-w-2xl text-text-secondary">Search only returns content currently published on BVS. New artist profiles and shows will appear here as they go live.</p>
    <label className="mt-8 block max-w-3xl">
      <span className="sr-only">Search BVS</span>
      <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try “WolfBrx”, “gospel” or “June Pack”" className="w-full rounded-2xl border border-white/15 bg-white/5 px-5 py-4 text-lg outline-none transition placeholder:text-text-secondary focus:border-brand" />
    </label>
    <div className="mt-5 flex flex-wrap gap-2" aria-label="Filter results">
      {filters.map(({ label, value }) => <button key={value} onClick={() => setFilter(value)} className={`rounded-full px-4 py-2 text-sm ${filter === value ? 'bg-brand text-black' : 'bg-white/5 text-text-secondary hover:text-white'}`}>{label}</button>)}
    </div>
    <div className="mt-10 space-y-3">
      {results.map((item) => <article key={item.id} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3 transition hover:border-white/20">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white/5">{item.image && <Image src={item.image} alt="" fill className="object-cover" />}</div>
        <Link href={item.href} onClick={() => item.kind === 'track' && recordListening(item)} className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-wider text-brand">{item.kind}</div><h2 className="truncate text-lg">{item.title}</h2><p className="truncate text-sm text-text-secondary">{item.subtitle}</p>
        </Link>
        <LibraryAction item={item} section={item.kind === 'artist' ? 'follows' : 'favourites'} compact />
      </article>)}
      {results.length === 0 && <div className="rounded-2xl border border-dashed border-white/15 px-6 py-14 text-center"><h2 className="text-xl">Nothing published under that search yet</h2><p className="mt-2 text-text-secondary">Try another term, or browse everything currently available.</p><Link href="/catalogue" className="mt-5 inline-block rounded-full bg-brand px-5 py-2 text-sm font-semibold text-black">Browse the catalogue</Link></div>}
    </div>
  </main>
}
