import { NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(req: Request) {
  const accessToken = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!accessToken) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` },
  })
  if (!userResponse.ok) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

  const user = await userResponse.json()
  const username = user.user_metadata?.username || user.email?.split('@')[0] || `artist-${user.id.slice(0, 8)}`
  const profileResponse = await fetch(`${SUPABASE_URL}/rest/v1/profiles?on_conflict=id`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({
      id: user.id,
      username,
      display_name: user.user_metadata?.full_name || username,
      role: user.user_metadata?.role || 'artist',
      avatar_url: '/assets/images/default-avatar.png',
    }),
  })

  if (!profileResponse.ok) return NextResponse.json({ error: 'Profile setup failed' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
