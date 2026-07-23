import { NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(req: Request) {
  try {
    const { email, password, username } = await req.json()

    if (!email || !password || !username) {
      return NextResponse.json({ error: 'Email, password, and username are required' }, { status: 400 })
    }

    // Create user via Supabase Admin API
    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({
        email,
        password,
        email_confirm: false,
        user_metadata: { username, role: 'artist' },
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      const msg = data.msg || data.message || 'Signup failed'
      return NextResponse.json({ error: msg }, { status: res.status })
    }

    // Create profile entry
    const userId = data.id
    await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        id: userId,
        username,
        display_name: username,
        role: 'artist',
        avatar_url: '/assets/images/default-avatar.png',
      }),
    })

    // Admin API does not send confirmation email. Prefer client signUp at /auth/signup.
    return NextResponse.json({
      message:
        'User created. If email confirmation is required, complete signup via /auth/signup so Supabase can send the link.',
      user: { id: userId, email },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}