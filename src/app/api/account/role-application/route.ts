import { NextResponse } from 'next/server'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const headers = {
  apikey: service,
  Authorization: `Bearer ${service}`,
  'Content-Type': 'application/json',
}
async function currentUser(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token || !url || !anon || !service) return null
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anon, Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  return response.ok ? response.json() as Promise<{ id: string }> : null
}

export async function GET(request: Request) {
  const user = await currentUser(request)
  if (!user) return NextResponse.json({ error: 'Sign in to view your application.' }, { status: 401 })
  const response = await fetch(
    `${url}/rest/v1/profile_role_applications?user_id=eq.${user.id}&select=*&limit=1`,
    { headers, cache: 'no-store' },
  )
  if (!response.ok) return NextResponse.json({ error: 'Role applications are not ready.' }, { status: 503 })
  const rows = await response.json()
  return NextResponse.json({ application: rows[0] || null })
}

export async function POST(request: Request) {
  const user = await currentUser(request)
  if (!user) return NextResponse.json({ error: 'Sign in to apply for a creator role.' }, { status: 401 })
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const requestedRole = String(body.requestedRole || '')
  const allowed = new Set(['artist', 'producer', 'writer', 'show_creator'])
  if (!allowed.has(requestedRole)) return NextResponse.json({ error: 'Choose a valid creator role.' }, { status: 400 })
  const message = String(body.message || '').trim().slice(0, 2000)
  if (message.length < 20) {
    return NextResponse.json({ error: 'Tell editorial a little about your work (at least 20 characters).' }, { status: 400 })
  }
  const now = new Date().toISOString()
  const response = await fetch(`${url}/rest/v1/profile_role_applications?on_conflict=user_id`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({
      user_id: user.id,
      requested_role: requestedRole,
      status: 'submitted',
      message,
      review_notes: null,
      reviewed_by: null,
      reviewed_at: null,
      updated_at: now,
    }),
  })
  if (!response.ok) return NextResponse.json({ error: 'Could not submit the role application.' }, { status: 503 })
  const rows = await response.json()
  return NextResponse.json({ application: rows[0] })
}
