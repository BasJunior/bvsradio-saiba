import { NextResponse } from 'next/server'
import {
  authenticatedUser,
  qrLoginConfigured,
  restUrl,
  safeHashMatch,
  serviceHeaders,
} from '@/lib/qr-login-server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  if (!qrLoginConfigured()) {
    return NextResponse.json({ error: 'QR login is temporarily unavailable.' }, { status: 503 })
  }

  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || ''
  const user = await authenticatedUser(bearer)
  if (!user) return NextResponse.json({ error: 'Sign in on this phone first.' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const id = typeof body.pairingId === 'string' ? body.pairingId : ''
  const approvalToken = typeof body.approvalToken === 'string' ? body.approvalToken : ''
  if (!id || !approvalToken) return NextResponse.json({ error: 'Invalid login request.' }, { status: 400 })

  const lookup = await fetch(
    restUrl(`/rest/v1/qr_login_pairings?id=eq.${encodeURIComponent(id)}&select=approval_token_hash,status,expires_at&limit=1`),
    { headers: serviceHeaders(), cache: 'no-store' },
  )
  const rows = lookup.ok ? await lookup.json() : []
  const pairing = Array.isArray(rows) ? rows[0] : null
  if (
    !pairing ||
    pairing.status !== 'pending' ||
    Date.parse(pairing.expires_at) <= Date.now() ||
    !safeHashMatch(approvalToken, pairing.approval_token_hash)
  ) {
    return NextResponse.json({ error: 'This QR code is invalid or has expired.' }, { status: 410 })
  }

  const approve = await fetch(restUrl(`/rest/v1/qr_login_pairings?id=eq.${encodeURIComponent(id)}&status=eq.pending`), {
    method: 'PATCH',
    headers: serviceHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify({
      status: 'approved',
      user_id: user.id,
      user_email: user.email,
      approved_at: new Date().toISOString(),
    }),
    cache: 'no-store',
  })
  if (!approve.ok) {
    console.error('QR pairing approval failed', approve.status, await approve.text())
    return NextResponse.json({ error: 'Could not approve this computer.' }, { status: 503 })
  }

  return NextResponse.json({ approved: true }, { headers: { 'Cache-Control': 'no-store' } })
}

