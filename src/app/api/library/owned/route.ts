import { NextResponse } from 'next/server'
import { authUserId, serviceHeaders } from '@/lib/storage-upload'

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
  workspaceKind?: string
}

type OrderRow = {
  id: string
  reference: string
  status: string
  items: OrderItem[]
  created_at?: string | null
}

type WorkspaceRow = {
  id: string
  order_id: string
  beat_id: string
  song_title?: string | null
  updated_at?: string | null
}

export async function GET(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  if (!token || !url || !service) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
  const user = await authUserId(url, service, token)
  if (!user?.id) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })

  const headers = serviceHeaders(service)
  const [ordersResponse, workspacesResponse] = await Promise.all([
    fetch(`${url}/rest/v1/orders?customer_user_id=eq.${encodeURIComponent(user.id)}&status=in.(paid,fulfilled)&select=id,reference,status,items,created_at&order=created_at.desc&limit=100`, { headers, cache: 'no-store' }),
    fetch(`${url}/rest/v1/song_workspaces?user_id=eq.${encodeURIComponent(user.id)}&select=id,order_id,beat_id,song_title,updated_at&order=updated_at.desc&limit=100`, { headers, cache: 'no-store' }),
  ])

  if (!ordersResponse.ok) return NextResponse.json({ error: 'Could not load owned purchases.' }, { status: 503 })
  const orders = await ordersResponse.json() as OrderRow[]
  const workspaces = workspacesResponse.ok ? await workspacesResponse.json() as WorkspaceRow[] : []
  const workspaceByKey = new Map(workspaces.map((workspace) => [`${workspace.order_id}:${workspace.beat_id}`, workspace]))

  const beats = orders.flatMap((order) => {
    const items = Array.isArray(order.items) ? order.items : []
    return items
      .filter((item) => (item.type === 'beat' || item.productType === 'beat') && item.workspaceKind !== 'blank' && item.licenceCode !== 'writing_pad_free')
      .map((item) => {
        const beatId = String(item.sourceId || item.id || '')
        if (!/^[0-9a-f-]{36}$/i.test(beatId)) return null
        const workspace = workspaceByKey.get(`${order.id}:${beatId}`)
        return {
          beatId,
          orderReference: order.reference,
          title: item.title || 'Licensed beat',
          producerName: item.artist || 'BVS producer',
          licenceCode: item.licenceCode || 'standard_lease',
          licenceSummary: item.licenceSummary || 'BVS beat licence recorded at purchase',
          purchasedAt: order.created_at || null,
          workspaceId: workspace?.id || null,
          songTitle: workspace?.song_title || null,
          updatedAt: workspace?.updated_at || null,
        }
      })
      .filter(Boolean)
  })

  return NextResponse.json({ beats })
}
