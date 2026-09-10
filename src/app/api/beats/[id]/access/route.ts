import { NextResponse } from 'next/server'
import { authUserId, serviceHeaders } from '@/lib/storage-upload'
import { r2KeyFromMediaUrl, safeR2Key, signedR2DownloadUrl } from '@/lib/r2-storage'

export const runtime = 'nodejs'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

type OrderItem = {
  id?: string
  sourceId?: string
  type?: string
  productType?: string
  title?: string
  artist?: string
  licenceCode?: string
  licenceSummary?: string
  licenceTermsVersion?: string
}

type OrderRow = {
  id: string
  reference: string
  status: string
  items: OrderItem[]
}

type BeatRow = {
  id: string
  master_path?: string | null
  preview_path?: string | null
}

function itemBeatId(item: OrderItem) {
  return String(item.sourceId || item.id || '')
}

function isBeat(item: OrderItem) {
  return item.type === 'beat' || item.productType === 'beat'
}

async function signedAudio(value?: string | null) {
  if (!value) return null
  const key = r2KeyFromMediaUrl(value) || (safeR2Key(value) && !/^https?:/i.test(value) ? value : null)
  return key ? signedR2DownloadUrl(key, 1800) : value
}

function anonymousAccess() {
  return { member: false, owned: false, fullAudioUrl: null, fullAvailable: false }
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const beatId = String((await params).id || '').trim()
  if (!/^[0-9a-f-]{36}$/i.test(beatId)) return NextResponse.json(anonymousAccess())
  if (!url || !service) return NextResponse.json(anonymousAccess())

  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  if (!token) return NextResponse.json(anonymousAccess())
  const user = await authUserId(url, service, token)
  if (!user?.id) return NextResponse.json(anonymousAccess())

  const headers = serviceHeaders(service)
  const beatResponse = await fetch(
    `${url}/rest/v1/beats?id=eq.${encodeURIComponent(beatId)}&is_public=eq.true&status=eq.published&rights_confirmed=eq.true&select=id,master_path,preview_path&limit=1`,
    { headers, cache: 'no-store' },
  )
  const beatRows = beatResponse.ok ? await beatResponse.json() as BeatRow[] : []
  const beat = beatRows[0]
  if (!beat) return NextResponse.json({ member: true, owned: false, fullAudioUrl: null, fullAvailable: false })

  // Membership unlocks listening only. The public BeatStore API still exposes preview audio only,
  // and purchase/licence entitlements remain a separate server-side check below.
  const fullAudioUrl = await signedAudio(beat.master_path)
  const memberAccess = {
    member: true,
    owned: false,
    fullAudioUrl,
    fullAvailable: Boolean(beat.master_path),
  }

  const ordersResponse = await fetch(
    `${url}/rest/v1/orders?customer_user_id=eq.${encodeURIComponent(user.id)}&status=in.(paid,fulfilled)&select=id,reference,status,items&order=created_at.desc&limit=100`,
    { headers, cache: 'no-store' },
  )
  if (!ordersResponse.ok) return NextResponse.json(memberAccess)
  const orders = await ordersResponse.json() as OrderRow[]

  let order: OrderRow | null = null
  let item: OrderItem | null = null
  for (const candidate of orders) {
    const found = (Array.isArray(candidate.items) ? candidate.items : []).find(
      (entry) => isBeat(entry) && itemBeatId(entry) === beatId,
    )
    if (found) {
      order = candidate
      item = found
      break
    }
  }
  if (!order || !item) return NextResponse.json(memberAccess)

  const workspaceResponse = await fetch(
    `${url}/rest/v1/song_workspaces?user_id=eq.${encodeURIComponent(user.id)}&order_id=eq.${encodeURIComponent(order.id)}&beat_id=eq.${encodeURIComponent(beatId)}&select=id&limit=1`,
    { headers, cache: 'no-store' },
  )
  const workspaceRows = workspaceResponse.ok ? await workspaceResponse.json() as Array<{ id: string }> : []

  return NextResponse.json({
    ...memberAccess,
    owned: true,
    orderReference: order.reference,
    workspaceId: workspaceRows[0]?.id || null,
    licenceCode: item.licenceCode || 'standard_lease',
    licenceSummary: item.licenceSummary || 'BVS beat licence recorded at purchase',
    licenceTermsVersion: item.licenceTermsVersion || null,
  })
}
