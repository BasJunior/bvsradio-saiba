import 'server-only'
import { listPublishedBeats, publicStorageUrl } from '@/lib/beatstore-server'
import { getPublicReleases } from '@/lib/public-releases'
import { mediaUrlForStoredValue } from '@/lib/media-url'
import type { CollectionCard } from '@/lib/catalogue-trending'
import { PRICE_SINGLE_DOWNLOAD } from '@/lib/catalogue-pricing'

export type ShelfAction =
  | { type: 'live-beatstore' }
  | { type: 'filter'; query: string; lane?: 'music' | 'beat' | 'all' }
  | { type: 'pack'; packId: string }
  | { type: 'release'; releaseId: string }
  | { type: 'href'; href: string }

export type CatalogueShelfCard = CollectionCard & {
  id: string
  source: 'live' | 'pack' | 'release' | 'curated'
  itemCount?: number
  action: ShelfAction
}

const LIVE_BEATSTORE_ID = 'live-beatstore'
export const LIVE_BEATSTORE_NAME = 'Live BeatStore'

/** Curated music/stream/sample shelves still useful until fully DB-backed. */
function curatedFallbackShelves(): CatalogueShelfCard[] {
  return [
    {
      id: 'curated-albums',
      name: 'Albums',
      detail: `Full albums + $${PRICE_SINGLE_DOWNLOAD} singles`,
      img: '/images/albums/lord-album.jpg',
      launchedAt: '2026-06-01',
      shelfKind: 'music',
      source: 'curated',
      action: { type: 'filter', query: 'Albums', lane: 'music' },
    },
    {
      id: 'curated-lord',
      name: 'LORD Album',
      detail: `$${PRICE_SINGLE_DOWNLOAD}/song · full album $19`,
      img: '/images/albums/lord-album.jpg',
      launchedAt: '2026-06-15',
      shelfKind: 'music',
      source: 'curated',
      action: { type: 'filter', query: 'LORD Album', lane: 'music' },
    },
    {
      id: 'curated-16bit',
      name: 'Album 16 Bit',
      detail: `$${PRICE_SINGLE_DOWNLOAD}/song · full album $14`,
      img: '/images/albums/album-16-bit.jpg',
      launchedAt: '2026-06-20',
      shelfKind: 'music',
      source: 'curated',
      action: { type: 'filter', query: 'Album 16 Bit', lane: 'music' },
    },
    {
      id: 'curated-straightenin',
      name: 'STRAIGHTENIN',
      detail: 'Stream only · no BVS download sale',
      img: '/images/albums/straightenin.jpg',
      launchedAt: '2025-11-01',
      shelfKind: 'music',
      source: 'curated',
      action: { type: 'filter', query: 'STRAIGHTENIN', lane: 'music' },
    },
    {
      id: 'curated-howling',
      name: 'HOWLING IN THE HILLS 2',
      detail: 'Stream only · no BVS download sale',
      img: '/images/albums/howling-in-the-hills-2.jpg',
      launchedAt: '2025-12-01',
      shelfKind: 'music',
      source: 'curated',
      action: { type: 'filter', query: 'HOWLING IN THE HILLS 2', lane: 'music' },
    },
    {
      id: 'curated-wolf-been-bad',
      name: 'WOLF BEEN BAD',
      detail: 'Stream only · no BVS download sale',
      img: '/images/albums/wolf-been-bad.jpg',
      launchedAt: '2026-01-15',
      shelfKind: 'music',
      source: 'curated',
      action: { type: 'filter', query: 'WOLF BEEN BAD', lane: 'music' },
    },
    {
      id: 'curated-wolf-projects',
      name: 'Wolf Bridges Projects',
      detail: 'Streaming discovery (regulated platforms)',
      img: '/images/albums/straightenin.jpg',
      launchedAt: '2025-11-01',
      shelfKind: 'music',
      source: 'curated',
      action: { type: 'filter', query: 'Wolf Bridges Projects', lane: 'music' },
    },
    {
      id: 'curated-bvs-archive',
      name: 'BVS Archive',
      detail: `$${PRICE_SINGLE_DOWNLOAD} singles / archive downloads`,
      img: '/music/Bvs-3000x3000%202.png',
      launchedAt: '2025-10-01',
      shelfKind: 'music',
      source: 'curated',
      action: { type: 'filter', query: 'BVS Archive', lane: 'music' },
    },
    {
      id: 'curated-june-pack',
      name: 'June Pack',
      detail: 'Sample pack · site listings (not full live crate)',
      img: '/images/music-packs/june-pack.jpg',
      launchedAt: '2026-06-01',
      shelfKind: 'archive-sample',
      source: 'curated',
      action: { type: 'filter', query: 'June Pack', lane: 'all' },
    },
    {
      id: 'curated-may-pack',
      name: 'May Pack',
      detail: 'Sample pack · site listings (not full live crate)',
      img: '/images/music-packs/may-pack-1-2.jpg',
      launchedAt: '2026-05-01',
      shelfKind: 'archive-sample',
      source: 'curated',
      action: { type: 'filter', query: 'May Pack', lane: 'all' },
    },
    {
      id: 'curated-march-pack',
      name: 'March Pack',
      detail: 'Sample pack · site listings (not full live crate)',
      img: '/images/mic-closeup.jpg',
      launchedAt: '2026-03-01',
      shelfKind: 'archive-sample',
      source: 'curated',
      action: { type: 'filter', query: 'March Pack', lane: 'all' },
    },
  ]
}

async function loadPublishedBeatPacks(): Promise<CatalogueShelfCard[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return []

  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Accept: 'application/json',
  }

  const packsRes = await fetch(
    `${url}/rest/v1/beat_packs?is_public=eq.true&status=eq.published&select=id,title,description,genre,artwork_path,created_at,updated_at,producer_user_id&order=updated_at.desc.nullslast&limit=40`,
    { headers, cache: 'no-store' },
  )
  if (!packsRes.ok) return []
  const packs = (await packsRes.json()) as Array<{
    id: string
    title?: string
    description?: string
    genre?: string
    artwork_path?: string | null
    created_at?: string
    updated_at?: string
  }>
  if (!packs.length) return []

  const ids = packs.map((p) => p.id)
  const beatsRes = await fetch(
    `${url}/rest/v1/beats?pack_id=in.(${ids.join(',')})&is_public=eq.true&status=eq.published&select=id,pack_id,artwork_path,published_at`,
    { headers, cache: 'no-store' },
  )
  const beatRows = beatsRes.ok
    ? ((await beatsRes.json()) as Array<{ id: string; pack_id?: string; artwork_path?: string | null }>)
    : []

  return packs
    .map((pack) => {
      const members = beatRows.filter((b) => b.pack_id === pack.id)
      if (!members.length) return null
      const cover =
        publicStorageUrl(pack.artwork_path) ||
        publicStorageUrl(members.find((m) => m.artwork_path)?.artwork_path) ||
        '/images/hero-studio.jpg'
      const count = members.length
      return {
        id: `pack-${pack.id}`,
        name: String(pack.title || 'Beat pack'),
        detail: `${count} published beat${count === 1 ? '' : 's'}${pack.genre ? ` · ${pack.genre}` : ''} · live pack`,
        img: cover,
        launchedAt: pack.updated_at || pack.created_at,
        shelfKind: 'live-beatstore' as const,
        source: 'pack' as const,
        itemCount: count,
        action: { type: 'pack' as const, packId: pack.id },
      }
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
}

async function liveBeatStoreShelf(): Promise<CatalogueShelfCard> {
  const beats = await listPublishedBeats(120)
  const prices: number[] = []
  const producers = new Set<string>()
  let cover = '/images/hero-studio.jpg'
  for (const beat of beats) {
    producers.add(String(beat.producer_user_id || ''))
    if (!cover.startsWith('/api/media') && beat.artwork_path) {
      cover = publicStorageUrl(beat.artwork_path) || cover
    }
    const licencePrices = (beat.beat_licence_options || [])
      .filter((l) => l.is_active !== false && !l.is_sold_out)
      .map((l) => Number(l.price_usd))
      .filter((n) => Number.isFinite(n) && n > 0)
    prices.push(...licencePrices)
  }
  const count = beats.length
  const minPrice = prices.length ? Math.min(...prices) : null
  const producerCount = [...producers].filter(Boolean).length
  const priceBit = minPrice != null ? ` · from $${minPrice}` : ''
  return {
    id: LIVE_BEATSTORE_ID,
    name: LIVE_BEATSTORE_NAME,
    detail: count
      ? `${count} live beat${count === 1 ? '' : 's'} · ${producerCount} producer${producerCount === 1 ? '' : 's'}${priceBit}`
      : 'No published beats yet',
    img: cover,
    launchedAt: new Date().toISOString().slice(0, 10),
    shelfKind: 'live-beatstore',
    source: 'live',
    itemCount: count,
    action: { type: 'live-beatstore' },
  }
}

async function releaseShelves(): Promise<CatalogueShelfCard[]> {
  const releases = await getPublicReleases()
  return releases.slice(0, 24).map((release) => ({
    id: `release-${release.id}`,
    name: release.title,
    detail: `${release.artist} · ${release.tracks.length} track${release.tracks.length === 1 ? '' : 's'} · ${release.releaseType}`,
    img: release.cover || '/assets/images/default-artwork.jpg',
    launchedAt: undefined,
    shelfKind: 'music' as const,
    source: 'release' as const,
    itemCount: release.tracks.length,
    action: { type: 'release' as const, releaseId: release.id },
  }))
}

/**
 * Build catalogue shelf cards from live DB sources + curated fallbacks.
 * Live BeatStore always leads; published packs/releases inject above curated samples.
 */
export async function listCatalogueShelves(): Promise<{
  shelves: CatalogueShelfCard[]
  summary: {
    beatCount: number
    packCount: number
    releaseCount: number
    updatedAt: string
  }
}> {
  const [live, packs, releases] = await Promise.all([
    liveBeatStoreShelf(),
    loadPublishedBeatPacks(),
    releaseShelves(),
  ])

  // Prefer live releases over curated album stubs with the same title.
  const liveReleaseNames = new Set(releases.map((r) => r.name.trim().toLowerCase()))
  const curated = curatedFallbackShelves().filter(
    (card) => !liveReleaseNames.has(card.name.trim().toLowerCase()),
  )

  const shelves = [live, ...packs, ...releases, ...curated]
  return {
    shelves,
    summary: {
      beatCount: live.itemCount || 0,
      packCount: packs.length,
      releaseCount: releases.length,
      updatedAt: new Date().toISOString(),
    },
  }
}

export function mediaCover(value?: string | null) {
  return mediaUrlForStoredValue(value) || undefined
}
