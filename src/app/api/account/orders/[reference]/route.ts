import { NextResponse } from 'next/server'
import { authUserId, serviceHeaders } from '@/lib/storage-upload'
import { createDownloadToken, resolveProductAsset } from '@/lib/products'

export const runtime = 'nodejs'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

type OrderItem = {
  id?: string
  sourceId?: string
  title?: string
  quantity?: number
  price?: number
  type?: string
  productType?: string
  licence?: string
  licenceCode?: string
  licenceSummary?: string
  licenceTermsVersion?: string
  delivery?: string
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token || !url || !service) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
  const user = await authUserId(url, service, token)
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })

  const reference = (await params).reference.trim().slice(0, 100)
  const response = await fetch(
    `${url}/rest/v1/orders?reference=eq.${encodeURIComponent(reference)}&customer_user_id=eq.${user.id}&select=reference,status,delivery_status,subtotal,tax_amount,tax_rate,tax_country,total,payment_method,items,created_at,updated_at&limit=1`,
    { headers: serviceHeaders(service), cache: 'no-store' },
  )
  const rows = response.ok ? await response.json() : []
  const order = rows[0]
  if (!order) return NextResponse.json({ error: 'Order not found.' }, { status: 404 })

  const items = Array.isArray(order.items) ? order.items as OrderItem[] : []
  const paid = ['paid', 'fulfilled'].includes(String(order.status))
  const downloads = []
  if (paid) {
    for (const item of items) {
      const id = String(item.id || '')
      if (!id) continue
      const asset = await resolveProductAsset(id, item.title)
      if (asset) downloads.push({ itemId: id, title: item.title || 'BVS download', href: `/api/download?token=${createDownloadToken(reference, id)}` })
    }
  }

  return NextResponse.json({
    order: {
      ...order,
      items,
      downloads,
      licenceSummary: items.map((item) => ({
        title: item.title || 'BVS item',
        licence: item.licenceSummary || item.licence || item.delivery || (
          item.type === 'beat' || item.productType === 'beat'
            ? 'Beat licence terms recorded at purchase'
            : item.type === 'service'
              ? 'BVS studio service'
              : 'Personal listening download; no sampling, sync, redistribution or resale rights'
        ),
      })),
    },
  })
}
