import { NextResponse } from 'next/server'
import { creatorHeaders, creatorIdentity, creatorJson, creatorUrl } from '@/lib/creator-server'

const clean = (value: unknown, max = 5000) => String(value || '').trim().slice(0, max)
const requestTypes = new Set([
  'takedown',
  'metadata_correction',
  'artwork_replacement',
  'rights_update',
  'payout_question',
  'other',
])

export async function POST(request: Request) {
  const identity = await creatorIdentity(request)
  if (!identity) return NextResponse.json({ error: 'Sign in to request a release correction.' }, { status: 401 })
  if (!identity.profile || !['artist', 'admin'].includes(identity.profile.role)) {
    return NextResponse.json({ error: 'Artist access required.' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const releaseId = clean(body.releaseId, 80)
  const requestType = clean(body.requestType, 40)
  const message = clean(body.message, 3000)
  if (!releaseId || !requestTypes.has(requestType)) {
    return NextResponse.json({ error: 'Choose a valid release request.' }, { status: 400 })
  }
  if (message.length < 10) {
    return NextResponse.json({ error: 'Add a short note for the editorial team.' }, { status: 400 })
  }

  const userId = identity.user.id
  const owned = await creatorJson(await fetch(
    creatorUrl(`releases?id=eq.${encodeURIComponent(releaseId)}&user_id=eq.${userId}&select=id,title&limit=1`),
    { headers: creatorHeaders, cache: 'no-store' },
  ))
  if (!owned[0]) {
    return NextResponse.json({ error: 'You can request changes only for your own releases.' }, { status: 403 })
  }

  try {
    const data = await creatorJson(await fetch(creatorUrl('track_review_requests'), {
      method: 'POST',
      headers: { ...creatorHeaders, Prefer: 'return=representation' },
      body: JSON.stringify({
        track_id: null,
        release_id: releaseId,
        artist_user_id: userId,
        request_type: requestType,
        message,
        status: 'open',
      }),
    }))
    return NextResponse.json({ item: data[0] })
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Release correction request failed.'
    if (/release_id|track_review_requests_exactly_one_target|column/i.test(detail)) {
      return NextResponse.json({ error: 'Release correction support is not ready yet. Please try again after the Studio update completes.' }, { status: 503 })
    }
    return NextResponse.json({ error: detail }, { status: 500 })
  }
}
