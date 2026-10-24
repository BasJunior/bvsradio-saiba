import { NextResponse } from 'next/server'
import {
  artistPayoutSnapshot,
  payoutConfigured,
  payoutGet,
  payoutPatch,
  payoutPost,
  payoutUser,
} from '@/lib/artist-payouts'

const USER_METHODS = new Set(['paypal', 'mobile_money', 'paynow', 'other'])

export async function GET(request: Request) {
  if (!payoutConfigured()) return NextResponse.json({ error: 'Payout service is not configured.' }, { status: 503 })
  const user = await payoutUser(request)
  if (!user) return NextResponse.json({ error: 'Sign in to manage payout methods.' }, { status: 401 })
  const snapshot = await artistPayoutSnapshot(user.id)
  return NextResponse.json({ methods: snapshot.methods })
}

export async function POST(request: Request) {
  if (!payoutConfigured()) return NextResponse.json({ error: 'Payout service is not configured.' }, { status: 503 })
  const user = await payoutUser(request)
  if (!user) return NextResponse.json({ error: 'Sign in to add a payout method.' }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as {
    methodType?: string
    label?: string
    destination?: string
    accountHolderName?: string
    currency?: string
    makeDefault?: boolean
  }
  const methodType = String(body.methodType || '').trim().toLowerCase()
  if (!USER_METHODS.has(methodType)) {
    return NextResponse.json({ error: 'Choose PayPal, mobile money, Paynow, or another staff-assisted payout method.' }, { status: 400 })
  }
  const label = String(body.label || '').trim().slice(0, 120)
  const destination = String(body.destination || '').trim().slice(0, 200)
  const accountHolderName = String(body.accountHolderName || '').trim().slice(0, 160)
  const currency = String(body.currency || 'USD').trim().toUpperCase().slice(0, 3)
  if (!label || !destination) return NextResponse.json({ error: 'Method label and payout destination are required.' }, { status: 400 })
  if (!/^[A-Z]{3}$/.test(currency)) return NextResponse.json({ error: 'Use a valid three-letter currency code.' }, { status: 400 })

  const existing = await payoutGet<Array<Record<string, unknown>>>(
    `artist_payout_methods?artist_user_id=eq.${encodeURIComponent(user.id)}&status=neq.disabled&select=id,is_default&limit=30`,
    [],
  )
  const makeDefault = body.makeDefault === true || existing.length === 0
  if (makeDefault) {
    await payoutPatch(`artist_payout_methods?artist_user_id=eq.${encodeURIComponent(user.id)}&is_default=eq.true`, { is_default: false })
  }

  const rows = await payoutPost<Array<Record<string, unknown>>>('artist_payout_methods', {
    artist_user_id: user.id,
    method_type: methodType,
    label,
    currency,
    account_holder_name: accountHolderName || null,
    destination_summary: destination,
    details: {},
    is_default: makeDefault,
    status: 'active',
  })
  if (!rows?.[0]) return NextResponse.json({ error: 'Could not save payout method.' }, { status: 500 })

  return NextResponse.json({ ok: true, snapshot: await artistPayoutSnapshot(user.id) })
}

export async function PATCH(request: Request) {
  if (!payoutConfigured()) return NextResponse.json({ error: 'Payout service is not configured.' }, { status: 503 })
  const user = await payoutUser(request)
  if (!user) return NextResponse.json({ error: 'Sign in to manage payout methods.' }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as { methodId?: string; action?: string }
  const methodId = String(body.methodId || '').trim()
  if (!methodId) return NextResponse.json({ error: 'Payout method is required.' }, { status: 400 })

  const path = `artist_payout_methods?id=eq.${encodeURIComponent(methodId)}&artist_user_id=eq.${encodeURIComponent(user.id)}`
  if (body.action === 'default') {
    await payoutPatch(`artist_payout_methods?artist_user_id=eq.${encodeURIComponent(user.id)}&is_default=eq.true`, { is_default: false })
    const updated = await payoutPatch<Array<Record<string, unknown>>>(path, { is_default: true, status: 'active' })
    if (!updated?.[0]) return NextResponse.json({ error: 'Payout method was not found.' }, { status: 404 })
  } else if (body.action === 'disable') {
    const updated = await payoutPatch<Array<Record<string, unknown>>>(path, { is_default: false, status: 'disabled' })
    if (!updated?.[0]) return NextResponse.json({ error: 'Payout method was not found.' }, { status: 404 })
  } else {
    return NextResponse.json({ error: 'Unsupported payout method action.' }, { status: 400 })
  }

  return NextResponse.json({ ok: true, snapshot: await artistPayoutSnapshot(user.id) })
}
