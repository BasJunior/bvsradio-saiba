import { NextResponse } from 'next/server'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const serviceHeaders = {
  apikey: service,
  Authorization: `Bearer ${service}`,
  'Content-Type': 'application/json',
}

async function accountUser(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token || !url || !anon || !service) return null
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anon, Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!response.ok) return null
  return response.json() as Promise<{ id: string; email?: string; created_at?: string }>
}

export async function GET(request: Request) {
  const user = await accountUser(request)
  if (!user) return NextResponse.json({ error: 'Sign in to open Account Centre.' }, { status: 401 })

  const [profileResponse, ordersResponse] = await Promise.all([
    fetch(
      `${url}/rest/v1/profiles?id=eq.${user.id}&select=id,username,display_name,avatar_url,bio,role,is_verified,is_published,created_at&limit=1`,
      { headers: serviceHeaders, cache: 'no-store' },
    ),
    fetch(
      `${url}/rest/v1/orders?customer_user_id=eq.${user.id}&select=reference,status,delivery_status,total,payment_method,items,created_at&order=created_at.desc&limit=30`,
      { headers: serviceHeaders, cache: 'no-store' },
    ),
  ])
  const profiles = profileResponse.ok ? await profileResponse.json() : []
  const orders = ordersResponse.ok ? await ordersResponse.json() : []
  return NextResponse.json({
    user: { email: user.email || '', createdAt: user.created_at || null },
    profile: profiles[0] || null,
    orders,
  })
}

export async function PATCH(request: Request) {
  const user = await accountUser(request)
  if (!user) return NextResponse.json({ error: 'Sign in to update your account.' }, { status: 401 })
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const username = String(body.username || '').trim().toLowerCase().slice(0, 50)
  const displayName = String(body.displayName || '').trim().slice(0, 100)
  const bio = String(body.bio || '').trim().slice(0, 1000)
  const avatarUrl = String(body.avatarUrl || '').trim().slice(0, 500)

  if (!/^[a-z0-9][a-z0-9._-]{2,49}$/.test(username)) {
    return NextResponse.json(
      { error: 'Username must be 3–50 characters using letters, numbers, dots, dashes or underscores.' },
      { status: 400 },
    )
  }
  if (!displayName) return NextResponse.json({ error: 'Display name is required.' }, { status: 400 })

  const response = await fetch(`${url}/rest/v1/profiles?id=eq.${user.id}`, {
    method: 'PATCH',
    headers: { ...serviceHeaders, Prefer: 'return=representation' },
    body: JSON.stringify({
      username,
      display_name: displayName,
      bio,
      avatar_url: avatarUrl || '/assets/images/default-avatar.png',
      updated_at: new Date().toISOString(),
    }),
  })
  const data = await response.json().catch(() => [])
  if (!response.ok) {
    const duplicate = String(data?.message || '').toLowerCase().includes('duplicate')
    return NextResponse.json(
      { error: duplicate ? 'That username is already taken.' : 'Could not update your profile.' },
      { status: duplicate ? 409 : 500 },
    )
  }
  return NextResponse.json({ profile: data[0] || null })
}
