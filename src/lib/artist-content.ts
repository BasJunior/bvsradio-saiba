import 'server-only'
import { creatorPublicName, producerPublicName, publicHandleAccountCandidates, resolvePublicHandle } from '@/lib/public-name'
import { mediaUrlForStoredValue } from '@/lib/media-url'

export type PublicArtistTrack = {
  id: string
  title: string
  genre?: string
  artwork_url?: string
  in_rotation?: boolean
  is_downloadable?: boolean
  licence_type?: string
  isrc?: string
  spotify_url?: string
  audio_url?: string
  credits: Array<{ person_name: string; credit_role: string }>
}

export type PublicArtist = {
  id: string
  username: string
  name: string
  role: string
  bio: string
  image: string
  tracks: PublicArtistTrack[]
  beats?: Array<{ id: string; title: string; genre?: string; artwork_url?: string; preview_url?: string; starting_price?: number }>
  location?: string
  links?: { instagram?: string; spotify?: string; website?: string }
  spotifyArtistId?: string
  joinedAt?: string
}

/** Known DSP identity overrides (public profile only — not a named BVS partner). */
const CREATOR_DSP_LINKS: Record<string, { spotify?: string; spotifyArtistId?: string }> = {
  basjunior: {
    spotify: 'https://open.spotify.com/artist/6YFW80yi3gjIqoXtOErObH',
    spotifyArtistId: '6YFW80yi3gjIqoXtOErObH',
  },
}

export type PublishedArtistSummary = {
  id: string
  username: string
  name: string
  role: string
  bio: string
  image: string
  trackCount: number
  genres: string[]
}

export type PublishedProducerSummary = {
  id: string
  username: string
  name: string
  image: string
  beatCount: number
  genres: string[]
}

const fallback: Record<string, PublicArtist> = {
  'bvs-radio': { id: 'bvs-radio', username: 'bvs-radio', name: 'BVS Radio', role: 'Station artist', bio: 'Original recordings and restored cuts from the BVS archive. Credits and release details will be expanded as the archive is documented.', image: '/music/Bvs-3000x3000%202.png', tracks: [] },
  basjunior: {
    id: 'basjunior',
    username: 'basjunior',
    name: 'BasJunior',
    role: 'BVS artist',
    bio: 'BasJunior on BVS Radio — listen on the station and on major platforms.',
    image: '/assets/images/default-avatar.png',
    tracks: [],
    links: { spotify: CREATOR_DSP_LINKS.basjunior.spotify },
    spotifyArtistId: CREATOR_DSP_LINKS.basjunior.spotifyArtistId,
  },
  'wolf-bridges': { id: 'wolf-bridges', username: 'wolf-bridges', name: 'Wolf Bridges', role: 'Artist & producer', bio: 'Artist and producer behind the Wolf Bridges BeatStore catalogue, STRAIGHTENIN, HOWLING IN THE HILLS 2, WOLF BEEN BAD and related BVS Radio features.', image: '/images/artists/wolf-bridges.jpg', tracks: [] },
  whills: { id: 'whills', username: 'whills', name: 'W.Hills', role: 'Artist', bio: 'Collaborator on Wolf Bridges projects featured in the BVS catalogue, including HOWLING IN THE HILLS 2.', image: '/images/albums/howling-in-the-hills-2.jpg', tracks: [] },
  'i-ratty': { id: 'i-ratty', username: 'i-ratty', name: 'I Ratty', role: 'Artist', bio: 'Collaborator on Wolf Bridges releases featured through BVS catalogue discovery, including WOLF BEEN BAD.', image: '/images/albums/wolf-been-bad.jpg', tracks: [] },
}

const legacyCreatorTracks: Record<string, PublicArtistTrack[]> = {
  'wolf-bridges': [
    {
      id: 'legacy-straightenin',
      title: 'STRAIGHTENIN',
      genre: 'Streaming release · 8 tracks',
      artwork_url: '/images/albums/straightenin.jpg',
      is_downloadable: false,
      licence_type: 'external_stream',
      credits: [],
    },
    {
      id: 'legacy-howling-in-the-hills-2',
      title: 'HOWLING IN THE HILLS 2',
      genre: 'Streaming release · 13 tracks',
      artwork_url: '/images/albums/howling-in-the-hills-2.jpg',
      is_downloadable: false,
      licence_type: 'external_stream',
      credits: [],
    },
    {
      id: 'legacy-wolf-been-bad',
      title: 'WOLF BEEN BAD',
      genre: 'Streaming release · 4 tracks',
      artwork_url: '/images/albums/wolf-been-bad.jpg',
      is_downloadable: false,
      licence_type: 'external_stream',
      credits: [],
    },
  ],
}

const fallbackSummaries = Object.values(fallback).map((artist) => ({
  id: artist.id,
  username: artist.username,
  name: artist.name,
  role: artist.role,
  bio: artist.bio,
  image: artist.image,
  trackCount: artist.tracks.length,
  genres: [],
}))

function artistImage(avatarUrl: string | undefined, artworkUrl: string | undefined) {
  const hasCustomAvatar = avatarUrl && !avatarUrl.includes('default-avatar')
  return mediaUrlForStoredValue(hasCustomAvatar ? avatarUrl : artworkUrl) || '/assets/images/default-avatar.png'
}

function berlinDayKey() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Berlin' })
}

function hashSeed(input: string) {
  let hash = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function fairShuffle<T extends { id: string }>(items: T[], scope: string) {
  const next = [...items]
  let state = hashSeed(`${scope}:${berlinDayKey()}`) || 1
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
}

export async function getPublishedArtists(): Promise<PublishedArtistSummary[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return fairShuffle(fallbackSummaries, 'artists')
  const headers = { apikey: key, Authorization: `Bearer ${key}` }
  try {
    const profileResponse = await fetch(
      `${url}/rest/v1/profiles?is_published=eq.true&is_verified=eq.true&select=id,username,display_name,bio,avatar_url,role,is_producer,creator_public_name,creator_name_status&order=username.asc`,
      { headers, cache: 'no-store' },
    )
    if (!profileResponse.ok) return fairShuffle(fallbackSummaries, 'artists')
    const profiles = (await profileResponse.json() as Array<{
      id: string
      username: string
      display_name?: string
      bio?: string
      avatar_url?: string
      role: string
      is_producer?: boolean
      creator_public_name?: string
      creator_name_status?: string
    }>).filter((profile) => ['artist', 'admin'].includes(profile.role))
    if (!profiles.length) return []

    const ids = profiles.map((profile) => profile.id)
    const tracksResponse = await fetch(
      `${url}/rest/v1/tracks?user_id=in.(${ids.join(',')})&is_public=eq.true&editorial_status=eq.approved&select=user_id,genre,artwork_url`,
      { headers, cache: 'no-store' },
    )
    const tracks = tracksResponse.ok
      ? await tracksResponse.json() as Array<{ user_id: string; genre?: string; artwork_url?: string }>
      : []
    const artists = profiles.map((profile) => {
      const artistTracks = tracks.filter((track) => track.user_id === profile.id)
      const linkedTracks = legacyCreatorTracks[profile.username] || []
      const genres = [...new Set([
        ...artistTracks.map((track) => track.genre),
        ...linkedTracks.map((track) => track.genre),
      ].filter(Boolean))] as string[]
      const trackArtwork =
        artistTracks.find((track) => track.artwork_url)?.artwork_url ||
        linkedTracks.find((track) => track.artwork_url)?.artwork_url
      return {
        id: profile.id,
        username: profile.username,
        name: creatorPublicName({
          publicName: profile.creator_public_name,
          publicNameStatus: profile.creator_name_status,
          username: profile.username,
        }),
        role: profile.role === 'artist' ? 'BVS artist' : profile.role,
        bio: profile.bio || 'Verified artist on BVS Radio.',
        image: artistImage(profile.avatar_url, trackArtwork),
        trackCount: artistTracks.length + linkedTracks.length,
        genres,
      }
    }).filter((artist) => artist.trackCount > 0)
    return fairShuffle(artists, 'artists')
  } catch {
    return fairShuffle(fallbackSummaries, 'artists')
  }
}

export async function getPublicArtist(slug: string): Promise<PublicArtist | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const resolvedSlug = resolvePublicHandle(slug) || slug
  const handleKey = resolvedSlug.toLowerCase().replace(/[^a-z0-9-]+/g, '')
  const dsp = CREATOR_DSP_LINKS[handleKey] || CREATOR_DSP_LINKS[resolvedSlug.toLowerCase()]
  if (!url || !key) {
    const local = fallback[resolvedSlug] || fallback[handleKey] || fallback[slug] || null
    if (!local || !dsp) return local
    return {
      ...local,
      links: { ...(local.links || {}), spotify: local.links?.spotify || dsp.spotify },
      spotifyArtistId: local.spotifyArtistId || dsp.spotifyArtistId,
    }
  }
  const headers = { apikey: key, Authorization: `Bearer ${key}` }
  try {
    const candidates = publicHandleAccountCandidates(slug)
    let profile: {
      id: string
      username: string
      display_name?: string
      bio?: string
      avatar_url?: string
      role: string
      is_producer?: boolean
      creator_public_name?: string
      creator_name_status?: string
      spotify_artist_id?: string
      spotify_url?: string
      created_at?: string
    } | null = null

    for (const candidate of candidates) {
      const profileResponse = await fetch(
        `${url}/rest/v1/profiles?username=ilike.${encodeURIComponent(candidate)}&is_published=eq.true&select=id,username,display_name,bio,avatar_url,role,is_producer,creator_public_name,creator_name_status,spotify_artist_id,spotify_url,created_at&limit=1`,
        { headers, next: { revalidate: 60 } },
      )
      if (!profileResponse.ok) continue
      const profiles = await profileResponse.json()
      if (profiles[0]) {
        profile = profiles[0]
        break
      }
    }

    // Older DBs may not have spotify_* columns yet — retry without them.
    if (!profile) {
      for (const candidate of candidates) {
        const profileResponse = await fetch(
          `${url}/rest/v1/profiles?username=ilike.${encodeURIComponent(candidate)}&is_published=eq.true&select=id,username,display_name,bio,avatar_url,role,is_producer,creator_public_name,creator_name_status,created_at&limit=1`,
          { headers, next: { revalidate: 60 } },
        )
        if (!profileResponse.ok) continue
        const profiles = await profileResponse.json()
        if (profiles[0]) {
          profile = profiles[0]
          break
        }
      }
    }

    if (!profile) return fallback[resolvedSlug] || fallback[handleKey] || fallback[slug] || null

    const waitlistResponse = await fetch(`${url}/rest/v1/artist_waitlist?onboarded_profile_id=eq.${profile.id}&select=country,city,links&order=updated_at.desc&limit=1`, { headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY || key, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || key}` }, next: { revalidate: 60 } })
    const creatorDetails = waitlistResponse.ok ? (await waitlistResponse.json())[0] : null

    let databaseTracks: Array<Omit<PublicArtistTrack, 'credits'> & { artwork_url?: string }> = []
    const trackSelectWithDsp = 'id,title,genre,artwork_url,file_url,in_rotation,is_downloadable,licence_type,isrc,spotify_url'
    const trackSelectBase = 'id,title,genre,artwork_url,file_url,in_rotation,is_downloadable,licence_type'
    for (const select of [trackSelectWithDsp, trackSelectBase]) {
      const tracksResponse = await fetch(
        `${url}/rest/v1/tracks?user_id=eq.${profile.id}&is_public=eq.true&editorial_status=eq.approved&select=${select}&order=created_at.desc`,
        { headers, next: { revalidate: 60 } },
      )
      if (tracksResponse.ok) {
        databaseTracks = await tracksResponse.json()
        break
      }
    }

    const beatsResponse = await fetch(`${url}/rest/v1/beats?producer_user_id=eq.${profile.id}&is_public=eq.true&status=eq.published&select=id,title,genre,artwork_path,preview_path,beat_licence_options(price_usd,is_active)&order=published_at.desc`, { headers, next: { revalidate: 60 } })
    const rawBeats = beatsResponse.ok ? await beatsResponse.json() : []
    const beats = rawBeats.map((beat: { id: string; title: string; genre?: string; artwork_path?: string; preview_path?: string; beat_licence_options?: Array<{ price_usd: number; is_active: boolean }> }) => {
      const prices = (beat.beat_licence_options || []).filter(option => option.is_active).map(option => Number(option.price_usd)).filter(Number.isFinite)
      return { id: beat.id, title: beat.title, genre: beat.genre, artwork_url: mediaUrlForStoredValue(beat.artwork_path) || undefined, preview_url: mediaUrlForStoredValue(beat.preview_path) || undefined, starting_price: prices.length ? Math.min(...prices) : 29 }
    })
    const ids = databaseTracks.map((track) => track.id)
    let credits: Array<{ track_id: string; person_name: string; credit_role: string }> = []
    if (ids.length) {
      const creditsResponse = await fetch(`${url}/rest/v1/track_credits?track_id=in.(${ids.join(',')})&is_verified=eq.true&select=track_id,person_name,credit_role`, { headers, next: { revalidate: 60 } })
      if (creditsResponse.ok) credits = await creditsResponse.json()
    }
    const publicUsername = resolvePublicHandle(profile.username) || profile.username
    const linkedTracks =
      legacyCreatorTracks[profile.username] ||
      legacyCreatorTracks[publicUsername] ||
      legacyCreatorTracks[handleKey] ||
      []
    const trackArtwork =
      databaseTracks.find((track) => track.artwork_url)?.artwork_url ||
      linkedTracks.find((track) => track.artwork_url)?.artwork_url
    const beatArtwork = beats.find((beat: { artwork_url?: string }) => beat.artwork_url)?.artwork_url
    const role = profile.is_producer ? (profile.role === 'artist' ? 'BVS artist & producer' : 'BVS producer') : profile.role === 'artist' ? 'BVS artist' : profile.role
    const publicTracks = databaseTracks.map((track) => ({
      ...track,
      artwork_url: mediaUrlForStoredValue(track.artwork_url) || undefined,
      audio_url: mediaUrlForStoredValue((track as { file_url?: string }).file_url) || undefined,
      isrc: track.isrc || undefined,
      spotify_url: track.spotify_url || undefined,
      credits: credits.filter(credit => credit.track_id === track.id),
    }))
    const waitlistLinks = (creatorDetails?.links || {}) as { instagram?: string; spotify?: string; website?: string }
    const links = {
      ...waitlistLinks,
      spotify:
        waitlistLinks.spotify ||
        profile.spotify_url ||
        dsp?.spotify ||
        undefined,
      instagram: waitlistLinks.instagram || undefined,
      website: waitlistLinks.website || undefined,
    }
    return {
      id: profile.id,
      username: publicUsername,
      name: creatorPublicName({
        publicName: profile.creator_public_name,
        publicNameStatus: profile.creator_name_status,
        username: profile.username,
      }),
      role,
      bio: profile.bio || 'Verified creator on BVS Radio.',
      image: artistImage(profile.avatar_url, trackArtwork || beatArtwork),
      tracks: [...publicTracks, ...linkedTracks],
      beats,
      location: [creatorDetails?.city, creatorDetails?.country].filter(Boolean).join(', '),
      links,
      spotifyArtistId: profile.spotify_artist_id || dsp?.spotifyArtistId,
      joinedAt: profile.created_at,
    }
  } catch {
    return fallback[resolvedSlug] || fallback[handleKey] || fallback[slug] || null
  }
}

export async function getPublishedProducers(): Promise<PublishedProducerSummary[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return []
  const headers = { apikey: key, Authorization: `Bearer ${key}` }
  try {
    // A published beat is the canonical eligibility signal for this shelf.
    // Starting from profile flags can hide a producer whose beat editorial already published.
    const beatsResponse = await fetch(`${url}/rest/v1/beats?is_public=eq.true&status=eq.published&select=producer_user_id,genre,artwork_path`, { headers, cache: 'no-store' })
    if (!beatsResponse.ok) return []
    const beats = await beatsResponse.json() as Array<{ producer_user_id: string; genre?: string; artwork_path?: string }>
    const producerIds = [...new Set(beats.map(beat => beat.producer_user_id).filter(Boolean))]
    if (!producerIds.length) return []
    const profilesResponse = await fetch(`${url}/rest/v1/profiles?id=in.(${producerIds.join(',')})&select=id,username,display_name,avatar_url,creator_public_name,creator_name_status,producer_public_name,producer_name_status&order=username.asc`, { headers, cache: 'no-store' })
    if (!profilesResponse.ok) return []
    const profiles = await profilesResponse.json() as Array<{ id: string; username: string; display_name?: string; avatar_url?: string; creator_public_name?: string; creator_name_status?: string; producer_public_name?: string; producer_name_status?: string }>
    return profiles.map(profile => {
      const producerBeats = beats.filter(beat => beat.producer_user_id === profile.id)
      const artworkPath = producerBeats.find(beat => beat.artwork_path)?.artwork_path
      return {
        id: profile.id,
        username: profile.username,
        name: producerPublicName({
          producerPublicName: profile.producer_public_name,
          producerNameStatus: profile.producer_name_status,
          publicName: profile.creator_public_name,
          publicNameStatus: profile.creator_name_status,
          username: profile.username,
        }),
        image: artistImage(profile.avatar_url, artworkPath ? mediaUrlForStoredValue(artworkPath) || undefined : undefined),
        beatCount: producerBeats.length,
        genres: [...new Set(producerBeats.map(beat => beat.genre).filter(Boolean))] as string[],
      }
    }).filter(producer => producer.beatCount > 0)
  } catch {
    return []
  }
}
