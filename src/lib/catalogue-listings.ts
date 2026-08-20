import 'server-only'
import { mediaUrlForStoredValue } from '@/lib/media-url'
import { PRICE_SINGLE_DOWNLOAD } from '@/lib/catalogue-pricing'

export type CatalogueListing = {
  id: string
  title: string
  artist: string
  genre: string
  collection: string
  duration: string
  description: string
  type: 'single' | 'beat' | 'mix'
  src: string
  artwork: string
  bpm?: string
  price?: number | null
  externalUrl?: string
  streamOnly?: boolean
  albumPackage?: boolean
  producerBeat?: boolean
  producerUsername?: string
  packId?: string | null
  releaseId?: string | null
  source: 'track' | 'release-package' | 'curated'
  /** Public/editorial timestamp used for truthful Fresh ordering. */
  publishedAt?: string
  /** Explicit editorial rotation state used by Explore → On BVS. */
  inRotation?: boolean
  /** Explicit editorial feature state; never inferred from popularity. */
  featured?: boolean
}

function formatDuration(seconds?: number | null) {
  const n = Number(seconds)
  if (!Number.isFinite(n) || n <= 0) return 'Preview'
  const whole = Math.floor(n)
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return url && key
    ? { url, headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' } }
    : null
}

type TrackRow = {
  id: string
  title?: string
  artist_name?: string
  genre?: string
  description?: string
  duration_sec?: number | null
  file_url?: string | null
  artwork_url?: string | null
  is_downloadable?: boolean
  download_price?: number | string | null
  licence_type?: string | null
  release_id?: string | null
  track_number?: number | null
  in_rotation?: boolean
  is_featured?: boolean
  bpm?: number | null
  created_at?: string | null
  reviewed_at?: string | null
}

type ReleaseRow = {
  id: string
  title?: string
  artist_name?: string
  genre?: string
  description?: string
  cover_url?: string | null
  release_type?: string | null
  track_count?: number | null
  published_at?: string | null
}

function trackListing(row: TrackRow, releaseTitleById: Map<string, string>): CatalogueListing {
  const releaseId = row.release_id ? String(row.release_id) : null
  const collection = releaseId
    ? releaseTitleById.get(releaseId) || 'Published release'
    : row.in_rotation
      ? 'BVS Rotation'
      : 'Published on BVS'
  const downloadable = row.is_downloadable === true && String(row.licence_type || '') !== 'not_for_sale'
  const rawPrice = Number(row.download_price)
  const price = downloadable
    ? Number.isFinite(rawPrice) && rawPrice > 0
      ? rawPrice
      : PRICE_SINGLE_DOWNLOAD
    : null
  return {
    id: String(row.id),
    title: String(row.title || 'Untitled track').trim(),
    artist: String(row.artist_name || 'BVS artist').trim(),
    genre: String(row.genre || 'Music'),
    collection,
    duration: formatDuration(row.duration_sec),
    description:
      String(row.description || '').trim() ||
      (downloadable
        ? `Published BVS catalogue track · $${price} personal download.`
        : 'Published on BVS for listening and discovery.'),
    type: 'single',
    src: mediaUrlForStoredValue(row.file_url) || String(row.file_url || ''),
    artwork:
      mediaUrlForStoredValue(row.artwork_url) ||
      String(row.artwork_url || '') ||
      '/assets/images/default-artwork.jpg',
    bpm: row.bpm ? String(row.bpm) : undefined,
    price,
    streamOnly: !downloadable,
    releaseId,
    source: 'track',
    publishedAt: row.reviewed_at || row.created_at || undefined,
    inRotation: row.in_rotation === true,
    featured: row.is_featured === true,
  }
}

function releasePackageListing(row: ReleaseRow, trackCount: number): CatalogueListing {
  const count = trackCount || Number(row.track_count) || 0
  // Bundle starting point: singles default $2, album packages historically $14–$19
  const packagePrice = count >= 8 ? 19 : count >= 2 ? 14 : PRICE_SINGLE_DOWNLOAD
  const releaseId = String(row.id)
  return {
    // Cart/download id is the release UUID (products resolve albums/<uuid>.zip).
    id: releaseId,
    title: String(row.title || 'Untitled release').trim(),
    artist: String(row.artist_name || 'BVS artist').trim(),
    genre: String(row.genre || row.release_type || 'Album'),
    collection: 'Albums',
    duration: count ? `${count} tracks` : 'Full release',
    description:
      String(row.description || '').trim() ||
      `Full ${String(row.release_type || 'release')} download package from the live BVS catalogue. After payment BVS delivers the album package (zip staged under albums/<release-id> or via support).`,
    type: 'mix',
    src: '',
    artwork:
      mediaUrlForStoredValue(row.cover_url) ||
      String(row.cover_url || '') ||
      '/assets/images/default-artwork.jpg',
    price: packagePrice,
    albumPackage: true,
    releaseId,
    source: 'release-package',
    publishedAt: row.published_at || undefined,
  }
}

/**
 * Live music catalogue listings from approved public tracks + release packages.
 * Curated/static archive & stream-only rows stay client-side as fallback/supplement.
 */
export async function listCatalogueMusicListings(limit = 200): Promise<{
  listings: CatalogueListing[]
  summary: {
    trackCount: number
    releasePackageCount: number
    updatedAt: string
  }
}> {
  const setup = config()
  if (!setup) {
    return {
      listings: [],
      summary: { trackCount: 0, releasePackageCount: 0, updatedAt: new Date().toISOString() },
    }
  }

  const [tracksRes, releasesRes] = await Promise.all([
    fetch(
      `${setup.url}/rest/v1/tracks?is_public=eq.true&editorial_status=eq.approved&select=id,title,artist_name,genre,description,duration_sec,file_url,artwork_url,is_downloadable,download_price,licence_type,release_id,track_number,in_rotation,is_featured,bpm,created_at,reviewed_at&order=reviewed_at.desc.nullslast,created_at.desc&limit=${limit}`,
      { headers: setup.headers, cache: 'no-store' },
    ),
    fetch(
      `${setup.url}/rest/v1/releases?is_public=eq.true&editorial_status=eq.approved&select=id,title,artist_name,genre,description,cover_url,release_type,track_count,published_at&order=published_at.desc.nullslast&limit=50`,
      { headers: setup.headers, cache: 'no-store' },
    ),
  ])

  const tracks = tracksRes.ok ? ((await tracksRes.json()) as TrackRow[]) : []
  const releases = releasesRes.ok ? ((await releasesRes.json()) as ReleaseRow[]) : []
  const releaseTitleById = new Map(
    releases.map((release) => [String(release.id), String(release.title || 'Published release')]),
  )

  const trackListings = tracks
    .map((row) => trackListing(row, releaseTitleById))
    .filter((row) => row.title)

  // Count members per release for package cards
  const releaseCounts = new Map<string, number>()
  for (const row of tracks) {
    if (!row.release_id) continue
    const key = String(row.release_id)
    releaseCounts.set(key, (releaseCounts.get(key) || 0) + 1)
  }

  const packageListings = releases
    .map((release) => {
      const count = releaseCounts.get(String(release.id)) || Number(release.track_count) || 0
      if (count < 1) return null
      return releasePackageListing(release, count)
    })
    .filter((row): row is CatalogueListing => Boolean(row))

  return {
    listings: [...packageListings, ...trackListings],
    summary: {
      trackCount: trackListings.length,
      releasePackageCount: packageListings.length,
      updatedAt: new Date().toISOString(),
    },
  }
}
