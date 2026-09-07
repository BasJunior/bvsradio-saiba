import { NextResponse } from 'next/server'
import { authUserId, serviceHeaders } from '@/lib/storage-upload'
import { creatorPublicName } from '@/lib/public-name'
import { publicStorageUrl } from '@/lib/beatstore-server'
import { r2KeyFromMediaUrl, safeR2Key, signedR2DownloadUrl } from '@/lib/r2-storage'

export const runtime = 'nodejs'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

type LicenceRow = {
  id: string
  licence_code?: string | null
  licence_name?: string | null
  price_usd?: number | string | null
  currency?: string | null
  included_files?: string[] | null
  terms_summary?: string | null
  terms_version?: string | null
  is_active?: boolean | null
  is_sold_out?: boolean | null
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
  master_path?: string | null
  is_public?: boolean | null
  status?: string | null
  beat_licence_options?: LicenceRow[] | null
}

type OrderItem = {
  id?: string
  sourceId?: string
  type?: string
  productType?: string
  title?: string
  artist?: string
  licenceCode?: string
  licenceSummary?: string
}

type OrderRow = {
  id: string
  reference: string
  status: string
  items?: OrderItem[] | null
  created_at?: string | null
}

type WorkspaceRow = {
  id: string
  order_id: string
  beat_id: string
  song_title?: string | null
}

async function rows<T>(path: string): Promise<T[]> {
  if (!url || !service) return []
  const response = await fetch(`${url}/rest/v1/${path}`, {
    headers: serviceHeaders(service),
    cache: 'no-store',
  })
  if (!response.ok) return []
  const data = await response.json().catch(() => [])
  return Array.isArray(data) ? data as T[] : []
}

function itemBeatId(item: OrderItem) {
  return String(item.sourceId || item.id || '')
}

function isBeatItem(item: OrderItem) {
  return item.type === 'beat' || item.productType === 'beat'
}

async function signedOwnedAudio(value?: string | null) {
  if (!value) return null
  const key = r2KeyFromMediaUrl(value) || (safeR2Key(value) && !/^https?:/i.test(value) ? value : null)
  return key ? signedR2DownloadUrl(key, 1200) : value
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = String((await params).id || '').trim()
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'Beat not found.' }, { status: 404 })
  }
  if (!url || !service) {
    return NextResponse.json({ error: 'BeatStore is unavailable.' }, { status: 503 })
  }

  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() || ''
  const user = token ? await authUserId(url, service, token) : null

  let entitlement: null | {
    orderId: string
    orderReference: string
    licenceCode: string
    licenceSummary: string
    workspaceId: string | null
    songTitle: string | null
  } = null

  if (user?.id) {
    const orders = await rows<OrderRow>(
      `orders?customer_user_id=eq.${encodeURIComponent(user.id)}&status=in.(paid,fulfilled)&select=id,reference,status,items,created_at&order=created_at.desc&limit=100`,
    )
    for (const order of orders) {
      const item = (Array.isArray(order.items) ? order.items : []).find(candidate => isBeatItem(candidate) && itemBeatId(candidate) === id)
      if (!item) continue
      const workspace = (await rows<WorkspaceRow>(
        `song_workspaces?user_id=eq.${encodeURIComponent(user.id)}&order_id=eq.${encodeURIComponent(order.id)}&beat_id=eq.${encodeURIComponent(id)}&select=id,order_id,beat_id,song_title&order=updated_at.desc&limit=1`,
      ))[0]
      entitlement = {
        orderId: order.id,
        orderReference: order.reference,
        licenceCode: item.licenceCode || 'standard_lease',
        licenceSummary: item.licenceSummary || 'BVS beat licence recorded at purchase',
        workspaceId: workspace?.id || null,
        songTitle: workspace?.song_title || null,
      }
      break
    }
  }

  const visibility = entitlement ? '' : '&is_public=eq.true&status=eq.published'
  const beat = (await rows<BeatRow>(
    `beats?id=eq.${encodeURIComponent(id)}${visibility}&select=id,title,description,genre,mood,bpm,musical_key,producer_user_id,artwork_path,preview_path,master_path,is_public,status,beat_licence_options(id,licence_code,licence_name,price_usd,currency,included_files,terms_summary,terms_version,is_active,is_sold_out)&limit=1`,
  ))[0]
  if (!beat) return NextResponse.json({ error: 'Beat not found.' }, { status: 404 })

  const profile = (await rows<{ username?: string; creator_public_name?: string; creator_name_status?: string }>(
    `profiles?id=eq.${encodeURIComponent(beat.producer_user_id)}&select=username,creator_public_name,creator_name_status&limit=1`,
  ))[0]
  const producer = creatorPublicName({
    publicName: profile?.creator_public_name,
    publicNameStatus: profile?.creator_name_status,
    username: profile?.username,
  }) || 'BVS producer'

  const licences = (Array.isArray(beat.beat_licence_options) ? beat.beat_licence_options : [])
    .filter(option => option.is_active !== false && !option.is_sold_out)
    .map(option => ({
      id: option.id,
      code: option.licence_code || 'standard_lease',
      name: option.licence_name || 'Beat licence',
      price: Number(option.price_usd || 0),
      currency: option.currency || 'USD',
      includedFiles: Array.isArray(option.included_files) ? option.included_files : [],
      summary: option.terms_summary || null,
      termsVersion: option.terms_version || null,
    }))
  const prices = licences.map(option => option.price).filter(value => Number.isFinite(value) && value > 0)

  return NextResponse.json({
    beat: {
      id: beat.id,
      title: beat.title,
      description: beat.description || null,
      genre: beat.genre || null,
      mood: beat.mood || null,
      bpm: beat.bpm ?? null,
      musicalKey: beat.musical_key || null,
      producer,
      artworkUrl: publicStorageUrl(beat.artwork_path),
      previewUrl: publicStorageUrl(beat.preview_path),
      startingPrice: prices.length ? Math.min(...prices) : null,
      licences,
    },
    entitlement: entitlement ? {
      owned: true,
      orderReference: entitlement.orderReference,
      licenceCode: entitlement.licenceCode,
      licenceSummary: entitlement.licenceSummary,
      workspaceId: entitlement.workspaceId,
      songTitle: entitlement.songTitle,
      fullAudioUrl: await signedOwnedAudio(beat.master_path || beat.preview_path),
    } : null,
  }, {
    headers: { 'Cache-Control': 'private, no-store' },
  })
}
