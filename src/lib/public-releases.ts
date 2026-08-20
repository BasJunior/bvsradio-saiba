import 'server-only'
import { mediaUrlForStoredValue } from '@/lib/media-url'

export type PublicReleaseTrack = {
  id: string
  title: string
  position: number
  src: string
  credits: Array<{ person_name: string; credit_role: string }>
}

export type PublicRelease = {
  id: string
  title: string
  artist: string
  genre?: string
  description?: string
  cover: string
  releaseType: string
  copyrightYear?: number
  publishedAt?: string
  tracks: PublicReleaseTrack[]
}

function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  return url && key ? { url, headers: { apikey: key, Authorization: `Bearer ${key}` } } : null
}

export async function getPublicReleases(releaseId?: string): Promise<PublicRelease[]> {
  const setup = config()
  if (!setup) return []
  const releaseFilter = releaseId ? `&id=eq.${encodeURIComponent(releaseId)}` : ''
  const releasesResponse = await fetch(
    `${setup.url}/rest/v1/releases?is_public=eq.true&editorial_status=eq.approved${releaseFilter}&select=id,title,artist_name,genre,description,cover_url,release_type,copyright_year,published_at&order=published_at.desc&limit=100`,
    { headers: setup.headers, cache: 'no-store' },
  )
  if (!releasesResponse.ok) return []
  const releases = await releasesResponse.json() as Array<Record<string, unknown>>
  if (!releases.length) return []
  const ids = releases.map((release) => String(release.id))
  const tracksResponse = await fetch(
    `${setup.url}/rest/v1/release_tracks?release_id=in.(${ids.join(',')})&select=id,release_id,position,title,track_id,file_url,audio_path&order=position.asc`,
    { headers: setup.headers, cache: 'no-store' },
  )
  if (!tracksResponse.ok) return []
  const members = await tracksResponse.json() as Array<Record<string, unknown>>
  const trackIds = members.map((member) => String(member.track_id || '')).filter(Boolean)
  const creditsResponse = trackIds.length
    ? await fetch(
        `${setup.url}/rest/v1/track_credits?track_id=in.(${trackIds.join(',')})&is_verified=eq.true&select=track_id,person_name,credit_role&order=credit_role.asc`,
        { headers: setup.headers, cache: 'no-store' },
      )
    : null
  const credits = creditsResponse?.ok
    ? await creditsResponse.json() as Array<{ track_id: string; person_name: string; credit_role: string }>
    : []

  return releases.map((release) => ({
    id: String(release.id),
    title: String(release.title || 'Untitled release'),
    artist: String(release.artist_name || 'BVS artist'),
    genre: release.genre ? String(release.genre) : undefined,
    description: release.description ? String(release.description) : undefined,
    cover: mediaUrlForStoredValue(String(release.cover_url || '')) || '/assets/images/default-artwork.jpg',
    releaseType: String(release.release_type || 'album'),
    copyrightYear: release.copyright_year ? Number(release.copyright_year) : undefined,
    publishedAt: release.published_at ? String(release.published_at) : undefined,
    tracks: members
      .filter((member) => String(member.release_id) === String(release.id))
      .map((member) => ({
        id: String(member.track_id || member.id),
        title: String(member.title || 'Untitled track'),
        position: Number(member.position || 0),
        src: mediaUrlForStoredValue(String(member.file_url || member.audio_path || '')) || '',
        credits: credits
          .filter((credit) => credit.track_id === String(member.track_id || ''))
          .map(({ person_name, credit_role }) => ({ person_name, credit_role })),
      })),
  }))
}

export async function getPublicRelease(id: string) {
  return (await getPublicReleases(id))[0] || null
}
