'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import TrendingBadge from '@/components/TrendingBadge'
import TrendingBoard from '@/components/TrendingBoard'
import LibraryAction from '@/components/LibraryAction'
import ExploreItemDetails, { type ExploreDetail } from '@/components/ExploreItemDetails'
import { trackEvent } from '@/lib/analytics'
import DiscoverMoreActions from '@/components/DiscoverMoreActions'
import DiscoverShelves from '@/components/DiscoverShelves'
import { buildDiscoveryShelves, soundKey, toDiscoveryTrack, type SearchItem, type SearchKind } from '@/lib/discovery-experience'
import { useStationPlayer } from '@/components/StationPlayer'
import { useDiscoverySearch } from '@/lib/use-discovery-search'
import { flowV2Flags } from '@/lib/feature-flags'

type ExploreMode = 'all' | 'fresh' | 'rotation' | 'playlists' | 'creators' | 'beats' | 'culture'

const filters: Array<{ label: string; value: 'all' | SearchKind }> = [
  { label: 'All', value: 'all' }, { label: 'Tracks', value: 'track' }, { label: 'Releases', value: 'release' }, { label: 'Playlists', value: 'playlist' },
  { label: 'Artists', value: 'artist' }, { label: 'Producers', value: 'producer' }, { label: 'Beats', value: 'beat' },
  { label: 'Shows', value: 'show' }, { label: 'Stories', value: 'story' }, { label: 'Services', value: 'service' }, { label: 'Products', value: 'product' },
]
const headings: Record<SearchKind, string> = { track: 'Tracks', release: 'Releases', playlist: 'Playlists', artist: 'Artists', producer: 'Producers', beat: 'Beats', show: 'Shows', story: 'Stories', service: 'Services', product: 'Products' }
const exploreModes: Array<{ value: ExploreMode; label: string; kinds: SearchKind[]; description: string }> = [
  { value: 'all', label: 'Discover', kinds: ['track', 'release', 'playlist', 'artist', 'producer', 'beat', 'show', 'story', 'service', 'product'], description: 'Music, beats, artists and shows together. Follow what catches your ear.' },
  { value: 'fresh', label: 'Fresh', kinds: ['track', 'release', 'playlist', 'beat', 'story'], description: 'Newest publicly published BVS music, playlists, beats and stories first.' },
  { value: 'rotation', label: 'On BVS', kinds: ['track'], description: 'Tracks currently cleared into the live BVS radio rotation.' },
  { value: 'playlists', label: 'Playlists', kinds: ['playlist'], description: 'Public playlists made by BVS listeners and creators.' },
  { value: 'creators', label: 'Creators', kinds: ['artist', 'producer'], description: 'Published artists and producers with real BVS profiles.' },
  { value: 'beats', label: 'Beats & Tools', kinds: ['beat', 'service', 'product', 'producer'], description: 'Published beats, creator services and the people offering them.' },
  { value: 'culture', label: 'Shows & Stories', kinds: ['show', 'story'], description: 'BVS programmes and editorial stories around the scene.' },
]

function supportsContextDetails(kind: SearchKind) {
  return kind === 'track' || kind === 'beat' || kind === 'release'
}

function flowDetailProps(item: SearchItem) {
  if (!supportsContextDetails(item.kind)) return {}
  return {
    'data-flow-detail-trigger': item.kind,
    'data-flow-detail-id': item.id.replace(/^(track|beat|release)-/, ''),
    'data-flow-detail-title': item.title,
    'data-flow-detail-artist': item.subtitle.split('·')[0]?.trim() || 'BVS creator',
    'data-flow-detail-image': item.image || '',
    'data-flow-detail-href': item.href,
  }
}

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | SearchKind>('all')
  const [mode, setMode] = useState<ExploreMode>('all')
  const [selectedDetail, setSelectedDetail] = useState<ExploreDetail | null>(null)
  const [genre, setGenre] = useState('')
  const [round, setRound] = useState(0)
  const [resultLimit, setResultLimit] = useState(40)
  const player = useStationPlayer()

  useEffect(() => {
    const sync = () => {
      const params = new URLSearchParams(window.location.search)
      const nextFilter = params.get('type') as SearchKind | null
      const nextMode = params.get('mode') as ExploreMode | null
      setQuery(params.get('q') || '')
      setGenre(soundKey(params.get('genre') || ''))
      setFilter(nextFilter && filters.some(item => item.value === nextFilter) ? nextFilter : 'all')
      setMode(nextMode && exploreModes.some(item => item.value === nextMode) ? nextMode : 'all')
    }
    sync()
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])

  const search = useDiscoverySearch({ q: query, type: filter, genre, mode: flowV2Flags.exploreModes ? mode : 'all', limit: resultLimit })
  const { items, counts, sounds } = search
  const results = items
  const loaded = !search.loading
  const unavailable = search.unavailable.length > 0

  const grouped = useMemo(() => filters.slice(1).map(({ value }) => ({
    kind: value as SearchKind,
    items: results.filter(item => item.kind === value).slice(0, filter === 'all' ? 8 : resultLimit),
  })).filter(group => group.items.length), [filter, results, resultLimit])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams()
      if (query.trim()) params.set('q', query.trim())
      if (filter !== 'all') params.set('type', filter)
      if (genre) params.set('genre', genre)
      if (flowV2Flags.exploreModes && mode !== 'all') params.set('mode', mode)
      window.history.replaceState(window.history.state, '', `/search${params.size ? `?${params}` : ''}`)
    }, 180)
    return () => window.clearTimeout(timer)
  }, [filter, mode, query, genre])

  useEffect(() => {
    const term = query.trim()
    if (term.length < 2 || results.length || !loaded || unavailable) return
    const timer = window.setTimeout(() => trackEvent('search_no_results', { query: /@|\+?\d[\d\s()-]{6,}/.test(term) ? '[redacted]' : term.toLowerCase().slice(0, 80), query_length: term.length, filter }), 800)
    return () => window.clearTimeout(timer)
  }, [filter, query, results.length, loaded, unavailable])

  const openResult = (item: SearchItem) => {
    trackEvent('search_result_open', { object_kind: item.kind, object_id: item.id })
    if (!item.detail) return
    trackEvent('flow_object_open', { object_kind: item.kind, object_id: item.id, source: 'explore_details' })
    setSelectedDetail(item.detail)
  }

  const shelves = useMemo(() => buildDiscoveryShelves(items, round, genre), [items, round, genre])
  const discoveryHome = flowV2Flags.exploreModes && mode === 'all' && !query.trim() && filter === 'all'
  const closeDetails = useCallback(() => setSelectedDetail(null), [])
  function playResult(item: SearchItem) {
    const track = toDiscoveryTrack(item)
    if (!track) return
    if (player.current?.id === track.id) player.toggle()
    else player.playNow(track, { from: item.kind === 'beat' ? 'BVS BeatStore' : 'Discover BVS' })
    trackEvent('flow_object_play', { object_kind: item.kind, object_id: item.id })
  }
  function browseShelf(kind: SearchKind) {
    setQuery(''); setFilter('all'); setResultLimit(40)
    if (kind === 'release') setMode('fresh')
    else if (kind === 'artist') setMode('creators')
    else if (kind === 'beat') setMode('beats')
    else if (kind === 'playlist') setMode('playlists')
    else if (kind === 'story') setMode('culture')
    else { setMode('all'); setFilter(kind) }
  }
  const activeMode = exploreModes.find(item => item.value === mode) || exploreModes[0]

  return <main className="bvs-square-discover mx-auto min-h-[70vh] max-w-7xl px-4 pb-12 pt-8 sm:px-6">
    {/* DISCOVER HEADER — one entry point for listening, people and creator tools. */}
    <header className="discover-masthead">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[.22em] text-brand">Independent sound · Open to discovery</p>
        <h1 className="bvs-directory-title mt-4">{mode === 'all' ? 'Find your next favourite.' : activeMode.label}</h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/65 sm:text-base">{activeMode.description}</p>
      </div>
      <div className="discover-quick-links" aria-label="Discover shortcuts">
        <Link href="/radio"><span className="text-brand">●</span> Listen live <span aria-hidden="true">↗</span></Link>
        <Link href="/catalogue?type=beat#beatstore">Find a beat <span aria-hidden="true">↗</span></Link>
        <Link href="/library">Your Library <span aria-hidden="true">↗</span></Link>
      </div>
    </header>

    {/* SEARCH & FILTERS — category and sound combine with the active browsing mode. */}
    <section className="discover-search-panel" aria-label="Search and browse BVS">
      <form role="search" onSubmit={event => { event.preventDefault(); document.getElementById('discover-results')?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }) }}>
        <label className="min-w-0 flex-1"><span className="sr-only">Search BVS</span><input type="search" value={query} onChange={event => { setQuery(event.target.value); setResultLimit(40) }} maxLength={160} placeholder="Search songs, artists, beats and more" /></label>
        <button type="submit" className="discover-search-submit">Search <span aria-hidden="true">↗</span></button>
      </form>
      <div className="discover-filter-row">
        <label><span>Category</span><select value={filter} onChange={event => { setFilter(event.target.value as 'all' | SearchKind); setResultLimit(40) }}>{filters.filter(item => item.value === 'all' || mode === 'all' || activeMode.kinds.includes(item.value as SearchKind)).map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label><span>Sound</span><select value={genre} onChange={event => { setGenre(event.target.value); setRound(0); setResultLimit(40) }}><option value="">All sounds</option>{genre && !sounds.some(sound => sound.key === genre) ? <option value={genre}>{genre}</option> : null}{sounds.map(sound => <option key={sound.key} value={sound.key}>{sound.label}</option>)}</select></label>
        <div className="discover-filter-summary"><span role="status">{loaded ? `${search.total} ${search.total === 1 ? 'result' : 'results'}${unavailable ? ' · partial results' : ''}` : 'Finding your next sound…'}</span>{query || genre || filter !== 'all' || mode !== 'all' ? <button type="button" onClick={() => { setQuery(''); setGenre(''); setFilter('all'); setMode('all'); setResultLimit(40) }}>Clear filters ×</button> : <span>Listen. Save. Follow.</span>}</div>
      </div>
    </section>
    {flowV2Flags.exploreModes ? <nav className="discover-mode-nav" aria-label="Explore modes">{exploreModes.map(item => <button key={item.value} type="button" onClick={() => { setMode(item.value); setFilter('all'); setResultLimit(40); trackEvent('explore_mode_change', { mode: item.value }) }} aria-pressed={mode === item.value}>{item.label}</button>)}</nav> : null}
    <div id="discover-results" className="scroll-mt-32" />
    {unavailable ? <div role="status" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/15 p-3 text-sm text-text-secondary"><span>Search is incomplete because some content could not be loaded. Retry to search everything.</span><button type="button" onClick={() => { search.retry() }} className="min-h-10 rounded-full border border-white/20 px-4 text-white">Retry loading</button></div> : null}
    {discoveryHome && shelves.length ? <DiscoverShelves trending={<TrendingBoard preview discover />} shelves={shelves} round={round} onMore={() => { setRound(value => value + 1); trackEvent('explore_rail_open', { genre: genre || 'all' }) }} onBrowse={browseShelf} onDetails={openResult} /> : null}
    {!discoveryHome && (!query.trim() && filter === 'all' ? <section className="mt-10" aria-label="Explore published BVS content"><h2 className="text-3xl font-semibold">{flowV2Flags.exploreModes ? activeMode.label : 'Discover now'}</h2><p className="mt-2 text-text-secondary">{flowV2Flags.exploreModes ? activeMode.description : 'Published and editorially visible BVS content.'}</p></section> : <h2 className="mt-10 text-3xl font-semibold">{query.trim() ? `Results for “${query.trim()}”` : headings[filter as SearchKind]}</h2>)}
    <div className="mt-7 space-y-12">
      {!discoveryHome && grouped.map(group => <section key={group.kind} aria-labelledby={`search-${group.kind}`}>
        <div className="mb-4 flex items-end justify-between">
          <h2 id={`search-${group.kind}`} className="text-2xl font-semibold">{headings[group.kind]}</h2>
          {filter === 'all' && (counts[group.kind] || 0) > 8 ? <button onClick={() => { setFilter(group.kind); setResultLimit(40) }} className="min-h-11 text-sm text-brand">View all →</button> : null}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {group.items.map(item => <article key={item.id} className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[.03] p-3 transition hover:border-brand/35">
            {toDiscoveryTrack(item) ? <button type="button" onClick={() => playResult(item)} aria-label={`${player.current?.id === toDiscoveryTrack(item)?.id && player.isPlaying ? 'Pause' : item.kind === 'beat' ? 'Preview' : 'Play'} ${item.title}`} className="relative shrink-0">            <span className="relative block h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white/5">{item.image ? <Image src={item.image} alt="" fill unoptimized={/^https?:\/\//.test(item.image) || item.image.startsWith('/api/media/')} className="object-cover" /> : <span className="absolute inset-0 grid place-items-center text-xs font-bold text-brand">BVS</span>}</span>
<span aria-hidden="true" className={`absolute inset-0 grid place-items-center bg-black/25 text-white transition-opacity ${player.current?.id === toDiscoveryTrack(item)?.id && player.isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'}`}>{player.current?.id === toDiscoveryTrack(item)?.id && player.isPlaying ? 'Ⅱ' : '▶'}</span></button> : item.detail ? <button type="button" onClick={() => openResult(item)} aria-label={`Details for ${item.title}`} className="shrink-0">            <span className="relative block h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white/5">{item.image ? <Image src={item.image} alt="" fill unoptimized={/^https?:\/\//.test(item.image) || item.image.startsWith('/api/media/')} className="object-cover" /> : <span className="absolute inset-0 grid place-items-center text-xs font-bold text-brand">BVS</span>}</span>
</button> : <Link href={item.href} aria-label={`Open ${item.title}`} className="shrink-0">            <span className="relative block h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white/5">{item.image ? <Image src={item.image} alt="" fill unoptimized={/^https?:\/\//.test(item.image) || item.image.startsWith('/api/media/')} className="object-cover" /> : <span className="absolute inset-0 grid place-items-center text-xs font-bold text-brand">BVS</span>}</span>
</Link>}
            {item.detail ? (
              <button type="button" onClick={() => openResult(item)} className="min-w-0 flex-1 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/70">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-brand">{item.badge || item.kind}</span>
                <h3 className="truncate text-lg">{item.title}</h3>
                <p className="truncate text-sm text-text-secondary">{item.subtitle}</p>
              </button>
            ) : (
              <Link {...flowDetailProps(item)} href={item.href} onClick={() => trackEvent('search_result_open', { object_kind: item.kind, object_id: item.id })} className="min-w-0 flex-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/70">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-brand">{item.badge || item.kind}</span>
                <h3 className="truncate text-lg">{item.title}</h3>
                <p className="truncate text-sm text-text-secondary">{item.subtitle}</p>
              </Link>
            )}
            {item.kind === 'track' ? <TrendingBadge trackId={item.id} /> : null}
            {['track','artist','producer','beat'].includes(item.kind) ? <DiscoverMoreActions title={item.title}>
              <LibraryAction item={{ ...item, kind: item.kind === 'beat' ? 'beat' : item.kind === 'track' ? 'track' : 'artist' }} section={item.kind === 'artist' || item.kind === 'producer' ? 'follows' : 'favourites'} compact />
              {item.detail ? <button type="button" onClick={() => openResult(item)} className="min-h-11 text-left text-sm text-brand">View details</button> : <Link {...flowDetailProps(item)} href={item.href} className="inline-flex min-h-11 items-center text-sm text-brand">View details →</Link>}
            </DiscoverMoreActions> : null}
          </article>)}
        </div>
        {filter !== 'all' && (counts[group.kind] || 0) > group.items.length ? <button type="button" onClick={() => setResultLimit(value => value + 40)} className="mt-4 min-h-11 rounded-full border border-white/20 px-5 text-sm text-brand">Show more {headings[group.kind].toLowerCase()} →</button> : null}
      </section>)}
      {loaded && !unavailable && results.length === 0 ? <div className="rounded-2xl border border-dashed border-white/15 px-6 py-14 text-center"><h3 className="text-xl">No matches for this search</h3><p className="mt-2 text-text-secondary">Try another term, mode or category. Explore another sound or clear your filters to find a new direction.</p><button onClick={() => { setQuery(''); setFilter('all'); setResultLimit(40); setGenre(''); setMode('all') }} className="mt-5 min-h-11 rounded-full bg-brand px-5 py-2 text-sm font-semibold text-black">Start discovering</button></div> : null}
      {!loaded ? <div className="grid gap-3 md:grid-cols-2" aria-label="Loading discovery"><div className="h-24 animate-pulse rounded-2xl bg-white/5"/><div className="h-24 animate-pulse rounded-2xl bg-white/5"/></div> : null}
    </div>
    {selectedDetail ? <ExploreItemDetails detail={selectedDetail} onClose={closeDetails} /> : null}
  </main>
}
