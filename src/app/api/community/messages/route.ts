import { NextResponse } from 'next/server'
import { communityAccess, communityJson, communityUser } from '@/lib/community-server'
import { editorialUrl, serviceHeaders } from '@/lib/editorial-server'

type MessageRow = {
  id: string
  user_id: string
  body: string
  created_at: string
}

const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 6

export async function GET(request: Request) {
  const user = await communityUser(request)
  if (!user) return NextResponse.json({ error: 'Sign in to join the BVS community.' }, { status: 401 })
  if (!serviceHeaders.apikey) return NextResponse.json({ error: 'Community chat is not configured.' }, { status: 503 })

  const url = new URL(request.url)
  const broadcastKey = (url.searchParams.get('broadcast') || 'bvs-live').trim().slice(0, 80)
  const rows = await communityJson<MessageRow[]>(
    `live_chat_messages?broadcast_key=eq.${encodeURIComponent(broadcastKey)}&status=eq.visible&select=id,user_id,body,created_at&order=created_at.desc&limit=60`,
    [],
  )
  const userIds = [...new Set(rows.map((row) => row.user_id))]
  const profiles = userIds.length
    ? await communityJson<Array<{ id: string; username?: string; display_name?: string; avatar_url?: string }>>(
      `profiles?id=in.(${userIds.join(',')})&select=id,username,display_name,avatar_url`, [],
    ) : []
  const names = new Map(profiles.map((profile) => [profile.id, profile]))
  const access = await communityAccess(user.id)
  return NextResponse.json({
    messages: rows.reverse().map((row) => ({ ...row, profile: names.get(row.user_id) || null })),
    access: { premium: access.premium, staff: access.staff, canPost: access.premium || access.staff },
  })
}

export async function POST(request: Request) {
  const user = await communityUser(request)
  if (!user) return NextResponse.json({ error: 'Sign in to post.' }, { status: 401 })
  if (!serviceHeaders.apikey) return NextResponse.json({ error: 'Community chat is not configured.' }, { status: 503 })
  const access = await communityAccess(user.id)
  if (!access.premium && !access.staff) return NextResponse.json({ error: 'Premium membership is required to post in live chat.' }, { status: 403 })

  const body = await request.json().catch(() => ({})) as { message?: unknown; broadcast?: unknown }
  const message = typeof body.message === 'string' ? body.message.replace(/\s+/g, ' ').trim().slice(0, 500) : ''
  const broadcastKey = typeof body.broadcast === 'string' ? body.broadcast.trim().slice(0, 80) : 'bvs-live'
  if (!message) return NextResponse.json({ error: 'Write a message first.' }, { status: 400 })

  const since = encodeURIComponent(new Date(Date.now() - WINDOW_MS).toISOString())
  const recent = await communityJson<Array<{ id: string }>>(
    `live_chat_messages?user_id=eq.${user.id}&created_at=gte.${since}&select=id&limit=${MAX_PER_WINDOW}`,
    [],
  )
  if (recent.length >= MAX_PER_WINDOW) return NextResponse.json({ error: 'Chat is moving quickly. Wait a moment before posting again.' }, { status: 429 })

  const response = await fetch(editorialUrl('live_chat_messages'), {
    method: 'POST',
    headers: { ...serviceHeaders, Prefer: 'return=representation' },
    body: JSON.stringify({ user_id: user.id, body: message, broadcast_key: broadcastKey || 'bvs-live' }),
  })
  if (!response.ok) return NextResponse.json({ error: 'Live chat is not ready. Ask an administrator to apply the community migration.' }, { status: 503 })
  const [created] = await response.json()
  return NextResponse.json({ message: { ...created, profile: access.profile } }, { status: 201 })
}
