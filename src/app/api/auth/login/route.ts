import { NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function looksLikeEmail(value: string): boolean {
  return value.includes('@')
}

/** Resolve username → email via profiles + Admin API. */
async function resolveEmailFromUsername(username: string): Promise<string | null> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null

  // Escape LIKE wildcards; force exact case-insensitive match
  const escaped = username.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
  const q = encodeURIComponent(escaped)
  const profileRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?username=ilike.${q}&select=id,username&limit=5`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    },
  )
  if (!profileRes.ok) return null
  const profiles = await profileRes.json()
  if (!Array.isArray(profiles) || profiles.length === 0) return null
  const profile =
    profiles.find(
      (p: { username?: string }) =>
        typeof p.username === 'string' && p.username.toLowerCase() === username.toLowerCase(),
    ) || profiles[0]
  if (!profile?.id) return null

  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${profile.id}`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
  })
  if (!userRes.ok) return null
  const user = await userRes.json()
  return typeof user?.email === 'string' ? user.email : null
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const password = typeof body.password === 'string' ? body.password : ''
    const raw =
      (typeof body.identifier === 'string' && body.identifier) ||
      (typeof body.email === 'string' && body.email) ||
      (typeof body.username === 'string' && body.username) ||
      ''

    const identifier = raw.trim()
    if (!identifier || !password) {
      return NextResponse.json(
        { error: 'Email or username, and password, are required' },
        { status: 400 },
      )
    }

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return NextResponse.json({ error: 'Auth is not configured' }, { status: 503 })
    }

    let email: string
    if (looksLikeEmail(identifier)) {
      email = identifier.toLowerCase()
    } else {
      const resolved = await resolveEmailFromUsername(identifier)
      if (!resolved) {
        // Same message as bad password — avoid user enumeration
        return NextResponse.json({ error: 'Invalid login credentials' }, { status: 400 })
      }
      email = resolved
    }

    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ email, password }),
    })

    const data = await res.json()

    if (!res.ok) {
      const msg = data.error_description || data.error || data.msg || 'Invalid credentials'
      if (/confirm|not confirmed/i.test(String(msg))) {
        return NextResponse.json(
          {
            error:
              'Email not confirmed yet. Check your inbox for the confirmation link, or resend from signup.',
          },
          { status: 400 },
        )
      }
      return NextResponse.json(
        {
          error:
            'Invalid email/username or password. Use the password from signup (not your mail provider password).',
        },
        { status: res.status >= 400 && res.status < 600 ? res.status : 400 },
      )
    }

    let profile = null
    if (SUPABASE_SERVICE_KEY && data.user?.id) {
      const profileRes = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?id=eq.${data.user.id}&select=*`,
        {
          headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          },
        },
      )
      if (profileRes.ok) {
        const profiles = await profileRes.json()
        profile = Array.isArray(profiles) ? profiles[0] : null
      }
    }

    return NextResponse.json({
      user: {
        id: data.user.id,
        email: data.user.email,
        profile,
      },
      session: {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: data.expires_at,
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
