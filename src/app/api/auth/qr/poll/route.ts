import { NextResponse } from 'next/server'
import { qrLoginConfigured, restUrl, serviceHeaders, tokenHash } from '@/lib/qr-login-server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  if (!qrLoginConfigured()) {
    return NextResponse.json({ error: 'QR login is temporarily unavailable.' }, { status: 503 })
  }
  const body = await request.json().catch(() => ({}))
  const id = typeof body.pairingId === 'string' ? body.pairingId : ''
  const pollToken = typeof body.pollToken === 'string' ? body.pollToken : ''
  if (!id || !pollToken) return NextResponse.json({ error: 'Invalid login request.' }, { status: 400 })

  const hash = tokenHash(pollToken)
  const lookup = await fetch(
    restUrl(`/rest/v1/qr_login_pairings?id=eq.${encodeURIComponent(id)}&poll_token_hash=eq.${hash}&select=status,expires_at&limit=1`),
    { headers: serviceHeaders(), cache: 'no-store' },
  )
  const rows = lookup.ok ? await lookup.json() : []
  const pairing = Array.isArray(rows) ? rows[0] : null
  if (!pairing || Date.parse(pairing.expires_at) <= Date.now()) {
    return NextResponse.json({ status: 'expired' }, { status: 410 })
  }
  if (pairing.status === 'pending') return NextResponse.json({ status: 'pending' })
  if (pairing.status === 'consumed') return NextResponse.json({ status: 'expired' }, { status: 410 })

  const consume = await fetch(restUrl('/rest/v1/rpc/consume_qr_login_pairing'), {
    method: 'POST',
    headers: serviceHeaders(),
    body: JSON.stringify({ pairing_id: id, supplied_poll_hash: hash }),
    cache: 'no-store',
  })
  const consumed = consume.ok ? await consume.json() : []
  const approved = Array.isArray(consumed) ? consumed[0] : null
  if (!approved?.user_email) return NextResponse.json({ status: 'pending' }, { status: 409 })

  const link = await fetch(restUrl('/auth/v1/admin/generate_link'), {
    method: 'POST',
    headers: serviceHeaders(),
    body: JSON.stringify({ type: 'magiclink', email: approved.user_email }),
    cache: 'no-store',
  })
  const generated = await link.json().catch(() => ({}))
  if (!link.ok || typeof generated.hashed_token !== 'string') {
    console.error('QR magic link generation failed', link.status, generated?.msg || generated?.error || 'unknown')
    // Let the same computer retry if the auth provider had a transient failure.
    await fetch(restUrl(`/rest/v1/qr_login_pairings?id=eq.${encodeURIComponent(id)}&status=eq.consumed`), {
      method: 'PATCH',
      headers: serviceHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify({ status: 'approved', consumed_at: null }),
      cache: 'no-store',
    }).catch(() => null)
    return NextResponse.json({ error: 'Could not complete QR login.' }, { status: 503 })
  }

  return NextResponse.json(
    { status: 'approved', tokenHash: generated.hashed_token, type: 'magiclink' },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
