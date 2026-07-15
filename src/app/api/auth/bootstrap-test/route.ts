import { NextResponse } from 'next/server'

/**
 * One-shot helper to create/confirm a known test account.
 * Protected by BVS_BOOTSTRAP_SECRET (or falls back to a fixed challenge only if secret set).
 * Remove after auth is verified.
 */
export async function POST(req: Request) {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  const SECRET = process.env.BVS_BOOTSTRAP_SECRET || ''

  if (!SUPABASE_URL || !SERVICE) {
    return NextResponse.json({ error: 'Supabase service not configured on server' }, { status: 503 })
  }

  const body = await req.json().catch(() => ({}))
  const provided = String(body.secret || req.headers.get('x-bvs-bootstrap') || '')
  if (!SECRET || provided !== SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const email = String(body.email || 'abiaschivayo3+bvstest@gmail.com').trim().toLowerCase()
  const password = String(body.password || 'BvsTestLogin1!')
  const username = String(body.username || 'bvstest').trim()

  // List users by email
  const listRes = await fetch(
    `${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=200`,
    { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } },
  )
  const listData = await listRes.json()
  const users = listData.users || listData || []
  let user = Array.isArray(users)
    ? users.find((u: { email?: string }) => (u.email || '').toLowerCase() === email)
    : null

  if (!user) {
    const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SERVICE,
        Authorization: `Bearer ${SERVICE}`,
      },
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { username, full_name: 'BVS Test User', role: 'artist' },
      }),
    })
    const created = await createRes.json()
    if (!createRes.ok) {
      return NextResponse.json({ error: created.msg || created.message || 'create failed', created }, { status: 400 })
    }
    user = created
  } else {
    // Confirm + reset password
    const updRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        apikey: SERVICE,
        Authorization: `Bearer ${SERVICE}`,
      },
      body: JSON.stringify({
        email_confirm: true,
        password,
        user_metadata: {
          ...(user.user_metadata || {}),
          username,
          full_name: user.user_metadata?.full_name || 'BVS Test User',
          role: 'artist',
        },
      }),
    })
    const updated = await updRes.json()
    if (!updRes.ok) {
      return NextResponse.json({ error: updated.msg || updated.message || 'update failed', updated }, { status: 400 })
    }
    user = updated
  }

  // Upsert profile for username login
  const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?on_conflict=id`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SERVICE,
      Authorization: `Bearer ${SERVICE}`,
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify({
      id: user.id,
      username,
      display_name: 'BVS Test User',
      role: 'artist',
      avatar_url: '/assets/images/default-avatar.png',
    }),
  })
  const profileText = await profileRes.text()

  // Verify password grant
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  const loginRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anon,
      Authorization: `Bearer ${anon}`,
    },
    body: JSON.stringify({ email, password }),
  })
  const loginData = await loginRes.json()

  return NextResponse.json({
    ok: loginRes.ok,
    email,
    username,
    user_id: user.id,
    email_confirmed: Boolean(user.email_confirmed_at || loginRes.ok),
    profile_status: profileRes.status,
    profile: profileText.slice(0, 200),
    login_ok: loginRes.ok,
    login_error: loginRes.ok ? null : loginData.error_code || loginData.msg || loginData.error,
  })
}
