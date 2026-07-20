import { NextResponse } from 'next/server'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

function ownerEmails(): Set<string> {
  const fromEnv = [process.env.BVS_OWNER_EMAILS || '', process.env.BVS_ORDER_EMAIL || '']
    .join(',')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  const known = ['abiaschivago@gmail.com', 'abiaschivayo3@gmail.com']
  return new Set([...fromEnv, ...known])
}

export async function GET(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token || !url || !anon || !service) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }
  const userResponse = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anon, Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!userResponse.ok) return NextResponse.json({ authenticated: false }, { status: 401 })
  const user = (await userResponse.json()) as { id: string; email?: string }
  const adminHeaders = { apikey: service, Authorization: `Bearer ${service}` }
  const [profileResponse, staffResponse] = await Promise.all([
    fetch(`${url}/rest/v1/profiles?id=eq.${user.id}&select=role`, {
      headers: adminHeaders,
      cache: 'no-store',
    }),
    fetch(
      `${url}/rest/v1/editorial_staff?user_id=eq.${user.id}&active=eq.true&select=role`,
      { headers: adminHeaders, cache: 'no-store' },
    ),
  ])
  const profiles = profileResponse.ok ? await profileResponse.json() : []
  const staff = staffResponse.ok ? await staffResponse.json() : []
  const profileRole = String(profiles[0]?.role || 'listener')
  const staffRole = staff[0]?.role ? String(staff[0].role) : null
  const email = (user.email || '').toLowerCase().trim()
  const isOwner = email && ownerEmails().has(email)
  const isAdmin = staffRole === 'administrator' || profileRole === 'admin' || Boolean(isOwner)
  const isEditorial =
    Boolean(staffRole) || ['editor', 'admin', 'moderator'].includes(profileRole) || Boolean(isOwner)
  return NextResponse.json({
    authenticated: true,
    email: user.email,
    profileRole,
    staffRole,
    access: {
      listener: true,
      artist: profileRole === 'artist' || isAdmin,
      writer: profileRole === 'writer' || isEditorial,
      showCreator: profileRole === 'show_creator' || isEditorial,
      editorial: isEditorial,
      admin: isAdmin,
    },
  })
}
