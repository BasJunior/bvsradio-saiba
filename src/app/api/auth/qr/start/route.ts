import { NextResponse } from 'next/server'
import {
  pairingId,
  qrLoginConfigured,
  QR_LOGIN_TTL_MS,
  restUrl,
  serviceHeaders,
  token,
  tokenHash,
} from '@/lib/qr-login-server'

export const dynamic = 'force-dynamic'

function safeNextPath(value: unknown) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : '/'
}

export async function POST(request: Request) {
  if (!qrLoginConfigured()) {
    return NextResponse.json({ error: 'QR login is temporarily unavailable.' }, { status: 503 })
  }

  const body = await request.json().catch(() => ({}))
  const next = safeNextPath(body.next)
  const id = pairingId()
  const pollToken = token()
  const approvalToken = token()
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const fingerprint = tokenHash(`${forwardedFor}:${request.headers.get('user-agent') || ''}`).slice(0, 32)
  const expiresAt = new Date(Date.now() + QR_LOGIN_TTL_MS).toISOString()

  const create = await fetch(restUrl('/rest/v1/qr_login_pairings'), {
    method: 'POST',
    headers: serviceHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify({
      id,
      poll_token_hash: tokenHash(pollToken),
      approval_token_hash: tokenHash(approvalToken),
      requester_fingerprint: fingerprint,
      expires_at: expiresAt,
    }),
    cache: 'no-store',
  })

  if (!create.ok) {
    console.error('QR pairing create failed', create.status, await create.text())
    return NextResponse.json({ error: 'Could not create a secure login code.' }, { status: 503 })
  }

  const origin = new URL(request.url).origin
  const params = new URLSearchParams({ pairing: id, token: approvalToken, next })
  return NextResponse.json(
    {
      pairingId: id,
      pollToken,
      qrUrl: `${origin}/auth/qr/approve?${params.toString()}`,
      expiresAt,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

