import { NextResponse } from 'next/server'
import { communityUser } from '@/lib/community-server'
import { editorialUrl, serviceHeaders } from '@/lib/editorial-server'

const reasons = new Set(['spam', 'harassment', 'hate', 'unsafe', 'other'])

export async function POST(request: Request) {
  const user = await communityUser(request)
  if (!user) return NextResponse.json({ error: 'Sign in to report a message.' }, { status: 401 })
  if (!serviceHeaders.apikey) return NextResponse.json({ error: 'Reporting is not configured.' }, { status: 503 })
  const body = await request.json().catch(() => ({})) as { messageId?: unknown; reason?: unknown; details?: unknown }
  const messageId = typeof body.messageId === 'string' ? body.messageId : ''
  const reason = typeof body.reason === 'string' && reasons.has(body.reason) ? body.reason : 'other'
  const details = typeof body.details === 'string' ? body.details.trim().slice(0, 500) : null
  if (!/^[0-9a-f-]{36}$/i.test(messageId)) return NextResponse.json({ error: 'Invalid message.' }, { status: 400 })

  const response = await fetch(editorialUrl('community_reports?on_conflict=reporter_id,message_id'), {
    method: 'POST',
    headers: { ...serviceHeaders, Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify({ reporter_id: user.id, message_id: messageId, reason, details: details || null }),
  })
  if (!response.ok) return NextResponse.json({ error: 'Could not submit this report.' }, { status: 503 })
  return NextResponse.json({ ok: true })
}
