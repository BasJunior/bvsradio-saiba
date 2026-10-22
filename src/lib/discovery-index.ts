import 'server-only'
import { discoveryItems } from '@/lib/discovery'
import { curatedCatalogueTracks } from '@/lib/catalogue-curated-tracks'
import { blogPosts } from '@/lib/blog'
import { officialBvsServices } from '@/lib/official-services'
import { PRICE_SINGLE_DOWNLOAD } from '@/lib/catalogue-pricing'
import { creatorPublicName, resolvePublicHandle } from '@/lib/public-name'
import { mediaUrlForStoredValue } from '@/lib/media-url'
import { readDiscoveryPages } from '@/lib/discovery-pagination'
import { discoveryWords } from '@/lib/discovery-search'
import type { SearchItem } from '@/lib/discovery-experience'

export type DiscoverySurface = 'web' | 'ios' | 'android'
type Row = { id: string; [key: string]: unknown }
export type DiscoverySnapshot = { items: SearchItem[]; unavailable: string[] }
const str = (row: Row, key: string) => String(row[key] || '')
const media = (row: Row, key: string) => mediaUrlForStoredValue(str(row, key)) || undefined

/** Keyset pagination has no newest-N cutoff and remains stable as uploads arrive. */
export async function loadDiscoverySnapshot(surface: DiscoverySurface): Promise<DiscoverySnapshot> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return { items: [], unavailable: ['catalogue'] }
  const mobile = surface !== 'web'
  const mobileJoin = mobile ? `,mobile_distribution_clearances!inner(surface,status)&mobile_distribution_clearances.surface=eq.${surface}&mobile_distribution_clearances.status=eq.cleared` : ''
  const queries: Record<string, string> = {
    tracks: `tracks?is_public=eq.true&editorial_status=eq.approved&select=id,title,artist_name,user_id,genre,description,duration_sec,file_url,artwork_url,release_id,in_rotation,is_downloadable,download_price,licence_type,bpm,play_count,created_at,reviewed_at${mobileJoin}`,
    releases: 'releases?is_public=eq.true&editorial_status=eq.approved&select=id,title,artist_name,genre,description,cover_url,release_type,published_at',
    beats: 'beats?is_public=eq.true&status=eq.published&rights_confirmed=eq.true&select=id,title,description,genre,mood,bpm,musical_key,artwork_path,preview_path,producer_user_id,published_at,created_at,beat_licence_options(price_usd,is_active,is_sold_out)',
    videos: 'music_videos?is_public=eq.true&editorial_status=eq.approved&content_hold=eq.false&select=id,related_track_id,video_url,poster_url',
    profiles: 'profiles?is_published=eq.true&select=id,username,role,avatar_url,bio,is_producer,creator_public_name,creator_name_status',
    playlists: 'playlists?is_public=eq.true&select=id,title,description,user_id,cover_url,updated_at',
    // Inner joins enforce public eligibility before membership/credit data enters the index.
    memberships: 'playlist_tracks?select=id,playlist_id,track_id,beat_id,playlists!inner(is_public)&playlists.is_public=eq.true',
    credits: 'track_credits?is_verified=eq.true&select=id,track_id,person_name,credit_role,profile_url,tracks!inner(is_public,editorial_status)&tracks.is_public=eq.true&tracks.editorial_status=eq.approved',
    programmes: 'programmes?status=in.(scheduled,active)&select=id,slug,title,tagline,description,image_url,host',
    shows: 'show_creator_profiles?status=eq.approved&select=id,slug,title,description,artwork_url,category',
    episodes: 'show_episodes?status=eq.published&select=id,show_id,title,description,published_at,show_creator_profiles!inner(status)&show_creator_profiles.status=eq.approved',
    listings: 'creator_marketplace_listings?status=eq.published&select=id,title,slug,listing_type,category,description,artwork_path,seller_user_id,published_at',
  }
  // Native search retains its existing listener categories and clearance boundary.
  const sources = mobile ? ['tracks', 'releases', 'beats', 'profiles', 'credits', 'videos'] : Object.keys(queries)
  const outcomes = await Promise.allSettled(sources.map(async source => {
    const rows = await readDiscoveryPages<Row>(async (after, size) => {
      const response = await fetch(`${url}/rest/v1/${queries[source]}&order=id.asc&limit=${size}${after ? `&id=gt.${encodeURIComponent(after)}` : ''}`, {
        headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' },
        cache: 'no-store', signal: AbortSignal.timeout(15000),
      })
      if (!response.ok) throw new Error(`Search source ${source} unavailable (${response.status})`)
      const data: unknown = await response.json()
      if (!Array.isArray(data)) throw new Error(`Invalid search source ${source}`)
      return data as Row[]
    })
    return [source, rows] as const
  }))
  const data: Record<string, Row[]> = {}
  const unavailable: string[] = []
  outcomes.forEach((outcome, i) => {
    if (outcome.status === 'fulfilled') data[outcome.value[0]] = outcome.value[1]
    else unavailable.push(sources[i])
  })
  const rows = (source: string) => data[source] || []
  const profiles = new Map(rows('profiles').map(row => [row.id, row]))
  const releases = new Map(rows('releases').map(row => [row.id, row]))
  const tracks = new Map(rows('tracks').filter(row => !mobile || (Boolean(row.file_url) && !str(row, 'file_url').includes('scdn.co') && media(row, 'file_url')?.startsWith('/'))).map(row => [row.id, row]))
  const beats = new Map(rows('beats').map(row => [row.id, row]))
  const name = (profile?: Row) => profile ? creatorPublicName({ publicName: str(profile, 'creator_public_name'), username: str(profile, 'username') }) : 'BVS creator'
  const creditsByTrack = new Map<string, Row[]>()
  for (const credit of rows('credits')) {
    if (!tracks.has(str(credit, 'track_id'))) continue
    const id = str(credit, 'track_id')
    creditsByTrack.set(id, [...(creditsByTrack.get(id) || []), credit])
  }
  const items: SearchItem[] = []
  for (const track of tracks.values()) {
    const profile = profiles.get(str(track, 'user_id'))
    const release = releases.get(str(track, 'release_id'))
    const artist = str(track, 'artist_name') || name(profile)
    const collection = release ? str(release, 'title') : 'Published on BVS'
    const href = mobile ? `/app/${surface}/song/${track.id}` : `/song/${track.id}`
    const video = rows('videos').find(row => row.related_track_id === track.id)
    const downloadable = track.is_downloadable === true && track.licence_type !== 'not_for_sale'
    const price = downloadable ? Number(track.download_price) > 0 ? Number(track.download_price) : PRICE_SINGLE_DOWNLOAD : null
    items.push({ id: `track-${track.id}`, kind: 'track', title: str(track, 'title'), subtitle: `${artist} · ${collection}`, href,
      image: media(track, 'artwork_url'), tags: [collection, str(track, 'genre'), str(track, 'description'), str(profile || { id: '' }, 'username'), ...(creditsByTrack.get(track.id) || []).map(c => str(c, 'person_name'))],
      playback: { creatorId: profile?.id, creatorUsername: profile ? str(profile, 'username') : undefined, playCount: Number(track.play_count || 0), isDownloadable: downloadable, downloadPrice: price, licenceType: str(track, 'licence_type'), musicVideoId: video?.id, musicVideoUrl: video ? media(video, 'video_url') : undefined, musicVideoPoster: video ? media(video, 'poster_url') : undefined },
      publishedAt: str(track, 'reviewed_at') || str(track, 'created_at'), onBvs: track.in_rotation === true,
      detail: { id: track.id, kind: 'track', title: str(track, 'title'), artist, href, image: media(track, 'artwork_url'), genre: str(track, 'genre'), collection,
        description: str(track, 'description'), duration: Number(track.duration_sec) > 0 ? `${Math.floor(Number(track.duration_sec) / 60)}:${String(Math.floor(Number(track.duration_sec) % 60)).padStart(2, '0')}` : undefined, src: media(track, 'file_url'), bpm: str(track, 'bpm'), price, streamOnly: !downloadable, inRotation: track.in_rotation === true },
    })
  }
  for (const beat of beats.values()) {
    const profile = profiles.get(str(beat, 'producer_user_id'))
    const prices = (Array.isArray(beat.beat_licence_options) ? beat.beat_licence_options as Array<Record<string, unknown>> : []).filter(option => option.is_active !== false && !option.is_sold_out).map(option => Number(option.price_usd)).filter(price => Number.isFinite(price) && price > 0)
    const price = prices.length ? Math.min(...prices) : undefined
    const producer = name(profile), href = `${mobile ? `/app/${surface}` : ''}/beat/${beat.id}`
    items.push({ id: `beat-${beat.id}`, kind: 'beat', title: str(beat, 'title'), subtitle: `${producer} · ${str(beat, 'genre') || 'BeatStore'}`, href,
      creatorUsername: profile ? str(profile, 'username') : undefined, image: media(beat, 'artwork_path'), tags: [str(beat, 'genre'), str(beat, 'mood'), str(beat, 'description'), str(beat, 'bpm'), str(beat, 'musical_key'), profile ? str(profile, 'username') : ''], publishedAt: str(beat, 'published_at') || str(beat, 'created_at'),
      detail: { id: beat.id, kind: 'beat', title: str(beat, 'title'), artist: producer, href, image: media(beat, 'artwork_path'), genre: str(beat, 'genre'), description: str(beat, 'description'), mood: str(beat, 'mood'), bpm: str(beat, 'bpm'), musicalKey: str(beat, 'musical_key'), price, src: media(beat, 'preview_path'), producerUsername: profile ? str(profile, 'username') : undefined },
    })
  }
  for (const profile of profiles.values()) {
    const username = str(profile, 'username')
    if (!username) continue
    const ownTracks = rows('tracks').filter(row => row.user_id === profile.id)
    const ownBeats = rows('beats').filter(row => row.producer_user_id === profile.id)
    const linkedTracks = rows('credits').filter(credit => {
      if (!tracks.has(str(credit, 'track_id'))) return false
      try {
        const link = new URL(str(credit, 'profile_url'), 'https://bvsradio.com')
        return ['bvsradio.com', 'www.bvsradio.com'].includes(link.hostname) && decodeURIComponent(link.pathname).replace(/\/$/, '').toLowerCase() === `/artist/${username.toLowerCase()}`
      } catch { return false }
    })
    const href = mobile ? `/app/${surface}/creator/${profile.id}` : `/artist/${encodeURIComponent(username)}`
    const genres = [...new Set([...ownTracks, ...ownBeats].map(row => str(row, 'genre')).filter(Boolean))]
    const common = { creatorUsername: username, genres, title: name(profile), image: media(profile, 'avatar_url') || media(ownTracks[0] || ownBeats[0] || { id: '' }, ownTracks.length ? 'artwork_url' : 'artwork_path'), tags: [username, resolvePublicHandle(username), ...genres], href }
    if (['artist', 'admin'].includes(str(profile, 'role')) || ownTracks.length || linkedTracks.length) items.push({ ...common, id: `artist-${profile.id}`, kind: 'artist', subtitle: 'BVS artist' })
    if (profile.role === 'producer' || ownBeats.length) items.push({ ...common, id: `producer-${profile.id}`, kind: 'producer', beatCount: ownBeats.length, subtitle: `Producer · ${ownBeats.length} published beats`, href: mobile ? `${href}?as=producer` : href })
  }
  if (!mobile) {
    const shows = new Map(rows('shows').map(row => [row.id, row]))
    for (const show of [...rows('programmes'), ...rows('shows')]) {
      const slug = str(show, 'slug')
      if (!/^[a-z0-9-]{1,80}$/.test(slug)) continue
      items.push({ id: `show-${show.id}`, kind: 'show', title: str(show, 'title'), subtitle: str(show, 'host') || str(show, 'category') || 'BVS programme', href: `/shows/${slug}`, image: media(show, 'image_url') || media(show, 'artwork_url'), tags: [str(show, 'tagline'), str(show, 'description')] })
    }
    for (const episode of rows('episodes')) {
      const show = shows.get(str(episode, 'show_id'))
      if (!show || !/^[a-z0-9-]{1,80}$/.test(str(show, 'slug'))) continue
      items.push({ id: `episode-${episode.id}`, kind: 'show', title: str(episode, 'title'), subtitle: `${str(show, 'title')} · Episode`, href: `/shows/${str(show, 'slug')}#episode-${episode.id}`,  image: media(show, 'artwork_url'), tags: [str(episode, 'description')], publishedAt: str(episode, 'published_at') })
    }
    for (const release of releases.values()) {
      const href = `/album/${release.id}`
      items.push({ id: `release-${release.id}`, kind: 'release', title: str(release, 'title'), subtitle: `${str(release, 'artist_name')} · ${str(release, 'release_type') || 'Release'}`, href, image: media(release, 'cover_url'), publishedAt: str(release, 'published_at'),
        tags: [str(release, 'genre'), str(release, 'description')], detail: { id: release.id, kind: 'release', title: str(release, 'title'), artist: str(release, 'artist_name'), href, image: media(release, 'cover_url'), genre: str(release, 'genre'), releaseType: str(release, 'release_type'), publishedAt: str(release, 'published_at') } })
    }
    for (const playlist of rows('playlists')) {
      const members = rows('memberships').filter(row => row.playlist_id === playlist.id && (tracks.has(str(row, 'track_id')) || beats.has(str(row, 'beat_id'))))
      // Empty public playlists still have a public detail page and are searchable.
      const creator = profiles.get(str(playlist, 'user_id'))
      items.push({ id: `playlist-${playlist.id}`, kind: 'playlist', title: str(playlist, 'title'), subtitle: `${creator ? name(creator) : 'BVS listener'} · ${members.length} tracks`, href: `/playlist/${playlist.id}`, image: media(playlist, 'cover_url'), tags: [str(playlist, 'description'), creator ? str(creator, 'username') : ''], publishedAt: str(playlist, 'updated_at') })
    }
    for (const listing of rows('listings')) {
      const profile = profiles.get(str(listing, 'seller_user_id'))
      items.push({ id: `listing-${listing.id}`, kind: listing.listing_type === 'service' ? 'service' : 'product', title: str(listing, 'title'), subtitle: `${name(profile)} · ${str(listing, 'category').replaceAll('_', ' ')}`, href: `/marketplace?listing=${encodeURIComponent(str(listing, 'slug'))}`, image: media(listing, 'artwork_path'), tags: [str(listing, 'description'), str(listing, 'category'), profile ? str(profile, 'username') : ''], publishedAt: str(listing, 'published_at') })
    }
    // Supplement the live catalogue; never replace the archive wholesale.
    for (const track of curatedCatalogueTracks) {
      const kind = track.albumPackage ? 'release' : track.type === 'beat' ? 'beat' : 'track'
      const href = `/catalogue?q=${encodeURIComponent(track.title)}`
      items.push({ id: `curated-${track.id}`, kind, title: track.title, subtitle: `${track.artist} · ${track.collection}`, href, image: track.artwork, tags: [track.genre, track.description], detail: { ...track, id: String(track.id), kind, href, image: track.artwork } })
    }
    for (const item of discoveryItems) {
      const kind = item.id.startsWith('album-') || item.tags?.includes('album') ? 'release' : item.tags?.includes('beat') ? 'beat' : item.kind
      items.push({ ...item, kind })
    }
    items.push(...blogPosts.map(post => ({ id: `story-${post.slug}`, kind: 'story' as const, title: post.title, subtitle: `${post.readTime} · BVS story`, href: `/blog/${post.slug}`, tags: [post.description], publishedAt: post.date })))
    items.push(...officialBvsServices.map(service => ({ id: `official-service-${service.id}`, kind: 'service' as const, title: service.title, subtitle: `${service.category} · ${service.price}`, href: '/shop#services', tags: [service.category, service.desc, service.engineer], badge: 'Official BVS' })))
  }
  // Live records win over curated copies; distinct artists with the same title remain distinct.
  const seen = new Set<string>()
  const ids = new Set<string>()
  const unique = items.filter(item => {
    const creator = item.kind === 'artist' || item.kind === 'producer' ? item.href.split('?')[0] : item.detail?.artist || item.subtitle.split('·')[0].trim()
    const identity = `${item.kind}:${discoveryWords(item.title).join('')}:${discoveryWords(creator).join('')}`
    const supplement = item.id.startsWith('curated-') || discoveryItems.some(local => local.id === item.id)
    if (!item.title || ids.has(item.id) || (supplement && seen.has(identity))) return false
    ids.add(item.id)
    seen.add(identity)
    return true
  })
  return { items: unique, unavailable }
}

// Short-lived, surface-isolated, single-flight cache. Failed snapshots are never cached.
const snapshots = new Map<DiscoverySurface, { expires: number; value: DiscoverySnapshot }>()
const pending = new Map<DiscoverySurface, Promise<DiscoverySnapshot>>()
export async function getDiscoverySnapshot(surface: DiscoverySurface) {
  const cached = snapshots.get(surface)
  if (cached && cached.expires > Date.now()) return cached.value
  const running = pending.get(surface)
  if (running) return running
  const request = loadDiscoverySnapshot(surface).then(value => {
    if (!value.unavailable.length) snapshots.set(surface, { expires: Date.now() + 30_000, value })
    return value
  }).finally(() => pending.delete(surface))
  pending.set(surface, request)
  return request
}
