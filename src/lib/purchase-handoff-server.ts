import 'server-only'
import { creatorHeaders, creatorUrl } from '@/lib/creator-server'
import { loadProducerProfile, publicStorageUrl, type BeatLicenceRow, type BeatRow } from '@/lib/beatstore-server'
import { mediaUrlForStoredValue } from '@/lib/media-url'

export type TrackPurchaseHandoff = {
  kind: 'track'
  id: string
  title: string
  artist: string
  price: number
  artwork?: string
  src?: string
}

export type BeatPurchaseHandoff = {
  kind: 'beat'
  beatId: string
  licenceOptionId: string
  title: string
  producer: string
  licenceName: string
  price: number
  artwork?: string
  src?: string
}

export type PurchaseHandoff = TrackPurchaseHandoff | BeatPurchaseHandoff

function cleanId(value: unknown) {
  return String(value || '').trim().slice(0, 160)
}

export async function resolveTrackPurchase(trackIdInput: unknown): Promise<TrackPurchaseHandoff | null> {
  const trackId = cleanId(trackIdInput)
  if (!trackId) return null

  const response = await fetch(
    creatorUrl(
      `tracks?id=eq.${encodeURIComponent(trackId)}&is_public=eq.true&editorial_status=eq.approved&is_downloadable=eq.true&select=id,title,artist_name,file_url,artwork_url,download_price,licence_type&limit=1`,
    ),
    { headers: creatorHeaders, cache: 'no-store' },
  )
  if (!response.ok) return null

  const rows = await response.json() as Array<{
    id?: string
    title?: string
    artist_name?: string
    file_url?: string | null
    artwork_url?: string | null
    download_price?: number | string | null
    licence_type?: string | null
  }>
  const track = rows[0]
  const price = Number(track?.download_price)
  const licence = String(track?.licence_type || '')
  if (!track?.id || licence === 'not_for_sale' || !Number.isFinite(price) || price <= 0) return null

  return {
    kind: 'track',
    id: String(track.id),
    title: String(track.title || 'BVS track'),
    artist: String(track.artist_name || 'BVS artist'),
    price,
    artwork: mediaUrlForStoredValue(track.artwork_url || '') || undefined,
    src: mediaUrlForStoredValue(track.file_url || '') || String(track.file_url || '') || undefined,
  }
}

export async function resolveBeatPurchase(beatIdInput: unknown, licenceIdInput: unknown): Promise<BeatPurchaseHandoff | null> {
  const beatId = cleanId(beatIdInput)
  const licenceId = cleanId(licenceIdInput)
  if (!beatId || !licenceId) return null

  const response = await fetch(
    creatorUrl(
      `beats?id=eq.${encodeURIComponent(beatId)}&is_public=eq.true&status=eq.published&rights_confirmed=eq.true&select=id,title,producer_user_id,artwork_path,preview_path,beat_licence_options(id,beat_id,licence_code,licence_name,price_usd,currency,is_active,is_sold_out)&limit=1`,
    ),
    { headers: creatorHeaders, cache: 'no-store' },
  )
  if (!response.ok) return null

  const rows = await response.json() as Array<BeatRow & { beat_licence_options?: BeatLicenceRow[] }>
  const beat = rows[0]
  if (!beat?.id) return null
  const licence = (beat.beat_licence_options || []).find((item) => String(item.id) === licenceId)
  const price = Number(licence?.price_usd)
  if (!licence?.id || licence.is_active === false || licence.is_sold_out === true || !Number.isFinite(price) || price <= 0) return null

  const profile = await loadProducerProfile(beat.producer_user_id).catch(() => null)
  const producer = String(profile?.display_name || profile?.username || 'BVS producer')

  return {
    kind: 'beat',
    beatId: String(beat.id),
    licenceOptionId: String(licence.id),
    title: String(beat.title || 'BVS beat'),
    producer,
    licenceName: String(licence.licence_name || licence.licence_code || 'Beat licence'),
    price,
    artwork: publicStorageUrl(beat.artwork_path) || undefined,
    src: publicStorageUrl(beat.preview_path) || undefined,
  }
}
