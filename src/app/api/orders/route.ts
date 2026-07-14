import { NextResponse } from 'next/server'

interface OrderItem {
  id: string | number
  title: string
  artist?: string
  type: string
  price: number
  quantity: number
  delivery?: string
  sourceUrl?: string
}

interface Customer {
  name: string
  email: string
  whatsapp?: string
}

interface OrderRequest {
  customer: Customer
  items: OrderItem[]
  paymentMethod: string
  projectNotes?: string
  subtotal: number
  total: number
}

function orderReference() {
  return `BVS-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random()
    .toString(36)
    .slice(2, 7)
    .toUpperCase()}`
}

function isOrderItem(item: unknown): item is OrderItem {
  if (!item || typeof item !== 'object') {
    return false
  }

  const candidate = item as Partial<OrderItem>
  return (
    candidate.id !== undefined &&
    typeof candidate.title === 'string' &&
    typeof candidate.type === 'string' &&
    typeof candidate.price === 'number' &&
    typeof candidate.quantity === 'number'
  )
}

function isOrderRequest(payload: unknown): payload is OrderRequest {
  if (!payload || typeof payload !== 'object') {
    return false
  }

  const candidate = payload as Partial<OrderRequest>

  return (
    !!candidate.customer &&
    typeof candidate.customer.name === 'string' &&
    typeof candidate.customer.email === 'string' &&
    Array.isArray(candidate.items) &&
    candidate.items.every(isOrderItem) &&
    typeof candidate.paymentMethod === 'string' &&
    typeof candidate.subtotal === 'number' &&
    typeof candidate.total === 'number'
  )
}

async function saveOrderToSupabase(order: OrderRequest, reference: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    return { saved: false, reason: 'Supabase order environment is not configured yet.' }
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      reference,
      customer_name: order.customer.name,
      customer_email: order.customer.email,
      customer_whatsapp: order.customer.whatsapp || null,
      payment_method: order.paymentMethod,
      project_notes: order.projectNotes || null,
      items: order.items,
      subtotal: order.subtotal,
      total: order.total,
      status: 'pending_payment',
      delivery_status: 'awaiting_payment',
    }),
  })

  if (!response.ok) {
    return { saved: false, reason: await response.text() }
  }

  const rows = await response.json()
  return { saved: true, order: Array.isArray(rows) ? rows[0] : rows }
}

export async function POST(req: Request) {
  try {
    const payload: unknown = await req.json()

    if (!isOrderRequest(payload)) {
      return NextResponse.json({ error: 'Invalid order payload.' }, { status: 400 })
    }

    if (payload.items.length === 0) {
      return NextResponse.json({ error: 'Add at least one item before checkout.' }, { status: 400 })
    }

    const reference = orderReference()
    const persistence = await saveOrderToSupabase(payload, reference)

    return NextResponse.json({
      reference,
      status: 'pending_payment',
      saved: persistence.saved,
      persistenceMessage: persistence.saved
        ? 'Order saved to Supabase.'
        : `Order reference created. ${persistence.reason}`,
      nextSteps: [
        'BVS will confirm payment details for the selected method.',
        'Send payment proof with the order reference.',
        'Downloads or service work start after payment is confirmed.',
      ],
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Order creation failed.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
