import 'server-only'

export type PublicArtistTrack = {
  id: string
  title: string
  genre?: string
  artwork_url?: string
  in_rotation?: boolean
  is_downloadable?: boolean
  licence_type?: string
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
  beats?: Array<{ id: string; title: string; genre?: string; artwork_url?: string; starting_price?: number }>
  location?: string
  links?: { instagram?: string; spotify?: string; website?: string }
  joinedAt?: string
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
  wolfbrx: { id: 'wolfbrx', username: 'wolfbrx', name: 'WolfBrx', role: 'Producer', bio: 'Producer behind beats currently available in the BVS catalogue. This profile will grow with verified credits, releases and artist-provided links.', image: '/images/musicians.jpg', tracks: [] },
  wolfbridges: { id: 'wolfbridges', username: 'wolfbridges', name: 'Wolfbridges', role: 'Artist', bio: 'Artist behind STRAIGHTENIN, HOWLING IN THE HILLS 2, WOLF BEEN BAD and related BVSRadio playlist features now surfaced in catalogue discovery.', image: '/images/albums/straightenin.jpg', tracks: [] },
  whills: { id: 'whills', username: 'whills', name: 'W.Hills', role: 'Artist', bio: 'Collaborator on Wolfbridges projects featured in the BVS catalogue, including HOWLING IN THE HILLS 2.', image: '/images/albums/howling-in-the-hills-2.jpg', tracks: [] },
  'i-ratty': { id: 'i-ratty', username: 'i-ratty', name: 'I Ratty', role: 'Artist', bio: 'Collaborator on Wolfbridges releases featured through BVS catalogue discovery, including WOLF BEEN BAD.', image: '/images/albums/wolf-been-bad.jpg', tracks: [] },
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
  return (hasCustomAvatar ? avatarUrl : artworkUrl) || '/assets/images/default-avatar.png'
}

export async function getPublishedArtists(): Promise<PublishedArtistSummary[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return fallbackSummaries
  const headers = { apikey: key, Authorization: `Bearer ${key}` }
  try {
    const profileResponse = await fetch(
      `${url}/rest/v1/profiles?is_published=eq.true&is_verified=eq.true&select=id,username,display_name,bio,avatar_url,role,is_producer&order=display_name.asc`,
      { headers, next: { revalidate: 60 } },
    )
    if (!profileResponse.ok) return fallbackSummaries
    const profiles = (await profileResponse.json() as Array<{
      id: string
      username: string
      display_name?: string
      bio?: string
      avatar_url?: string
      role: string
      is_producer?: boolean
    }>).filter((profile) => ['artist', 'admin'].includes(profile.role) || profile.is_producer)
    if (!profiles.length) return []

    const ids = profiles.map((profile) => profile.id)
    const tracksResponse = await fetch(
      `${url}/rest/v1/tracks?user_id=in.(${ids.join(',')})&is_public=eq.true&editorial_status=eq.approved&select=user_id,genre,artwork_url`,
      { headers, next: { revalidate: 60 } },
    )
    const tracks = tracksResponse.ok
      ? await tracksResponse.json() as Array<{ user_id: string; genre?: string; artwork_url?: string }>
      : []
    const artistNamesResponse = await fetch(
      `${url}/rest/v1/artist_waitlist?onboarded_profile_id=in.(${ids.join(',')})&select=onboarded_profile_id,artist_name,updated_at&order=updated_at.desc`,
      {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY || key,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || key}`,
        },
        next: { revalidate: 60 },
      },
    )
    const artistNames = artistNamesResponse.ok
      ? await artistNamesResponse.json() as Array<{ onboarded_profile_id: string; artist_name: string }>
      : []

    return profiles.map((profile) => {
      const artistTracks = tracks.filter((track) => track.user_id === profile.id)
      const genres = [...new Set(artistTracks.map((track) => track.genre).filter(Boolean))] as string[]
      const trackArtwork = artistTracks.find((track) => track.artwork_url)?.artwork_url
      const publishingName = artistNames.find((item) => item.onboarded_profile_id === profile.id)?.artist_name
      return {
        id: profile.id,
        username: profile.username,
        name: publishingName || profile.username,
        role: profile.role === 'artist' ? 'BVS artist' : profile.role,
        bio: profile.bio || 'Verified artist on BVS Radio.',
        image: artistImage(profile.avatar_url, trackArtwork),
        trackCount: artistTracks.length,
        genres,
      }
    })
  } catch {
    return fallbackSummaries
  }
}

export async function getPublicArtist(slug: string): Promise<PublicArtist | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return fallback[slug] || null
  const headers = { apikey: key, Authorization: `Bearer ${key}` }
  try {
    const profileResponse = await fetch(`${url}/rest/v1/profiles?username=ilike.${encodeURIComponent(slug)}&is_published=eq.true&select=id,username,display_name,bio,avatar_url,role,is_producer,created_at&limit=1`, { headers, next: { revalidate: 60 } })
    if (!profileResponse.ok) return fallback[slug] || null
    const profiles = await profileResponse.json()
    const profile = profiles[0]
    if (!profile) return null
    const waitlistResponse = await fetch(`${url}/rest/v1/artist_waitlist?onboarded_profile_id=eq.${profile.id}&select=artist_name,country,city,links&order=updated_at.desc&limit=1`, { headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY || key, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || key}` }, next: { revalidate: 60 } })
    const creatorDetails = waitlistResponse.ok ? (await waitlistResponse.json())[0] : null
    const tracksResponse = await fetch(`${url}/rest/v1/tracks?user_id=eq.${profile.id}&is_public=eq.true&editorial_status=eq.approved&select=id,title,genre,artwork_url,in_rotation,is_downloadable,licence_type&order=created_at.desc`, { headers, next: { revalidate: 60 } })
    const tracks = tracksResponse.ok ? await tracksResponse.json() : []
    const beatsResponse = await fetch(`${url}/rest/v1/beats?producer_user_id=eq.${profile.id}&is_public=eq.true&status=eq.published&select=id,title,genre,artwork_path,beat_licence_options(price_usd,is_active)&order=published_at.desc`, { headers, next: { revalidate: 60 } })
    const rawBeats = beatsResponse.ok ? await beatsResponse.json() : []
    const beats = rawBeats.map((beat: { id: string; title: string; genre?: string; artwork_path?: string; beat_licence_options?: Array<{ price_usd: number; is_active: boolean }> }) => {
      const prices = (beat.beat_licence_options || []).filter(option => option.is_active).map(option => Number(option.price_usd)).filter(Number.isFinite)
      return { id: beat.id, title: beat.title, genre: beat.genre, artwork_url: beat.artwork_path ? `${url}/storage/v1/object/public/bvsradio-audio/${beat.artwork_path}` : undefined, starting_price: prices.length ? Math.min(...prices) : 29 }
    })
    const ids = tracks.map((track: { id: string }) => track.id)
    let credits: Array<{ track_id: string; person_name: string; credit_role: string }> = []
    if (ids.length) {
      const creditsResponse = await fetch(`${url}/rest/v1/track_credits?track_id=in.(${ids.join(',')})&is_verified=eq.true&select=track_id,person_name,credit_role`, { headers, next: { revalidate: 60 } })
      if (creditsResponse.ok) credits = await creditsResponse.json()
    }
    const trackArtwork = tracks.find((track: { artwork_url?: string }) => track.artwork_url)?.artwork_url
    const beatArtwork = beats.find((beat: { artwork_url?: string }) => beat.artwork_url)?.artwork_url
    const role = profile.is_producer ? (profile.role === 'artist' ? 'BVS artist & producer' : 'BVS producer') : profile.role === 'artist' ? 'BVS artist' : profile.role
    return { id: profile.id, username: profile.username, name: creatorDetails?.artist_name || profile.username, role, bio: profile.bio || 'Verified creator on BVS Radio.', image: artistImage(profile.avatar_url, trackArtwork || beatArtwork), tracks: tracks.map((track: Omit<PublicArtistTrack, 'credits'>) => ({ ...track, credits: credits.filter(credit => credit.track_id === track.id) })), beats, location: [creatorDetails?.city, creatorDetails?.country].filter(Boolean).join(', '), links: creatorDetails?.links || {}, joinedAt: profile.created_at }
  } catch { return fallback[slug] || null }
}

export async function getPublishedProducers(): Promise<PublishedProducerSummary[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return []
  const headers = { apikey: key, Authorization: `Bearer ${key}` }
  try {
    const profilesResponse = await fetch(`${url}/rest/v1/profiles?is_published=eq.true&is_verified=eq.true&is_producer=eq.true&select=id,username,display_name,avatar_url&order=display_name.asc`, { headers, cache: 'no-store' })
    if (!profilesResponse.ok) return []
    const profiles = await profilesResponse.json() as Array<{ id: string; username: string; display_name?: string; avatar_url?: string }>
    if (!profiles.length) return []
    const profileIds = profiles.map(profile => profile.id)
    const beatsResponse = await fetch(`${url}/rest/v1/beats?producer_user_id=in.(${profiles.map(profile => profile.id).join(',')})&is_public=eq.true&status=eq.published&select=producer_user_id,genre,artwork_path`, { headers, cache: 'no-store' })
    const beats = beatsResponse.ok ? await beatsResponse.json() as Array<{ producer_user_id: string; genre?: string; artwork_path?: string }> : []
    const artistNamesResponse = await fetch(
      `${url}/rest/v1/artist_waitlist?onboarded_profile_id=in.(${profileIds.join(',')})&select=onboarded_profile_id,artist_name,updated_at&order=updated_at.desc`,
      {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY || key,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || key}`,
        },
        cache: 'no-store',
      },
    )
    const artistNames = artistNamesResponse.ok
      ? await artistNamesResponse.json() as Array<{ onboarded_profile_id: string; artist_name: string }>
      : []
    return profiles.map(profile => {
      const producerBeats = beats.filter(beat => beat.producer_user_id === profile.id)
      const artworkPath = producerBeats.find(beat => beat.artwork_path)?.artwork_path
      const publishingName = artistNames.find(item => item.onboarded_profile_id === profile.id)?.artist_name
      return {
        id: profile.id,
        username: profile.username,
        name: publishingName || profile.username,
        image: artistImage(profile.avatar_url, artworkPath ? `${url}/storage/v1/object/public/bvsradio-audio/${artworkPath}` : undefined),
        beatCount: producerBeats.length,
        genres: [...new Set(producerBeats.map(beat => beat.genre).filter(Boolean))] as string[],
      }
    }).filter(producer => producer.beatCount > 0)
  } catch {
    return []
  }
}
