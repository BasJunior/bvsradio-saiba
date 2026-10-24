import { NextResponse } from 'next/server'
import { audit, can, editorialIdentity } from '@/lib/editorial-server'
import {
  payoutConfigured,
  payoutGet,
  payoutRpc,
  publicPayoutMethod,
  publicPayoutRequest,
} from '@/lib/artist-payouts'

async function loadQueue() {
  const requests = await payoutGet<Array<Record<string, unknown>>>(
    'artist_payout_requests?select=*&order=requested_at.desc&limit=250',
    [],
  )
  const artistIds = [...new Set(requests.map((row) => String(row.artist_user_id || '')).filter(Boolean))]
  const methodIds = [...new Set(requests.map((row) => String(row.payout_method_id || '')).filter(Boolean))]

  const [profiles, methods] = await Promise.all([
    artistIds.length
      ? payoutGet<Array<Record<string, unknown>>>(
        `profiles?id=in.(${artistIds.map(encodeURIComponent).join(',')})&select=id,username,display_name`,
        [],
      )
      : Promise.resolve([]),
    methodIds.length
      ? payoutGet<Array<Record<string, unknown>>>(
        `artist_payout_methods?id=in.(${methodIds.map(encodeURIComponent).join(',')})&select=id,method_type,label,currency,account_holder_name,destination_summary,is_default,status,created_at`,
        [],
      )
      : Promise.resolve([]),
  ])

  const profileById = new Map(profiles.map((row) => [String(row.id), row]))
  const methodById = new Map(methods.map((row) => [String(row.id), row]))

  return requests.map((row) => {
    const artistId = String(row.artist_user_id || '')
    const methodId = String(row.payout_method_id || '')
    const profile = profileById.get(artistId)
    const method = methodById.get(methodId)
    return {
      ...publicPayoutRequest(row),
      artistUserId: artistId,
      artist: {
        displayName: profile?.display_name ? String(profile.display_name) : null,
        username: profile?.username ? String(profile.username) : null,
      },
      method: method ? publicPayoutMethod(method) : null,
    }
  })
}

export async function GET(request: Request) {
  if (!payoutConfigured()) return NextResponse.json({ error: 'Payout service is not configured.' }, { status: 503 })
  const identity = await editorialIdentity(request)
  if (!identity) return NextResponse.json({ error: 'Editorial sign-in required.' }, { status: 401 })
  if (!can(identity, 'manage_artist_wallet')) return NextResponse.json({ error: 'Wallet permission required.' }, { status: 403 })

  return NextResponse.json({
    queue: await loadQueue(),
    role: identity.role,
  })
}

export async function POST(request: Request) {
  if (!payoutConfigured()) return NextResponse.json({ error: 'Payout service is not configured.' }, { status: 503 })
  const identity = await editorialIdentity(request)
  if (!identity) return NextResponse.json({ error: 'Editorial sign-in required.' }, { status: 401 })
  if (!can(identity, 'manage_artist_wallet')) return NextResponse.json({ error: 'Wallet permission required.' }, { status: 403 })

  const body = (await request.json().catch(() => ({}))) as {
    requestId?: string
    status?: string
    staffNote?: string
    payoutReference?: string
  }
  const requestId = String(body.requestId || '').trim()
  const status = String(body.status || '').trim()
  if (!requestId || !['approved', 'processing', 'rejected', 'paid'].includes(status)) {
    return NextResponse.json({ error: 'Choose a valid payout action.' }, { status: 400 })
  }

  const result = await payoutRpc<Record<string, unknown>>('transition_artist_payout', {
    p_actor_id: identity.user.id,
    p_request_id: requestId,
    p_status: status,
    p_staff_note: String(body.staffNote || '').trim().slice(0, 1000) || null,
    p_payout_reference: String(body.payoutReference || '').trim().slice(0, 200) || null,
  })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status >= 500 ? 503 : 409 })

  await audit(identity.user.id, `payout_${status}`, 'artist_payout_request', requestId, {
    payoutReference: status === 'paid' ? String(body.payoutReference || '').trim().slice(0, 200) : undefined,
  })

  return NextResponse.json({
    ok: true,
    request: publicPayoutRequest(result.data),
    queue: await loadQueue(),
  })
}
