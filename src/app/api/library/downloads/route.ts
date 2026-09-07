import { NextResponse } from 'next/server'
import { authUserId, serviceHeaders } from '@/lib/storage-upload'
import { createDownloadToken, resolveProductAsset } from '@/lib/products'

export const runtime = 'nodejs'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

type OrderItem = {
  id?: string
  title?: string
}

type OrderRow = {
  reference: string
  status: string
  created_at: string
  items?: OrderItem[]
}

export async function GET(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token || !url || !service) {
    return NextResponse.json({ error: 'Sign in to see downloads.' }, { status: 401 })
  }

  const user = await authUserId(url, service, token)
  if (!user) return NextResponse.json({ error: 'Sign in to see downloads.' }, { status: 401 })

  const response = await fetch(
    `${url}/rest/v1/orders?customer_user_id=eq.${user.id}&status=in.(paid,fulfilled)&select=reference,status,items,created_at&order=created_at.desc&limit=30`,
    { headers: serviceHeaders(service), cache: 'no-store' },
  )
  if (!response.ok) {
    return NextResponse.json({ error: 'Could not load downloads.' }, { status: 502 })
  }

  const orders = (await response.json()) as OrderRow[]
  const candidates = orders.flatMap((order) => {
    const items = Array.isArray(order.items) ? order.items : []
    return items
      .filter((item) => Boolean(item.id))
      .map((item) => ({
        reference: order.reference,
        createdAt: order.created_at,
        itemId: String(item.id),
        title: String(item.title || 'BVS download'),
      }))
  })

  const resolved = await Promise.all(
    candidates.map(async (candidate) => {
      const asset = await resolveProductAsset(candidate.itemId, candidate.title)
      if (!asset) return null
      return {
        ...candidate,
        href: `/api/download?token=${createDownloadToken(candidate.reference, candidate.itemId)}`,
        orderHref: `/account/orders/${encodeURIComponent(candidate.reference)}`,
      }
    }),
  )

  return NextResponse.json({ downloads: resolved.filter(Boolean) })
}
