import 'server-only'

import { getPublicProgrammes } from '@/lib/station-content'
import { curatedCatalogueTracks } from '@/lib/catalogue-curated-tracks'
import { listCatalogueMusicListings } from '@/lib/catalogue-listings'
import { getPublishedArtists, getPublishedProducers } from '@/lib/artist-content'
import { getPublicReleases } from '@/lib/public-releases'
import { mediaUrlForStoredValue } from '@/lib/media-url'
import { producerPublicName } from '@/lib/public-name'

export type AskBvsObjectKind = 'track' | 'release' | 'creator' | 'beat' | 'story' | 'show' | 'product' | 'service'

export type AskBvsObject = {
  id: string
  kind: AskBvsObjectKind
  title: string
  subtitle?: string
  route: string
  artwork?: string
  matchReason?: string
  collection?: string
}

export type AskBvsClientItem = {
  id?: string
  kind?: string
  title?: string
  subtitle?: string
  href?: string
}

export type AskBvsClientContext = {
  history?: AskBvsClientItem[]
  recent?: AskBvsClientItem[]
  follows?: AskBvsClientItem[]
  previousResults?: Array<{ id: string; kind: string }>
  shownIds?: string[]
}

export type AskBvsAnswer = {
  reply: string
  objects: AskBvsObject[]
  links: Array<{ label: string; href: string }>
  mode: 'flow' | 'guide'
  reason?: string
}

type Candidate = AskBvsObject & {
  genre?: string
  mood?: string
  bpm?: number
  searchText: string
  artist?: string
  source?: 'live-track' | 'curated' | 'release' | 'beat' | 'creator'
  releaseId?: string | null
  publishedAt?: string
  creatorId?: string
  releaseTracks?: string[]
}

type PulseRow = {
  subject_kind: AskBvsObjectKind
  subject_id: string
  creator_id?: string | null
  title: string
  subtitle?: string | null
  route: string
  artwork?: string | null
}

type BeatRow = {
  id: string
  title: string
  description?: string | null
  genre?: string | null
  mood?: string | null
  bpm?: number | null
  musical_key?: string | null
  producer_user_id: string
  artwork_path?: string | null
  preview_path?: string | null
  published_at?: string | null
  created_at?: string | null
}

type ProducerProfile = {
  id: string
  username?: string | null
  creator_public_name?: string | null
  creator_name_status?: string | null
  producer_public_name?: string | null
  producer_name_status?: string | null
}

function normalize(value?: string | null) {
  return (value || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim()
}

function unique<T extends AskBvsObject>(items: T[]): T[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = `${item.kind}:${item.id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function fromClient(item: AskBvsClientItem): AskBvsObject | null {
  const title = String(item.title || '').trim()
  const kind = String(item.kind || '') as AskBvsObjectKind
  if (!title || !['track', 'release', 'creator', 'beat', 'story', 'show', 'product', 'service'].includes(kind)) return null
  const href = String(item.href || '')
  return {
    id: String(item.id || title),
    kind,
    title,
    subtitle: item.subtitle ? String(item.subtitle) : undefined,
    route: href.startsWith('/') && !href.startsWith('//') && !/[\\\x00-\x20]/.test(href) ? href : kind === 'track' ? `/catalogue?q=${encodeURIComponent(title)}` : '/search',
  }
}

function score(query: string, item: Candidate) {
  const q = normalize(query)
  const title = normalize(item.title)
  if (!q || !title) return 0
  if (q === title) return 1200 + title.length
  if (q.includes(title)) return 1000 + title.length
  if (title.includes(q) && q.length >= 3) return 800 + q.length
  // Username / slug style partials (e.g. basjun → basjunior)
  const slug = normalize(item.route.split('/').pop() || '')
  if (slug && (slug === q || (q.length >= 3 && slug.includes(q)) || (slug.length >= 3 && q.includes(slug)))) {
    return 780 + Math.min(q.length, slug.length)
  }
  const qTokens = new Set(q.split(' ').filter((token) => token.length >= 3 && !['find', 'show', 'music', 'track', 'tracks', 'beat', 'beats', 'song', 'songs', 'please', 'recommend', 'something', 'want', 'looking', 'with', 'some', 'from', 'bvs', 'the', 'for'].includes(token)))
  const titleTokens = title.split(' ').filter((token) => token.length >= 3)
  const titleHits = titleTokens.filter((token) => qTokens.has(token)).length
  if (titleHits && titleHits === titleTokens.length) return 650 + titleHits * 20
  const haystack = normalize(`${item.title} ${item.subtitle || ''} ${item.searchText}`)
  const hits = [...qTokens].filter((token) => haystack.includes(token)).length
  return hits >= 2 ? 250 + hits * 20 : hits === 1 && q.length >= 5 ? 200 + hits * 10 : 0
}

type CatalogueSnapshot = {
  at: number
  catalogue: Awaited<ReturnType<typeof listCatalogueMusicListings>>
  releases: Awaited<ReturnType<typeof getPublicReleases>>
  artists: Awaited<ReturnType<typeof getPublishedArtists>>
  producers: Awaited<ReturnType<typeof getPublishedProducers>>
  beats: Candidate[]
  shows: Awaited<ReturnType<typeof getPublicProgrammes>>
}

// Catalogue can lag a bit; Pulse/show live state must stay fresher.
const CATALOGUE_TTL_MS = 90_000
const PULSE_TTL_MS = 8_000
let catalogueSnapshot: CatalogueSnapshot | null = null
let catalogueInflight: Promise<CatalogueSnapshot> | null = null
let pulseSnapshot: { at: number; pulse: PulseRow[] } | null = null
let pulseInflight: Promise<PulseRow[]> | null = null

async function loadCatalogueSnapshot(): Promise<CatalogueSnapshot> {
  const now = Date.now()
  if (catalogueSnapshot && now - catalogueSnapshot.at < CATALOGUE_TTL_MS) return catalogueSnapshot
  if (catalogueInflight) return catalogueInflight
  catalogueInflight = Promise.all([
    listCatalogueMusicListings(250).catch(() => ({ listings: [], summary: { trackCount: 0, releasePackageCount: 0, updatedAt: '' } })),
    getPublicReleases().catch(() => [] as Awaited<ReturnType<typeof getPublicReleases>>),
    getPublishedArtists().catch(() => [] as Awaited<ReturnType<typeof getPublishedArtists>>),
    getPublishedProducers().catch(() => [] as Awaited<ReturnType<typeof getPublishedProducers>>),
    loadBeats().catch(() => [] as Candidate[]),
    getPublicProgrammes().catch(() => [] as Awaited<ReturnType<typeof getPublicProgrammes>>),
  ]).then(([catalogue, releases, artists, producers, beats, shows]) => {
    catalogueSnapshot = { at: Date.now(), catalogue, releases, artists, producers, beats, shows }
    catalogueInflight = null
    return catalogueSnapshot
  }).catch((error) => {
    catalogueInflight = null
    throw error
  })
  return catalogueInflight
}

async function loadPulseSnapshot(): Promise<PulseRow[]> {
  const now = Date.now()
  if (pulseSnapshot && now - pulseSnapshot.at < PULSE_TTL_MS) return pulseSnapshot.pulse
  if (pulseInflight) return pulseInflight
  pulseInflight = loadPulse()
    .catch(() => [] as PulseRow[])
    .then((pulse) => {
      pulseSnapshot = { at: Date.now(), pulse }
      pulseInflight = null
      return pulse
    })
  return pulseInflight
}

async function loadGraphSnapshot() {
  const [cataloguePart, pulse] = await Promise.all([loadCatalogueSnapshot(), loadPulseSnapshot()])
  return { ...cataloguePart, pulse }
}

function isCuratedRelease(row: (typeof curatedCatalogueTracks)[number]) {
  const text = normalize(`${row.genre} ${row.collection} ${row.duration} ${row.description}`)
  return Boolean(row.albumPackage || row.duration === 'Project' || /\balbum\b|streaming release|spotify release|full album/.test(text))
}

function supabaseConfig() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '')
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return url && key ? { url, headers: { apikey: key, Authorization: `Bearer ${key}` } } : null
}

async function loadBeats(): Promise<Candidate[]> {
  const setup = supabaseConfig()
  if (!setup) return []
  const response = await fetch(`${setup.url}/rest/v1/beats?is_public=eq.true&status=eq.published&select=id,title,description,genre,mood,bpm,musical_key,producer_user_id,artwork_path,preview_path,published_at,created_at&order=published_at.desc.nullslast,created_at.desc&limit=120`, { headers: setup.headers, cache: 'no-store', signal: AbortSignal.timeout(4000) }).catch(() => null)
  if (!response?.ok) return []
  const beats = await response.json() as BeatRow[]
  const ids = [...new Set(beats.map((beat) => beat.producer_user_id).filter(Boolean))]
  let profilesResponse = ids.length
    ? await fetch(`${setup.url}/rest/v1/profiles?id=in.(${ids.join(',')})&select=id,username,creator_public_name,creator_name_status,producer_public_name,producer_name_status`, { headers: setup.headers, cache: 'no-store', signal: AbortSignal.timeout(4000) }).catch(() => null)
    : null
  // Older databases may not yet expose the optional producer-name columns.
  if (ids.length && !profilesResponse?.ok) {
    profilesResponse = await fetch(`${setup.url}/rest/v1/profiles?id=in.(${ids.join(',')})&select=id,username,creator_public_name,creator_name_status`, { headers: setup.headers, cache: 'no-store', signal: AbortSignal.timeout(4000) }).catch(() => null)
  }
  const profiles = profilesResponse?.ok ? await profilesResponse.json() as ProducerProfile[] : []
  return beats.map((beat) => {
    const profile = profiles.find((row) => row.id === beat.producer_user_id)
    const producer = producerPublicName({
      producerPublicName: profile?.producer_public_name || undefined,
      producerNameStatus: profile?.producer_name_status || undefined,
      publicName: profile?.creator_public_name || undefined,
      publicNameStatus: profile?.creator_name_status || undefined,
      username: profile?.username || undefined,
    }) || 'BVS producer'
    return {
      id: beat.id,
      kind: 'beat',
      title: beat.title,
      subtitle: `${producer}${beat.genre ? ` · ${beat.genre}` : ''}${beat.bpm ? ` · ${beat.bpm} BPM` : ''}`,
      route: `/catalogue?type=beat${profile?.username ? `&producer=${encodeURIComponent(profile.username)}` : ''}&q=${encodeURIComponent(beat.title)}#browse`,
      artwork: mediaUrlForStoredValue(beat.artwork_path) || undefined,
      collection: 'BVS BeatStore',
      searchText: [beat.title, producer, beat.description, beat.genre, beat.mood, beat.bpm, beat.musical_key].join(' '),
      artist: producer,
      genre: beat.genre || undefined,
      mood: beat.mood || undefined,
      bpm: beat.bpm || undefined,
      source: 'beat',
      creatorId: beat.producer_user_id,
      publishedAt: beat.published_at || beat.created_at || undefined,
    }
  })
}

async function loadPulse(): Promise<PulseRow[]> {
  if (process.env.NEXT_PUBLIC_BVS_PULSE !== '1') return []
  const setup = supabaseConfig()
  if (!setup) return []
  const response = await fetch(`${setup.url}/rest/v1/bvs_activity_events?visibility=eq.public&visible_at=lte.${encodeURIComponent(new Date().toISOString())}&select=subject_kind,subject_id,creator_id,title,subtitle,route,artwork&order=visible_at.desc&limit=20`, { headers: setup.headers, cache: 'no-store', signal: AbortSignal.timeout(4000) }).catch(() => null)
  return response?.ok ? await response.json() as PulseRow[] : []
}

async function producerCredits(trackId: string) {
  const setup = supabaseConfig()
  if (!setup || !/^[0-9a-f-]{20,}$/i.test(trackId)) return []
  const response = await fetch(`${setup.url}/rest/v1/track_credits?track_id=eq.${encodeURIComponent(trackId)}&is_verified=eq.true&select=person_name,credit_role`, { headers: setup.headers, cache: 'no-store', signal: AbortSignal.timeout(4000) }).catch(() => null)
  if (!response?.ok) return []
  const rows = await response.json() as Array<{ person_name?: string; credit_role?: string }>
  return rows.filter((row) => /produc/i.test(String(row.credit_role || ''))).map((row) => String(row.person_name || '').trim()).filter(Boolean)
}

function guide(message: string): AskBvsAnswer {
  const q = normalize(message)
  if (/submit|upload|send my music/.test(q)) return { reply: 'Artists can submit music to BVS for editorial review. Publishing and rotation decisions stay editorial.', objects: [], links: [{ label: 'Submit music', href: '/upload' }], mode: 'guide' }
  if (/mix|master|studio|audio service|production service/.test(q)) return { reply: 'BVS Studio offers release-ready audio services. Open Studio to see the services currently published.', objects: [], links: [{ label: 'BVS Studio', href: '/shop' }, { label: 'Creator Marketplace', href: '/marketplace' }], mode: 'guide' }
  if (/listen|radio|live station|play bvs/.test(q)) return { reply: 'Open BVS Radio for the live rotation, or ask me for a specific published track, release, creator or beat.', objects: [], links: [{ label: 'Listen live', href: '/radio' }, { label: 'Explore BVS', href: '/search' }], mode: 'guide' }
  if (/account|login|sign in|sign up|password/.test(q)) return { reply: 'Use your BVS account to sync your library and creator access.', objects: [], links: [{ label: 'Sign in', href: '/auth/login' }, { label: 'Create account', href: '/auth/signup' }], mode: 'guide' }
  return { reply: 'I couldn’t match that to something currently published on BVS. Try a track, release, creator, beat, or ask what’s new on BVS.', objects: [], links: [{ label: 'Explore BVS', href: '/search' }, { label: 'Contact BVS', href: '/contact' }], mode: 'guide' }
}

export async function answerAskBvs(message: string, context: AskBvsClientContext = {}): Promise<AskBvsAnswer> {
  const q = normalize(message)

  if (/what.*(been listening|listened|played)|my listening|listening history|what did i play/.test(q)) {
    const history = unique((context.history || []).map(fromClient).filter((item): item is AskBvsObject => item !== null)).slice(0, 5)
    return history.length
      ? { reply: `Your recent BVS listening starts with ${history.slice(0, 3).map((item) => item.title).join(', ')}.`, objects: history, links: [{ label: 'Your BVS', href: '/library' }], mode: 'flow', reason: 'device_history' }
      : { reply: 'I don’t have listening history on this device yet. Play something on BVS and it will appear in Your BVS.', objects: [], links: [{ label: 'Listen live', href: '/radio' }, { label: 'Your BVS', href: '/library' }], mode: 'flow', reason: 'device_history' }
  }

  if (/where.*(left off|was i|did i go)|my trail|recently explored|what did i explore/.test(q)) {
    const recent = unique((context.recent || []).map(fromClient).filter((item): item is AskBvsObject => item !== null)).slice(0, 5)
    return recent.length
      ? { reply: `Your recent BVS trail includes ${recent.slice(0, 3).map((item) => item.title).join(', ')}.`, objects: recent, links: [{ label: 'Your BVS', href: '/library' }], mode: 'flow', reason: 'scene_trail' }
      : { reply: 'Your BVS trail is empty on this device so far. Explore a few connected objects and I’ll be able to point you back.', objects: [], links: [{ label: 'Explore BVS', href: '/search' }], mode: 'flow', reason: 'scene_trail' }
  }

  const { catalogue, releases, artists, producers, beats, shows, pulse } = await loadGraphSnapshot()

  const creators: Candidate[] = [
    ...artists.map((artist) => ({ id: artist.id, kind: 'creator' as const, title: artist.name, subtitle: artist.role, route: `/artist/${encodeURIComponent(artist.username)}`, artwork: artist.image, searchText: [artist.name, artist.username, artist.role, artist.bio, ...artist.genres].join(' '), source: 'creator' as const, creatorId: artist.id })),
    ...producers.map((producer) => ({ id: producer.id, kind: 'creator' as const, title: producer.name, subtitle: `Producer · ${producer.beatCount} published ${producer.beatCount === 1 ? 'beat' : 'beats'}`, route: `/artist/${encodeURIComponent(producer.username)}?as=producer`, artwork: producer.image, searchText: [producer.name, producer.username, 'producer', ...producer.genres].join(' '), source: 'creator' as const, creatorId: producer.id })),
  ]

  const live: Candidate[] = catalogue.listings.map((row) => ({
    id: row.id,
    kind: row.source === 'release-package' ? 'release' : 'track',
    title: row.title,
    subtitle: `${row.artist} · ${row.collection}`,
    route: row.source === 'release-package' && row.releaseId ? `/album/${encodeURIComponent(row.releaseId)}` : `/catalogue?q=${encodeURIComponent(row.title)}`,
    artwork: row.artwork,
    collection: row.collection,
    searchText: [row.title, row.artist, row.genre, row.collection, row.description].join(' '),
    artist: row.artist,
    genre: row.genre,
    source: row.source === 'track' ? 'live-track' : 'release',
    releaseId: row.releaseId,
  }))

  const curated: Candidate[] = curatedCatalogueTracks.map((row) => {
    const kind: AskBvsObjectKind = isCuratedRelease(row) ? 'release' : row.type === 'beat' ? 'beat' : 'track'
    return {
      id: String(row.id),
      kind,
      title: row.title,
      subtitle: `${row.artist} · ${row.collection}`,
      route: `/catalogue${kind === 'beat' ? '?type=beat&' : '?'}q=${encodeURIComponent(row.title)}${kind === 'beat' ? '#browse' : ''}`,
      artwork: row.artwork,
      collection: row.collection,
        searchText: [row.title, row.artist, row.genre, row.collection, row.description, row.bpm].join(' '),
      artist: row.artist,
      source: 'curated',
    }
  })

  const releaseCandidates: Candidate[] = releases.map((row) => ({
    id: row.id,
    kind: 'release',
    title: row.title,
    subtitle: `${row.artist} · ${row.releaseType}`,
    route: `/album/${encodeURIComponent(row.id)}`,
    artwork: row.cover,
    collection: 'Published release',
    searchText: [row.title, row.artist, row.genre, row.description, ...row.tracks.map((track) => track.title)].join(' '),
    artist: row.artist,
    genre: row.genre,
    source: 'release',
    publishedAt: row.publishedAt,
    releaseTracks: row.tracks.map((track) => track.title),
  }))

  const showCandidates: Candidate[] = shows.map(show => ({ id: show.slug, kind: 'show', title: show.title, subtitle: show.tagline || show.schedule, route: `/shows/${encodeURIComponent(show.slug)}`, artwork: show.image, searchText: [show.title, show.tagline, show.schedule].filter(Boolean).join(' ') }))
  const candidates = [...live, ...curated, ...releaseCandidates, ...beats, ...creators, ...showCandidates]
  // Follow-up references are only IDs: resolve facts again from the server catalogue.
  const followUp = /\b(more like|similar to|something similar|slower|faster|more of these|show me more|more please)\b/.test(q)
  const anchorRef = context.previousResults?.[0]
  const anchor = anchorRef ? candidates.find(item => item.id === anchorRef.id && item.kind === anchorRef.kind) : undefined
  const discovery = /\b(recommend|suggest|find|looking for|show me)\b/.test(q) && /\b(beats?|instrumentals?|tracks?|songs?|music|artists?|producers?|creators?|shows?)\b/.test(q)
  if (followUp || discovery) {
    const links = [{ label: 'Explore music', href: '/search' }, { label: 'Browse beats', href: '/catalogue?type=beat' }]
    if (followUp && !anchor) return { reply: 'Which track or beat should I use as the starting point? Tell me its title or ask for a few picks first.', objects: [], links, mode: 'flow', reason: 'followup_needs_reference' }
    const slower = /\bslower\b/.test(q), faster = /\bfaster\b/.test(q)
    if ((slower || faster) && !anchor?.bpm) return { reply: `I don’t have a verified BPM for ${anchor?.title || 'that selection'}, so I can’t compare its tempo reliably. Ask for beats at a specific BPM instead.`, objects: [], links, mode: 'flow', reason: 'tempo_unknown' }
    const kind = followUp ? anchor?.kind : /\b(beats?|instrumentals?)\b/.test(q) ? 'beat' : /\b(artists?|producers?|creators?)\b/.test(q) ? 'creator' : /\bshows?\b/.test(q) ? 'show' : 'track'
    const ignored = new Set('recommend suggest find looking for show me please some a an the bvs music track tracks song songs beat beats instrumental instrumentals something want i to listen hear with and by at around of in that are can you give us to me artist artists producer producers creator creators shows show'.split(' '))
    const terms = q.split(' ').filter(word => !ignored.has(word))
    const bpmMatch = q.match(/\b(\d{2,3})\s*bpm\b/)
    const textTerms = terms.filter(word => word !== 'bpm' && !/^\d+$/.test(word))
    const excluded = new Set(context.shownIds || [])
    const picks = unique(candidates.filter(item => {
      if (item.kind !== kind || (!['creator', 'show'].includes(kind || '') && !['live-track', 'beat'].includes(item.source || ''))) return false
      if (followUp) {
        if (item.id === anchor?.id || excluded.has(`${item.kind}:${item.id}`)) return false
        if (slower || faster) return Boolean(item.bpm && (slower ? item.bpm < anchor!.bpm! : item.bpm > anchor!.bpm!))
        return Boolean((anchor?.genre && normalize(item.genre) === normalize(anchor.genre)) || (anchor?.artist && normalize(item.artist) === normalize(anchor.artist)))
      }
      return (!bpmMatch || item.bpm === Number(bpmMatch[1])) && textTerms.every(term => normalize(`${item.title} ${item.artist} ${item.genre} ${item.mood}`).split(' ').includes(term))
    }).sort((a, b) => followUp && anchor?.bpm ? Math.abs((a.bpm || 0) - anchor.bpm) - Math.abs((b.bpm || 0) - anchor.bpm) : 0)).slice(0, 4).map(item => ({
      ...item,
      matchReason: followUp ? slower || faster ? `${item.bpm} BPM — ${slower ? 'slower' : 'faster'} than ${anchor!.title} (${anchor!.bpm} BPM)` : anchor?.genre && normalize(item.genre) === normalize(anchor.genre) ? `Same listed genre: ${item.genre}` : `Same listed creator: ${item.artist}` : [item.genre, item.mood, item.bpm ? `${item.bpm} BPM` : undefined].filter(Boolean).join(' · ') || 'Published catalogue selection',
    }))
    return { reply: picks.length ? `${picks.length === 1 ? 'Try' : 'Start with'} ${picks[0].title}${picks[0].subtitle ? ` by ${picks[0].artist || picks[0].subtitle}` : ''}. ${followUp ? 'These suggestions use listed creator, genre or BPM data—not an audio similarity analysis.' : 'These published selections match the details you asked for; they are not a popularity ranking.'}` : followUp ? 'I couldn’t find another published match with the verified details available. Try a different genre or creator.' : 'I couldn’t find a published match for all those details. Try a genre, producer name or an exact BPM, such as “find beats at 120 BPM”.', objects: picks, links: picks.length ? [] : links, mode: 'flow', reason: 'discovery_picks' }
  }
  const ranked = candidates.map((candidate) => ({ candidate, score: score(message, candidate) })).filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score)
  const best = ranked[0]?.candidate
  const bestCreator = ranked.find((entry) => entry.candidate.kind === 'creator')?.candidate

  if (/what.*(happening|new|latest)|what s on bvs|whats on bvs|fresh on bvs|new on bvs/.test(q)) {
    const creator = bestCreator && score(message, bestCreator) >= 650 ? bestCreator : undefined
    if (/\bfrom\b/.test(q) && !creator) return { reply: 'I couldn’t match that creator to published BVS activity.', objects: [], links: [{ label: 'Explore creators', href: '/search?mode=creators' }], mode: 'flow', reason: 'creator_activity_empty' }
    const pulseObjects = unique((creator?.creatorId ? pulse.filter((row) => row.creator_id === creator.creatorId) : pulse).map((row) => ({ id: row.subject_id, kind: row.subject_kind, title: row.title, subtitle: row.subtitle || undefined, route: row.route, artwork: mediaUrlForStoredValue(row.artwork) || undefined }))).slice(0, 5)
    const fallback = candidates.filter((item) => item.kind !== 'creator' && item.publishedAt && (!creator || normalize(item.artist) === normalize(creator.title))).sort((a, b) => Date.parse(b.publishedAt || '') - Date.parse(a.publishedAt || '')).slice(0, 5)
    const objects = pulseObjects.length ? pulseObjects : fallback
    if (objects.length) return { reply: creator ? `Here’s what’s newest from ${creator.title} on BVS.` : 'Here’s what’s happening on BVS right now from public BVS activity.', objects, links: creator ? [{ label: `${creator.title} profile`, href: creator.route }] : [{ label: 'Explore Fresh', href: '/search?mode=fresh' }], mode: 'flow', reason: creator ? 'creator_activity' : 'pulse' }
  }

  if (/beat|instrumental/.test(q) && bestCreator && score(message, bestCreator) >= 250) {
    const creatorBeats = unique(candidates.filter((item) => item.kind === 'beat' && normalize(item.artist).includes(normalize(bestCreator.title))).slice(0, 6))
    if (creatorBeats.length) return { reply: `${bestCreator.title} has ${creatorBeats.length === 1 ? 'this published beat' : 'these published beats'} available on BVS.`, objects: creatorBeats, links: [{ label: `${bestCreator.title} profile`, href: bestCreator.route }, { label: 'Browse BeatStore', href: '/catalogue?type=beat#browse' }], mode: 'flow', reason: 'creator_beats' }
  }

  if (best && /who (made|produced)|who s the producer|who is the producer|producer of|produced by/.test(q)) {
    if (best.kind === 'beat') {
      const creator = creators.find((item) => normalize(item.title) === normalize(best.artist))
      return { reply: `${best.title} is published on BVS as a beat by ${best.artist || 'its listed producer'}.`, objects: unique([best, ...(creator ? [creator] : [])]), links: [], mode: 'flow', reason: 'beat_creator' }
    }
    if (best.kind === 'track') {
      const credited = best.source === 'live-track' ? await producerCredits(best.id) : []
      return credited.length
        ? { reply: `BVS has a verified producer credit for ${best.title}: ${credited.join(', ')}.`, objects: [best], links: [], mode: 'flow', reason: 'verified_credit' }
        : { reply: `BVS lists ${best.artist || 'the published artist'} on ${best.title}, but I don’t have a verified producer credit to claim beyond that.`, objects: [best], links: [], mode: 'flow', reason: 'credit_not_verified' }
    }
  }

  if (best?.kind === 'track' && /what (release|album)|which (release|album)|what project|which project|release is .* on|album is .* on/.test(q)) {
    const release = candidates.find((item) => item.kind === 'release' && ((best.releaseId && item.id === best.releaseId) || item.releaseTracks?.some((title) => normalize(title) === normalize(best.title)) || normalize(item.title) === normalize(best.collection)))
    return release
      ? { reply: `${best.title} is connected to ${release.title} on BVS.`, objects: [best, release], links: [], mode: 'flow', reason: 'release_relationship' }
      : { reply: `I found ${best.title}, but BVS does not currently expose a verified release relationship for it.`, objects: [best], links: [], mode: 'flow', reason: 'release_not_verified' }
  }

  if (best && ranked[0].score >= 250) {
    const relatedCreators = ranked
      .filter((entry) => entry.candidate.kind === 'creator' && (entry.candidate.id !== best.id || best.kind !== 'creator'))
      .slice(0, 2)
      .map((entry) => entry.candidate)
    const relatedAny = ranked
      .filter((entry) => entry.candidate.id !== best.id || entry.candidate.kind !== best.kind)
      .slice(0, 3)
      .map((entry) => entry.candidate)
    const related = best.kind === 'creator' ? relatedCreators : relatedAny
    const objects = unique([best, ...related]).slice(0, 4)
    const links =
      best.kind === 'creator'
        ? [
            { label: `Open ${best.title} profile`, href: best.route },
            ...(relatedCreators[0]
              ? [{ label: `Also matched: ${relatedCreators[0].title}`, href: relatedCreators[0].route }]
              : [{ label: 'Explore creators', href: '/search?mode=creators' }]),
          ]
        : best.kind === 'beat'
          ? [
              { label: 'Open in BeatStore', href: best.route },
              ...(best.artist
                ? [{
                    label: `${best.artist} profile`,
                    href: creators.find((item) => normalize(item.title) === normalize(best.artist))?.route || '/music/producers',
                  }]
                : []),
            ].filter((link) => Boolean(link.href))
          : best.route
            ? [
                { label: best.kind === 'release' ? 'Open release' : 'Open on BVS', href: best.route },
                ...(relatedAny[0] ? [{ label: 'Related on BVS', href: relatedAny[0].route }] : []),
              ]
            : []
    const reply =
      best.kind === 'creator'
        ? `I found ${best.title}${best.subtitle ? ` — ${best.subtitle}` : ''}. Open the profile card below${relatedCreators[0] ? `, or explore another matching creator` : ''}.`
        : `I found ${best.title}${best.subtitle ? ` — ${best.subtitle}` : ''}.`
    return { reply, objects, links, mode: 'flow', reason: 'entity_match' }
  }

  return guide(message)
}
