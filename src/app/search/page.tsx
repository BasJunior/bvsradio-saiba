'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import LibraryAction from '@/components/LibraryAction'
import { discoveryItems } from '@/lib/discovery'
import { trackEvent } from '@/lib/analytics'
import type { PublishedArtistSummary, PublishedProducerSummary } from '@/lib/artist-content'
import { blogPosts } from '@/lib/blog'
import { officialBvsServices } from '@/lib/official-services'
import { flowV2Flags } from '@/lib/feature-flags'

type SearchKind = 'track' | 'release' | 'artist' | 'producer' | 'beat' | 'show' | 'story' | 'service'
type SearchItem = {
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
}
type PublicBeat = {
  id: string
  title: string
  producer: string
  producer_username?: string
  genre?: string
  mood?: string
  artworkUrl?: string
  bpm?: number
  published_at?: string
  created_at?: string
}
type PublicRelease = { id: string; title: string; artist?: string; cover?: string; publishedAt?: string }
type MarketplaceListing = { id: string; listing_type: string; title: string; slug: string; category?: string; description?: string; artwork_path?: string; price_usd?: number; profiles?: { username?: string; display_name?: string } }
type CatalogueTrack = {
  id: string
  title: string
  artist: string
  genre?: string
  collection?: string
  artwork?: string
  type: string
  source: string
  publishedAt?: string
  inRotation?: boolean
  featured?: boolean
}
type ExploreMode = 'fresh' | 'rotation' | 'creators' | 'beats' | 'culture'

const filters: Array<{ label: string; value: 'all' | SearchKind }> = [
  { label: 'All', value: 'all' }, { label: 'Tracks', value: 'track' }, { label: 'Releases', value: 'release' },
  { label: 'Artists', value: 'artist' }, { label: 'Producers', value: 'producer' }, { label: 'Beats', value: 'beat' },
  { label: 'Shows', value: 'show' }, { label: 'Stories', value: 'story' }, { label: 'Services', value: 'service' },
]
const headings: Record<SearchKind, string> = { track: 'Tracks', release: 'Releases', artist: 'Artists', producer: 'Producers', beat: 'Beats', show: 'Shows', story: 'Stories', service: 'Services' }
const exploreModes: Array<{ value: ExploreMode; label: string; kinds: SearchKind[]; description: string }> = [
  { value: 'fresh', label: 'Fresh', kinds: ['track', 'release', 'beat', 'story'], description: 'Newest publicly published BVS music, beats and stories first.' },
  { value: 'rotation', label: 'On BVS', kinds: ['track'], description: 'Tracks currently cleared into the live BVS radio rotation.' },
  { value: 'creators', label: 'Creators', kinds: ['artist', 'producer'], description: 'Published artists and producers with real BVS profiles.' },
  { value: 'beats', label: 'Beats & Tools', kinds: ['beat', 'service', 'producer'], description: 'Published beats, creator services and the people offering them.' },
  { value: 'culture', label: 'Shows & Stories', kinds: ['show', 'story'], description: 'BVS programmes and editorial stories around the scene.' },
]

function imageUrl(value?: string) {
  if (!value || value.includes('default-avatar')) return undefined
  if (/^(https?:\/\/|\/)/.test(value)) return value
  return `/api/media/${value.split('/').map(encodeURIComponent).join('/')}`
}

function timeValue(value?: string) {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function orderForExploreMode(items: SearchItem[], mode: ExploreMode) {
  if (mode === 'fresh') {
    return [...items].sort((a, b) => timeValue(b.publishedAt) - timeValue(a.publishedAt) || a.title.localeCompare(b.title))
  }
  if (mode === 'rotation') {
    return items.filter(item => item.kind === 'track' && item.onBvs === true)
  }
  if (mode === 'beats') {
    return [...items].sort((a, b) => {
      const dated = timeValue(b.publishedAt) - timeValue(a.publishedAt)
      if (dated) return dated
      return a.title.localeCompare(b.title)
    })
  }
  if (mode === 'culture') {
    return [...items].sort((a, b) => timeValue(b.publishedAt) - timeValue(a.publishedAt) || a.title.localeCompare(b.title))
  }
  return items
}

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | SearchKind>('all')
  const [mode, setMode] = useState<ExploreMode>('fresh')
  const [artists, setArtists] = useState<PublishedArtistSummary[]>([])
  const [producers, setProducers] = useState<PublishedProducerSummary[]>([])
  const [beats, setBeats] = useState<PublicBeat[]>([])
  const [releases, setReleases] = useState<PublicRelease[]>([])
  const [services, setServices] = useState<MarketplaceListing[]>([])
  const [catalogueTracks, setCatalogueTracks] = useState<CatalogueTrack[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const sync = () => {
      const params = new URLSearchParams(window.location.search)
      const nextFilter = params.get('type') as SearchKind | null
      const nextMode = params.get('mode') as ExploreMode | null
      setQuery(params.get('q') || '')
      setFilter(nextFilter && filters.some(item => item.value === nextFilter) ? nextFilter : 'all')
      setMode(nextMode && exploreModes.some(item => item.value === nextMode) ? nextMode : 'fresh')
    }
    sync()
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])

  useEffect(() => {
    let active = true
    Promise.all([
      fetch('/api/artists').then(r => r.ok ? r.json() : { artists: [] }),
      fetch('/api/producers').then(r => r.ok ? r.json() : { producers: [] }),
      fetch('/api/beats').then(r => r.ok ? r.json() : { beats: [] }),
      fetch('/api/releases/public').then(r => r.ok ? r.json() : { releases: [] }),
      fetch('/api/marketplace').then(r => r.ok ? r.json() : { listings: [] }),
      fetch('/api/catalogue/listings').then(r => r.ok ? r.json() : { listings: [] }),
    ]).then(([a, p, b, r, m, c]) => {
      if (!active) return
      setArtists(a.artists || [])
      setProducers(p.producers || [])
      setBeats(b.beats || [])
      setReleases(r.releases || [])
      setServices((m.listings || []).filter((item: MarketplaceListing) => item.listing_type === 'service'))
      const liveTracks = (c.listings || []).filter((item: CatalogueTrack) => item.source === 'track' && item.type !== 'beat')
      setCatalogueTracks(liveTracks)
      setLoaded(true)
    }).catch(() => setLoaded(true))
    return () => { active = false }
  }, [])

  const items = useMemo<SearchItem[]>(() => {
    const producerIds = new Set(producers.map(item => item.id))
    const local = discoveryItems.map<SearchItem>(item => {
      const isRelease = item.id.startsWith('album-') || item.tags?.includes('album')
      const isBeat = item.tags?.includes('beat') && !isRelease
      return { ...item, kind: isRelease ? 'release' : isBeat ? 'beat' : item.kind }
    })
    return [
      ...local.filter(item => item.kind !== 'artist' && (item.kind !== 'track' || catalogueTracks.length === 0)),
      ...catalogueTracks.map(item => ({
        id: `track-${item.id}`,
        kind: 'track' as const,
        title: item.title,
        subtitle: `${item.artist} · ${item.collection || 'Published on BVS'}`,
        href: `/catalogue?q=${encodeURIComponent(item.title)}`,
        image: imageUrl(item.artwork),
        tags: [item.genre || '', item.artist],
        publishedAt: item.publishedAt,
        onBvs: item.inRotation === true,
      })),
      ...artists.filter(item => !producerIds.has(item.id)).map(item => ({ id: `artist-${item.id}`, kind: 'artist' as const, title: item.name, subtitle: `${item.role} · ${item.trackCount} published ${item.trackCount === 1 ? 'track' : 'tracks'}`, href: `/artist/${item.username}`, image: item.image, tags: item.genres })),
      ...producers.map(item => ({ id: `producer-${item.id}`, kind: 'producer' as const, title: item.name, subtitle: `Producer · ${item.beatCount} published ${item.beatCount === 1 ? 'beat' : 'beats'}`, href: `/artist/${item.username}`, image: item.image, tags: item.genres })),
      ...beats.map(item => ({ id: `beat-${item.id}`, kind: 'beat' as const, title: item.title, subtitle: `${item.producer} · ${item.genre || 'BeatStore'}${item.bpm ? ` · ${item.bpm} BPM` : ''}`, href: `/catalogue?type=beat&q=${encodeURIComponent(item.title)}#beatstore`, image: item.artworkUrl, tags: [item.genre || '', item.mood || ''], publishedAt: item.published_at || item.created_at })),
      ...releases.map(item => ({ id: `release-${item.id}`, kind: 'release' as const, title: item.title, subtitle: `${item.artist || 'BVS creator'} · Release`, href: `/album/${item.id}`, image: item.cover, publishedAt: item.publishedAt })),
      ...services.map(item => ({ id: `service-${item.id}`, kind: 'service' as const, title: item.title, subtitle: `${item.category?.replaceAll('_', ' ') || 'Creator service'}${item.price_usd ? ` · $${item.price_usd}` : ''}`, href: `/marketplace?listing=${encodeURIComponent(item.slug)}`, image: imageUrl(item.artwork_path), tags: [item.category || '', item.description || ''] })),
      ...officialBvsServices.map(item => ({ id: `official-service-${item.id}`, kind: 'service' as const, title: item.title, subtitle: `${item.category} · ${item.price}`, href: `/shop#services`, image: '/images/hero-studio.jpg', tags: [item.category, item.desc, item.engineer, 'official bvs'], badge: 'Official BVS' })),
      ...blogPosts.map(item => ({ id: `story-${item.slug}`, kind: 'story' as const, title: item.title, subtitle: `${item.readTime} · BVS story`, href: `/blog/${item.slug}`, tags: [item.description], publishedAt: item.date })),
    ]
  }, [artists, beats, catalogueTracks, producers, releases, services])

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const modeKinds = exploreModes.find(item => item.value === mode)?.kinds || []
    const matched = items.filter(item => {
      const matchesFilter = filter === 'all' || item.kind === filter
      const matchesQuery = !needle || [item.title, item.subtitle, ...(item.tags || [])].join(' ').toLowerCase().includes(needle)
      const matchesMode = !flowV2Flags.exploreModes || needle || filter !== 'all' || modeKinds.includes(item.kind)
      return matchesFilter && matchesQuery && matchesMode
    })
    if (!flowV2Flags.exploreModes || needle || filter !== 'all') return matched
    return orderForExploreMode(matched, mode)
  }, [filter, items, mode, query])

  const grouped = useMemo(() => filters.slice(1).map(({ value }) => ({
    kind: value as SearchKind,
    items: results.filter(item => item.kind === value).slice(0, filter === 'all' ? 8 : 40),
  })).filter(group => group.items.length), [filter, results])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams()
      if (query.trim()) params.set('q', query.trim())
      if (filter !== 'all') params.set('type', filter)
      if (flowV2Flags.exploreModes && !query.trim() && filter === 'all') params.set('mode', mode)
      window.history.replaceState(window.history.state, '', `/search${params.size ? `?${params}` : ''}`)
    }, 180)
    return () => window.clearTimeout(timer)
  }, [filter, mode, query])

  useEffect(() => {
    const term = query.trim()
    if (term.length < 2 || results.length) return
    const timer = window.setTimeout(() => trackEvent('search_no_results', { query: /@|\+?\d[\d\s()-]{6,}/.test(term) ? '[redacted]' : term.toLowerCase().slice(0, 80), query_length: term.length, filter }), 800)
    return () => window.clearTimeout(timer)
  }, [filter, query, results.length])

  const activeMode = exploreModes.find(item => item.value === mode) || exploreModes[0]

  return <main className="mx-auto min-h-[70vh] max-w-7xl px-4 py-12 sm:px-6">
    <p className="mb-3 text-xs uppercase tracking-[0.25em] text-brand">Explore BVS</p>
    <h1 className="text-4xl md:text-5xl">Music, creators and the scene around them</h1>
    <p className="mt-3 max-w-2xl text-text-secondary">Search published BVS content or move through recent music, verified creators, BeatStore and programmes.</p>
    <label className="mt-8 block max-w-3xl"><span className="sr-only">Search BVS</span><input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder="Try “Wolf Bridges”, “gospel” or “June Pack”" className="w-full rounded-2xl border border-white/15 bg-white/5 px-5 py-4 text-lg outline-none transition placeholder:text-text-secondary focus:border-brand" /></label>
    {flowV2Flags.exploreModes && !query.trim() ? <div className="mt-5 flex gap-2 overflow-x-auto pb-2" aria-label="Explore modes">{exploreModes.map(item => <button key={item.value} type="button" onClick={() => { setMode(item.value); setFilter('all'); trackEvent('explore_mode_change', { mode: item.value }) }} aria-pressed={mode === item.value} className={`min-h-11 shrink-0 rounded-full px-4 py-2 text-sm ${mode === item.value ? 'bg-brand text-black' : 'border border-white/10 bg-white/[.03] text-text-secondary hover:text-white'}`}>{item.label}</button>)}</div> : null}
    <div className="mt-5 flex gap-2 overflow-x-auto pb-2" aria-label="Filter results">{filters.map(item => <button key={item.value} onClick={() => setFilter(item.value)} aria-pressed={filter === item.value} className={`min-h-11 shrink-0 rounded-full px-4 py-2 text-sm ${filter === item.value ? 'bg-brand text-black' : 'bg-white/5 text-text-secondary hover:text-white'}`}>{item.label}</button>)}</div>

    {!query.trim() && filter === 'all' ? <section className="mt-10" aria-label="Explore published BVS content"><h2 className="text-3xl font-semibold">{flowV2Flags.exploreModes ? activeMode.label : 'Discover now'}</h2><p className="mt-2 text-text-secondary">{flowV2Flags.exploreModes ? activeMode.description : 'Published and editorially visible BVS content.'}</p></section> : <h2 className="mt-10 text-3xl font-semibold">{query.trim() ? `Results for “${query.trim()}”` : headings[filter as SearchKind]}</h2>}
    <div className="mt-7 space-y-12">
      {grouped.map(group => <section key={group.kind} aria-labelledby={`search-${group.kind}`}><div className="mb-4 flex items-end justify-between"><h2 id={`search-${group.kind}`} className="text-2xl font-semibold">{headings[group.kind]}</h2>{filter === 'all' && results.filter(item => item.kind === group.kind).length > 8 ? <button onClick={() => setFilter(group.kind)} className="min-h-11 text-sm text-brand">View all →</button> : null}</div><div className="grid gap-3 md:grid-cols-2">{group.items.map(item => <article key={item.id} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[.03] p-3 transition hover:border-brand/35"><div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white/5">{item.image ? <Image src={item.image} alt="" fill unoptimized={/^https?:\/\//.test(item.image)} className="object-cover" /> : <span className="absolute inset-0 grid place-items-center text-xs font-bold text-brand">BVS</span>}</div><Link href={item.href} onClick={() => trackEvent('search_result_open', { object_kind: item.kind, object_id: item.id })} className="min-w-0 flex-1"><span className="text-[10px] font-semibold uppercase tracking-wider text-brand">{item.badge || item.kind}</span><h3 className="truncate text-lg">{item.title}</h3><p className="truncate text-sm text-text-secondary">{item.subtitle}</p></Link>{['track','artist','producer'].includes(item.kind) ? <LibraryAction item={{ ...item, kind: item.kind === 'track' ? 'track' : 'artist' }} section={item.kind === 'track' ? 'favourites' : 'follows'} compact /> : <Link href={item.href} className="min-h-11 rounded-full border border-white/15 px-4 py-2.5 text-sm text-brand">{item.kind === 'beat' ? 'Preview' : item.kind === 'story' ? 'Read' : 'Open'}</Link>}</article>)}</div></section>)}
      {loaded && results.length === 0 ? <div className="rounded-2xl border border-dashed border-white/15 px-6 py-14 text-center"><h3 className="text-xl">Nothing published under that view yet</h3><p className="mt-2 text-text-secondary">Try another term, mode or category. BVS will not invent content to fill the space.</p><button onClick={() => { setQuery(''); setFilter('all'); setMode('fresh') }} className="mt-5 min-h-11 rounded-full bg-brand px-5 py-2 text-sm font-semibold text-black">Explore Fresh</button></div> : null}
      {!loaded ? <div className="grid gap-3 md:grid-cols-2" aria-label="Loading discovery"><div className="h-24 animate-pulse rounded-2xl bg-white/5"/><div className="h-24 animate-pulse rounded-2xl bg-white/5"/></div> : null}
    </div>
  </main>
}
