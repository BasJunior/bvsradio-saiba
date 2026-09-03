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
  if (!user) return NextResponse.json({ error: 'Sign in to view your applications.' }, { status: 401 })
  const response = await fetch(
    `${url}/rest/v1/profile_role_applications?user_id=eq.${user.id}&select=*&order=updated_at.desc`,
    { headers, cache: 'no-store' },
  )
  if (!response.ok) return NextResponse.json({ error: 'Role applications are not ready.' }, { status: 503 })
  const applications = await response.json() as Array<Record<string, unknown>>
  const activeApplication = applications.find((row) => ['submitted', 'information_requested'].includes(String(row.status || ''))) || null
  return NextResponse.json({
    applications,
    activeApplication,
    // Backward-compatible alias for older app builds.
    application: activeApplication || applications[0] || null,
  })
}

export async function POST(request: Request) {
  const user = await currentUser(request)
  if (!user) return NextResponse.json({ error: 'Sign in to apply for creator access.' }, { status: 401 })
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const requestedRole = String(body.requestedRole || '')
  const allowed = new Set(['artist', 'producer', 'writer', 'show_creator'])
  if (!allowed.has(requestedRole)) return NextResponse.json({ error: 'Choose a valid creator role.' }, { status: 400 })
  const message = String(body.message || '').trim().slice(0, 2000)
  if (message.length < 20) {
    return NextResponse.json({ error: 'Tell editorial a little about your work (at least 20 characters).' }, { status: 400 })
  }

  const [profileResponse, applicationResponse] = await Promise.all([
    fetch(`${url}/rest/v1/profiles?id=eq.${user.id}&select=role,is_producer&limit=1`, { headers, cache: 'no-store' }),
    fetch(`${url}/rest/v1/profile_role_applications?user_id=eq.${user.id}&status=in.(submitted,information_requested)&select=id,requested_role,status&limit=1`, { headers, cache: 'no-store' }),
  ])
  const profileRows = profileResponse.ok ? await profileResponse.json() : []
  const applicationRows = applicationResponse.ok ? await applicationResponse.json() : []
  const profile = profileRows[0] as { role?: string; is_producer?: boolean } | undefined
  const existingApplication = applicationRows[0] as { requested_role?: string; status?: string } | undefined
  const profileRole = String(profile?.role || 'listener')
  const alreadyGranted =
    requestedRole === profileRole ||
    (requestedRole === 'producer' && Boolean(profile?.is_producer)) ||
    profileRole === 'admin'
  if (alreadyGranted) {
    return NextResponse.json({ error: `This account already has ${requestedRole.replaceAll('_', ' ')} access.` }, { status: 409 })
  }
  if (existingApplication) {
    return NextResponse.json(
      { error: `Finish the current ${String(existingApplication.requested_role || 'creator').replaceAll('_', ' ')} application before starting another one.` },
      { status: 409 },
    )
  }

  const now = new Date().toISOString()
  const response = await fetch(`${url}/rest/v1/profile_role_applications`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: user.id,
      requested_role: requestedRole,
      status: 'submitted',
      message,
      review_notes: null,
      reviewed_by: null,
      reviewed_at: null,
      created_at: now,
      updated_at: now,
    }),
  })
  const rows = await response.json().catch(() => [])
  if (!response.ok) {
    const conflict = response.status === 409 || String(rows?.message || '').toLowerCase().includes('duplicate')
    return NextResponse.json(
      { error: conflict ? 'You already have an open creator-role application.' : 'Could not submit the role application.' },
      { status: conflict ? 409 : 503 },
    )
  }
  return NextResponse.json({ application: rows[0] })
}
