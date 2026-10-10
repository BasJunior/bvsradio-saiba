'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import LibraryAction from '@/components/LibraryAction'
import ExploreItemDetails, { type ExploreDetail } from '@/components/ExploreItemDetails'
import { matchesDiscoveryQuery } from '@/lib/discovery-search'
import { discoveryItems } from '@/lib/discovery'
import { trackEvent } from '@/lib/analytics'
import type { PublishedArtistSummary, PublishedProducerSummary } from '@/lib/artist-content'
import { blogPosts } from '@/lib/blog'
import { officialBvsServices } from '@/lib/official-services'
import DiscoverMoreActions from '@/components/DiscoverMoreActions'
import DiscoverShelves from '@/components/DiscoverShelves'
import { buildDiscoveryShelves, discoverySounds, matchesSound, soundKey, toDiscoveryTrack, type SearchItem, type SearchKind } from '@/lib/discovery-experience'
import { useStationPlayer } from '@/components/StationPlayer'
import { flowV2Flags } from '@/lib/feature-flags'

type PublicBeat = {
  id: string
  title: string
  producer: string
  producer_username?: string
  description?: string
  genre?: string
  mood?: string
  artworkUrl?: string
  previewUrl?: string
  startingPrice?: number
  bpm?: number
  musical_key?: string
  published_at?: string
  created_at?: string
}
type PublicRelease = { id: string; title: string; artist?: string; cover?: string; publishedAt?: string }
type PublicPlaylist = { id: string; title: string; description?: string | null; creator: string; creatorUsername?: string | null; coverUrl?: string | null; trackCount: number; updatedAt?: string | null }
type MarketplaceListing = { id: string; listing_type: string; title: string; slug: string; category?: string; description?: string; artwork_path?: string; price_usd?: number; profiles?: { username?: string; display_name?: string } }
type CatalogueTrack = {
  id: string
  title: string
  artist: string
  genre?: string
  collection?: string
  duration?: string
  description?: string
  src?: string
  artwork?: string
  bpm?: string
  price?: number | null
  externalUrl?: string
  streamOnly?: boolean
  type: string
  source: string
  publishedAt?: string
  inRotation?: boolean
  featured?: boolean
}
type ExploreMode = 'all' | 'fresh' | 'rotation' | 'playlists' | 'creators' | 'beats' | 'culture'

const filters: Array<{ label: string; value: 'all' | SearchKind }> = [
  { label: 'All', value: 'all' }, { label: 'Tracks', value: 'track' }, { label: 'Releases', value: 'release' }, { label: 'Playlists', value: 'playlist' },
  { label: 'Artists', value: 'artist' }, { label: 'Producers', value: 'producer' }, { label: 'Beats', value: 'beat' },
  { label: 'Shows', value: 'show' }, { label: 'Stories', value: 'story' }, { label: 'Services', value: 'service' },
]
const headings: Record<SearchKind, string> = { track: 'Tracks', release: 'Releases', playlist: 'Playlists', artist: 'Artists', producer: 'Producers', beat: 'Beats', show: 'Shows', story: 'Stories', service: 'Services' }
const exploreModes: Array<{ value: ExploreMode; label: string; kinds: SearchKind[]; description: string }> = [
  { value: 'all', label: 'Discover', kinds: ['track', 'release', 'playlist', 'artist', 'producer', 'beat', 'show', 'story', 'service'], description: 'Music, beats, artists and shows together. Follow what catches your ear.' },
  { value: 'fresh', label: 'Fresh', kinds: ['track', 'release', 'playlist', 'beat', 'story'], description: 'Newest publicly published BVS music, playlists, beats and stories first.' },
  { value: 'rotation', label: 'On BVS', kinds: ['track'], description: 'Tracks currently cleared into the live BVS radio rotation.' },
  { value: 'playlists', label: 'Playlists', kinds: ['playlist'], description: 'Public playlists made by BVS listeners and creators.' },
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
  if (mode === 'fresh' || mode === 'playlists') {
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
  const [artists, setArtists] = useState<PublishedArtistSummary[]>([])
  const [producers, setProducers] = useState<PublishedProducerSummary[]>([])
  const [beats, setBeats] = useState<PublicBeat[]>([])
  const [releases, setReleases] = useState<PublicRelease[]>([])
  const [publicPlaylists, setPublicPlaylists] = useState<PublicPlaylist[]>([])
  const [services, setServices] = useState<MarketplaceListing[]>([])
  const [catalogueTracks, setCatalogueTracks] = useState<CatalogueTrack[]>([])
  const [selectedDetail, setSelectedDetail] = useState<ExploreDetail | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const [loadAttempt, setLoadAttempt] = useState(0)
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

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    const sources: Array<{ url: string; apply: (data: Record<string, unknown>) => void }> = [
      { url:'/api/artists', apply:data => setArtists((data.artists || []) as PublishedArtistSummary[]) },
      { url:'/api/producers', apply:data => setProducers((data.producers || []) as PublishedProducerSummary[]) },
      { url:'/api/beats', apply:data => setBeats((data.beats || []) as PublicBeat[]) },
      { url:'/api/releases/public', apply:data => setReleases((data.releases || []) as PublicRelease[]) },
      { url:'/api/playlists/public', apply:data => setPublicPlaylists(((data.playlists || []) as PublicPlaylist[]).filter(item => item.trackCount > 0)) },
      { url:'/api/marketplace', apply:data => setServices(((data.listings || []) as MarketplaceListing[]).filter(item => item.listing_type === 'service')) },
      { url:'/api/catalogue/listings', apply:data => setCatalogueTracks(((data.listings || []) as CatalogueTrack[]).filter(item => item.source === 'track' && item.type !== 'beat')) },
    ]
    void Promise.allSettled(sources.map(async source => {
      const response = await fetch(source.url, { signal: controller.signal })
      if (!response.ok) throw new Error('Discovery source unavailable')
      const data = await response.json()
      if (active) source.apply(data)
    })).then(outcomes => {
      if (!active) return
      setUnavailable(outcomes.some(outcome => outcome.status === 'rejected'))
      setLoaded(true)
    })
    return () => { active = false; controller.abort() }
  }, [loadAttempt])

  const items = useMemo<SearchItem[]>(() => {
    const producerIds = new Set(producers.map(item => item.id))
    const local = discoveryItems.map<SearchItem>(item => {
      const isRelease = item.id.startsWith('album-') || item.tags?.includes('album')
      const isBeat = item.tags?.includes('beat') && !isRelease
      return { ...item, kind: isRelease ? 'release' : isBeat ? 'beat' : item.kind }
    })
    return [
      ...local.filter(item => item.kind !== 'artist' && (item.kind !== 'track' || catalogueTracks.length === 0)),
      ...catalogueTracks.map(item => {
        const artwork = imageUrl(item.artwork)
        const href = `/catalogue?q=${encodeURIComponent(item.title)}`
        return {
          id: `track-${item.id}`,
          kind: 'track' as const,
          title: item.title,
          subtitle: `${item.artist} · ${item.collection || 'Published on BVS'}`,
          href,
          image: artwork,
          tags: [item.genre || '', item.artist],
          publishedAt: item.publishedAt,
          onBvs: item.inRotation === true,
          detail: {
            id: item.id,
            kind: 'track' as const,
            title: item.title,
            artist: item.artist,
            image: artwork,
            genre: item.genre,
            collection: item.collection,
            duration: item.duration,
            description: item.description,
            bpm: item.bpm,
            price: item.price,
            streamOnly: item.streamOnly,
            src: item.src,
            externalUrl: item.externalUrl,
            href,
            inRotation: item.inRotation === true,
          },
        }
      }),
      ...publicPlaylists.map(item => ({
        id: `playlist-${item.id}`,
        kind: 'playlist' as const,
        title: item.title,
        subtitle: `${item.creator} · ${item.trackCount} track${item.trackCount === 1 ? '' : 's'}`,
        href: `/playlist/${item.id}`,
        image: item.coverUrl || undefined,
        tags: [item.creator, item.description || '', 'public playlist', 'made on bvs'],
        badge: 'Made on BVS',
        publishedAt: item.updatedAt || undefined,
      })),
      ...artists.filter(item => !producerIds.has(item.id)).map(item => ({ id: `artist-${item.id}`, kind: 'artist' as const, title: item.name, subtitle: `${item.role} · ${item.trackCount} published ${item.trackCount === 1 ? 'track' : 'tracks'}`, href: `/artist/${item.username}`, image: item.image, tags: [item.username, ...item.genres] })),
      ...producers.map(item => ({ id: `producer-${item.id}`, kind: 'producer' as const, title: item.name, subtitle: `Producer · ${item.beatCount} published ${item.beatCount === 1 ? 'beat' : 'beats'}`, href: `/artist/${item.username}`, image: item.image, tags: [item.username, ...item.genres] })),
      ...beats.map(item => {
        const href = `/beat/${encodeURIComponent(item.id)}`
        return {
          id: `beat-${item.id}`,
          kind: 'beat' as const,
          title: item.title,
          subtitle: `${item.producer} · ${item.genre || 'BeatStore'}${item.bpm ? ` · ${item.bpm} BPM` : ''}`,
          href,
          image: item.artworkUrl,
          tags: [item.genre || '', item.mood || ''],
          publishedAt: item.published_at || item.created_at,
          detail: {
            id: item.id,
            kind: 'beat' as const,
            title: item.title,
            artist: item.producer,
            image: item.artworkUrl,
            genre: item.genre,
            collection: 'BVS BeatStore',
            duration: item.bpm ? `${item.bpm} BPM` : 'Tagged preview',
            description: item.description,
            bpm: item.bpm ? String(item.bpm) : undefined,
            mood: item.mood,
            musicalKey: item.musical_key,
            price: item.startingPrice,
            streamOnly: false,
            src: item.previewUrl,
            href,
            producerUsername: item.producer_username,
          },
        }
      }),
      ...releases.map(item => {
        const href = `/album/${item.id}`
        return {
          id: `release-${item.id}`,
          kind: 'release' as const,
          title: item.title,
          subtitle: `${item.artist || 'BVS creator'} · Release`,
          href,
          image: item.cover,
          publishedAt: item.publishedAt,
          detail: {
            id: item.id,
            kind: 'release' as const,
            title: item.title,
            artist: item.artist || 'BVS creator',
            image: item.cover,
            collection: 'Published release',
            href,
            publishedAt: item.publishedAt,
          },
        }
      }),
      ...services.map(item => ({ id: `service-${item.id}`, kind: 'service' as const, title: item.title, subtitle: `${item.category?.replaceAll('_', ' ') || 'Creator service'}${item.price_usd ? ` · $${item.price_usd}` : ''}`, href: `/marketplace?listing=${encodeURIComponent(item.slug)}`, image: imageUrl(item.artwork_path), tags: [item.category || '', item.description || ''] })),
      ...officialBvsServices.map(item => ({ id: `official-service-${item.id}`, kind: 'service' as const, title: item.title, subtitle: `${item.category} · ${item.price}`, href: `/shop#services`, image: '/images/hero-studio.jpg', tags: [item.category, item.desc, item.engineer, 'official bvs'], badge: 'Official BVS' })),
      ...blogPosts.map(item => ({ id: `story-${item.slug}`, kind: 'story' as const, title: item.title, subtitle: `${item.readTime} · BVS story`, href: `/blog/${item.slug}`, tags: [item.description], publishedAt: item.date })),
    ]
  }, [artists, beats, catalogueTracks, producers, publicPlaylists, releases, services])

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const modeKinds = exploreModes.find(item => item.value === mode)?.kinds || []
    const matched = items.filter(item => {
      const matchesFilter = filter === 'all' || item.kind === filter
      const matchesQuery = matchesDiscoveryQuery(query, [item.title, item.subtitle, ...(item.tags || [])])
      const matchesMode = !flowV2Flags.exploreModes || needle || filter !== 'all' || modeKinds.includes(item.kind)
      return matchesFilter && matchesQuery && matchesMode && matchesSound(item, genre)
    })
    if (!flowV2Flags.exploreModes || needle || filter !== 'all') return matched
    return orderForExploreMode(matched, mode)
  }, [filter, items, mode, query, genre])

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
      if (flowV2Flags.exploreModes && !query.trim() && filter === 'all') params.set('mode', mode)
      window.history.replaceState(window.history.state, '', `/search${params.size ? `?${params}` : ''}`)
    }, 180)
    return () => window.clearTimeout(timer)
  }, [filter, mode, query, genre])

  useEffect(() => {
    const term = query.trim()
    if (term.length < 2 || results.length) return
    const timer = window.setTimeout(() => trackEvent('search_no_results', { query: /@|\+?\d[\d\s()-]{6,}/.test(term) ? '[redacted]' : term.toLowerCase().slice(0, 80), query_length: term.length, filter }), 800)
    return () => window.clearTimeout(timer)
  }, [filter, query, results.length])

  const openResult = (item: SearchItem) => {
    trackEvent('search_result_open', { object_kind: item.kind, object_id: item.id })
    if (!item.detail) return
    trackEvent('flow_object_open', { object_kind: item.kind, object_id: item.id, source: 'explore_details' })
    setSelectedDetail(item.detail)
  }

  const sounds = useMemo(() => discoverySounds(items), [items])
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
    <p className="mb-3 text-xs uppercase tracking-[0.25em] text-brand">Discover BVS</p>
    <h1 className="bvs-directory-title">{mode === 'playlists' ? 'Playlists' : mode === 'fresh' ? 'Releases' : mode === 'beats' ? 'Beats & tools' : activeMode.label}</h1>
    <p className="mt-3 max-w-2xl text-text-secondary">{activeMode.description}</p>
    <div className="mt-5 flex flex-wrap gap-3 text-sm"><Link href="/feed" className="text-brand hover:underline">Community Feed →</Link><Link href="/radio" className="text-brand hover:underline">Live radio →</Link></div>
    <label className="mt-5 block max-w-3xl"><span className="sr-only">Search BVS</span><input value={query} onChange={event => { setQuery(event.target.value); setResultLimit(40) }} placeholder="Search for an artist, track, beat or sound" className="w-full rounded-2xl border border-white/15 bg-white/5 px-5 py-4 text-lg outline-none transition placeholder:text-text-secondary focus:border-brand" /></label>
    {flowV2Flags.exploreModes && !query.trim() ? <div className="mt-5 flex gap-2 overflow-x-auto pb-2" aria-label="Explore modes">{exploreModes.map(item => <button key={item.value} type="button" onClick={() => { setMode(item.value); setFilter('all'); trackEvent('explore_mode_change', { mode: item.value }) }} aria-pressed={mode === item.value} className={`min-h-11 shrink-0 rounded-full px-4 py-2 text-sm ${mode === item.value ? 'bg-brand text-black' : 'border border-white/10 bg-white/[.03] text-text-secondary hover:text-white'}`}>{item.label}</button>)}</div> : null}
    {query.trim() || filter !== 'all' ? <div className="mt-5 flex gap-2 overflow-x-auto pb-2" aria-label="Filter results">{filters.map(item => <button key={item.value} onClick={() => { setFilter(item.value); setResultLimit(40) }} aria-pressed={filter === item.value} className={`min-h-11 shrink-0 rounded-full px-4 py-2 text-sm ${filter === item.value ? 'bg-brand text-black' : 'bg-white/5 text-text-secondary hover:text-white'}`}>{item.label}</button>)}</div> : null}

    {sounds.length ? <details className="bvs-discover-filters mt-4"><summary className="min-h-11 cursor-pointer text-sm text-text-secondary">Filter by sound{genre ? ` · ${genre}` : ''}</summary><div className="mt-4 flex flex-wrap items-center gap-2" aria-label="Browse by sound"><span className="mr-1 text-xs text-text-secondary">Browse by sound</span><button type="button" aria-pressed={!genre} onClick={() => setGenre('')} className={`min-h-10 rounded-full border px-3 text-xs ${!genre ? 'border-brand/50 text-brand' : 'border-white/15 text-text-secondary'}`}>All sounds</button>{sounds.map(sound => <button key={sound.key} type="button" aria-pressed={genre === sound.key} onClick={() => { setGenre(sound.key); setRound(0) }} className={`min-h-10 rounded-full border px-3 text-xs ${genre === sound.key ? 'border-brand/50 bg-brand/10 text-brand' : 'border-white/15 text-text-secondary hover:text-white'}`}>{sound.label}</button>)}</div></details> : null}
    {genre && !sounds.some(sound => sound.key === genre) ? <button type="button" onClick={() => setGenre('')} className="mt-3 min-h-10 text-sm text-brand">Clear sound filter: {genre}</button> : null}
    {unavailable ? <div role="status" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/15 p-3 text-sm text-text-secondary"><span>Some discoveries could not be loaded. You can still explore what is here.</span><button type="button" onClick={() => { setLoaded(false); setUnavailable(false); setLoadAttempt(value => value + 1) }} className="min-h-10 rounded-full border border-white/20 px-4 text-white">Retry loading</button></div> : null}
    {discoveryHome && shelves.length ? <DiscoverShelves shelves={shelves} round={round} onMore={() => { setRound(value => value + 1); trackEvent('explore_rail_open', { genre: genre || 'all' }) }} onBrowse={browseShelf} onDetails={openResult} /> : null}
    {!discoveryHome && (!query.trim() && filter === 'all' ? <section className="mt-10" aria-label="Explore published BVS content"><h2 className="text-3xl font-semibold">{flowV2Flags.exploreModes ? activeMode.label : 'Discover now'}</h2><p className="mt-2 text-text-secondary">{flowV2Flags.exploreModes ? activeMode.description : 'Published and editorially visible BVS content.'}</p></section> : <h2 className="mt-10 text-3xl font-semibold">{query.trim() ? `Results for “${query.trim()}”` : headings[filter as SearchKind]}</h2>)}
    <div className="mt-7 space-y-12">
      {!discoveryHome && grouped.map(group => <section key={group.kind} aria-labelledby={`search-${group.kind}`}>
        <div className="mb-4 flex items-end justify-between">
          <h2 id={`search-${group.kind}`} className="text-2xl font-semibold">{headings[group.kind]}</h2>
          {filter === 'all' && results.filter(item => item.kind === group.kind).length > 8 ? <button onClick={() => { setFilter(group.kind); setResultLimit(40) }} className="min-h-11 text-sm text-brand">View all →</button> : null}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {group.items.map(item => <article key={item.id} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[.03] p-3 transition hover:border-brand/35">
            {toDiscoveryTrack(item) ? <button type="button" onClick={() => playResult(item)} aria-label={`${player.current?.id === toDiscoveryTrack(item)?.id && player.isPlaying ? 'Pause' : item.kind === 'beat' ? 'Preview' : 'Play'} ${item.title}`} className="relative shrink-0">            <span className="relative block h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white/5">{item.image ? <Image src={item.image} alt="" fill unoptimized={/^https?:\/\//.test(item.image)} className="object-cover" /> : <span className="absolute inset-0 grid place-items-center text-xs font-bold text-brand">BVS</span>}</span>
<span aria-hidden="true" className="absolute inset-0 grid place-items-center bg-black/25 text-white">{player.current?.id === toDiscoveryTrack(item)?.id && player.isPlaying ? 'Ⅱ' : '▶'}</span></button> : item.detail ? <button type="button" onClick={() => openResult(item)} aria-label={`Details for ${item.title}`} className="shrink-0">            <span className="relative block h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white/5">{item.image ? <Image src={item.image} alt="" fill unoptimized={/^https?:\/\//.test(item.image)} className="object-cover" /> : <span className="absolute inset-0 grid place-items-center text-xs font-bold text-brand">BVS</span>}</span>
</button> : <Link href={item.href} aria-label={`Open ${item.title}`} className="shrink-0">            <span className="relative block h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white/5">{item.image ? <Image src={item.image} alt="" fill unoptimized={/^https?:\/\//.test(item.image)} className="object-cover" /> : <span className="absolute inset-0 grid place-items-center text-xs font-bold text-brand">BVS</span>}</span>
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
            {['track','artist','producer','beat'].includes(item.kind) ? <DiscoverMoreActions title={item.title}>
              <LibraryAction item={{ ...item, kind: item.kind === 'beat' ? 'beat' : item.kind === 'track' ? 'track' : 'artist' }} section={item.kind === 'artist' || item.kind === 'producer' ? 'follows' : 'favourites'} compact />
              {item.detail ? <button type="button" onClick={() => openResult(item)} className="min-h-11 text-left text-sm text-brand">View details</button> : <Link {...flowDetailProps(item)} href={item.href} className="inline-flex min-h-11 items-center text-sm text-brand">View details →</Link>}
            </DiscoverMoreActions> : null}
          </article>)}
        </div>
        {filter !== 'all' && results.filter(item => item.kind === group.kind).length > group.items.length ? <button type="button" onClick={() => setResultLimit(value => value + 40)} className="mt-4 min-h-11 rounded-full border border-white/20 px-5 text-sm text-brand">Show more {headings[group.kind].toLowerCase()} →</button> : null}
      </section>)}
      {loaded && results.length === 0 ? <div className="rounded-2xl border border-dashed border-white/15 px-6 py-14 text-center"><h3 className="text-xl">Nothing published under that view yet</h3><p className="mt-2 text-text-secondary">Try another term, mode or category. Explore another sound or clear your filters to find a new direction.</p><button onClick={() => { setQuery(''); setFilter('all'); setResultLimit(40); setGenre(''); setMode('all') }} className="mt-5 min-h-11 rounded-full bg-brand px-5 py-2 text-sm font-semibold text-black">Start discovering</button></div> : null}
      {!loaded ? <div className="grid gap-3 md:grid-cols-2" aria-label="Loading discovery"><div className="h-24 animate-pulse rounded-2xl bg-white/5"/><div className="h-24 animate-pulse rounded-2xl bg-white/5"/></div> : null}
    </div>
    {selectedDetail ? <ExploreItemDetails detail={selectedDetail} onClose={closeDetails} /> : null}
  </main>
}
