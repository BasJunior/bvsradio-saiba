import { NextResponse } from 'next/server'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export async function GET(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token || !url || !anon || !service) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
  const userResponse = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anon, Authorization: `Bearer ${token}` }, cache: 'no-store' })
  if (!userResponse.ok) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
  const user = await userResponse.json() as { id: string }
  const headers = { apikey: service, Authorization: `Bearer ${service}` }
  const [profileResponse, staffResponse] = await Promise.all([
    fetch(`${url}/rest/v1/profiles?id=eq.${user.id}&select=role,is_producer&limit=1`, { headers, cache: 'no-store' }),
    fetch(`${url}/rest/v1/editorial_staff?user_id=eq.${user.id}&active=eq.true&select=role&limit=1`, { headers, cache: 'no-store' }),
  ])
  const profile = profileResponse.ok ? (await profileResponse.json())[0] : null
  const staff = staffResponse.ok ? (await staffResponse.json())[0] : null
  const editorial = Boolean(staff) || ['admin', 'editor', 'moderator'].includes(profile?.role)

  if (editorial) {
    const [messages, submissions] = await Promise.all([
      fetch(`${url}/rest/v1/beat_review_messages?author_kind=eq.producer&select=id,beat_id,message,created_at&order=created_at.desc&limit=20`, { headers, cache: 'no-store' }),
      fetch(`${url}/rest/v1/beats?status=in.(submitted,changes_requested)&select=id,title,status,updated_at&order=updated_at.desc&limit=20`, { headers, cache: 'no-store' }),
    ])
    const messageRows = messages.ok ? await messages.json() : []
    const beatRows = submissions.ok ? await submissions.json() : []
    return NextResponse.json({
      destination: '/admin/editorial#ed-beats',
      events: [
        ...messageRows.map((item: { id: string; beat_id: string; message: string; created_at: string }) => ({ id: `message-${item.id}`, title: 'Producer reply', detail: item.message, created_at: item.created_at })),
        ...beatRows.map((item: { id: string; title: string; status: string; updated_at: string }) => ({ id: `beat-${item.id}-${item.status}`, title: item.status === 'submitted' ? 'Beat submitted' : 'Beat needs review', detail: item.title, created_at: item.updated_at })),
      ].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 30),
    })
  }

  const beatsResponse = await fetch(`${url}/rest/v1/beats?producer_user_id=eq.${user.id}&select=id,title,status,updated_at&order=updated_at.desc&limit=50`, { headers, cache: 'no-store' })
  const beats = beatsResponse.ok ? await beatsResponse.json() as Array<{ id: string; title: string; status: string; updated_at: string }> : []
  const ids = beats.map(beat => beat.id)
  const messagesResponse = ids.length
    ? await fetch(`${url}/rest/v1/beat_review_messages?beat_id=in.(${ids.join(',')})&author_kind=eq.editor&select=id,beat_id,message,created_at&order=created_at.desc&limit=30`, { headers, cache: 'no-store' })
    : null
  const messages = messagesResponse?.ok ? await messagesResponse.json() : []
  return NextResponse.json({
    destination: '/creator/studio',
    events: messages.map((item: { id: string; message: string; created_at: string }) => ({ id: `message-${item.id}`, title: 'Editorial message', detail: item.message, created_at: item.created_at })),
  })
}
