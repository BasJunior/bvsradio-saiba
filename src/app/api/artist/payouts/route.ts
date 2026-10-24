import { NextResponse } from 'next/server'
import {
  artistPayoutSnapshot,
  payoutConfigured,
  payoutRpc,
  payoutUser,
  publicPayoutRequest,
} from '@/lib/artist-payouts'

export async function GET(request: Request) {
  if (!payoutConfigured()) return NextResponse.json({ error: 'Payout service is not configured.' }, { status: 503 })
  const user = await payoutUser(request)
  if (!user) return NextResponse.json({ error: 'Sign in to manage payouts.' }, { status: 401 })
  return NextResponse.json(await artistPayoutSnapshot(user.id))
}

export async function POST(request: Request) {
  if (!payoutConfigured()) return NextResponse.json({ error: 'Payout service is not configured.' }, { status: 503 })
  const user = await payoutUser(request)
  if (!user) return NextResponse.json({ error: 'Sign in to request a payout.' }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as {
    payoutMethodId?: string
    amount?: number | string
    note?: string
  }
  const payoutMethodId = String(body.payoutMethodId || '').trim()
  const amount = Number(body.amount)
  if (!payoutMethodId) return NextResponse.json({ error: 'Choose a payout method.' }, { status: 400 })
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'Enter a valid payout amount.' }, { status: 400 })

  const result = await payoutRpc<Record<string, unknown>>('request_artist_payout', {
    p_artist_user_id: user.id,
    p_payout_method_id: payoutMethodId,
    p_requested_amount: Math.round(amount * 100) / 100,
    p_artist_note: String(body.note || '').trim().slice(0, 1000) || null,
  })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status >= 500 ? 503 : 409 })

  return NextResponse.json({
    ok: true,
    request: publicPayoutRequest(result.data),
    snapshot: await artistPayoutSnapshot(user.id),
  })
}

export async function PATCH(request: Request) {
  if (!payoutConfigured()) return NextResponse.json({ error: 'Payout service is not configured.' }, { status: 503 })
  const user = await payoutUser(request)
  if (!user) return NextResponse.json({ error: 'Sign in to manage payouts.' }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as { requestId?: string; action?: string }
  const requestId = String(body.requestId || '').trim()
  if (!requestId || body.action !== 'cancel') return NextResponse.json({ error: 'Only requested payouts can be cancelled.' }, { status: 400 })

  const result = await payoutRpc<Record<string, unknown>>('cancel_artist_payout', {
    p_artist_user_id: user.id,
    p_request_id: requestId,
  })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status >= 500 ? 503 : 409 })

  return NextResponse.json({
    ok: true,
    request: publicPayoutRequest(result.data),
    snapshot: await artistPayoutSnapshot(user.id),
  })
}
