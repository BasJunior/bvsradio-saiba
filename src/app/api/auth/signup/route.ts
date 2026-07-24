import { NextResponse } from 'next/server'
import {
  generateAuthEmailLink,
  sendConfirmAccountEmail,
  supabaseAdmin,
} from '@/lib/auth-email'

type Body = {
  email?: string
  password?: string
  username?: string
  fullName?: string
  role?: string
  resendOnly?: boolean
}

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status })
}

async function ensureProfile(userId: string, username: string, fullName: string, role: string) {
  await supabaseAdmin('/rest/v1/profiles', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      id: userId,
      username,
      display_name: fullName || username,
      full_name: fullName || username,
      role: role || 'listener',
    }),
  })
}

async function sendSignupConfirm(email: string) {
  const { link } = await generateAuthEmailLink({
    email,
    types: ['signup', 'magiclink'],
    landingPath: '/auth/confirmed',
  })
  await sendConfirmAccountEmail(email, link)
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body
    const email = (body.email || '').trim().toLowerCase()
    const password = body.password || ''
    const username = (body.username || '').trim()
    const fullName = (body.fullName || '').trim()
    const role = (body.role || 'listener').trim() || 'listener'
    const resendOnly = Boolean(body.resendOnly)

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return bad('Enter a valid email address (must include @ and a domain).')
    }

    if (resendOnly) {
      await sendSignupConfirm(email)
      return NextResponse.json({
        ok: true,
        message: 'A new confirmation link was sent from BVS Radio. Check inbox and Spam.',
      })
    }

    if (!password || password.length < 8) {
      return bad('Password must be at least 8 characters.')
    }
    if (!/^[a-zA-Z0-9._-]{2,32}$/.test(username)) {
      return bad('Username: 2–32 characters, letters/numbers/._- only (no spaces).')
    }

    const create = await supabaseAdmin('/auth/v1/admin/users', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
        email_confirm: false,
        user_metadata: {
          username,
          full_name: fullName,
          role,
        },
      }),
    })

    if (!create.res.ok) {
      const msg = String(create.data?.msg || create.data?.message || 'Signup failed')
      if (/already|registered|exists/i.test(msg)) {
        try {
          await sendSignupConfirm(email)
          return NextResponse.json({
            ok: true,
            needsConfirmation: true,
            message:
              'This email already has an account awaiting confirmation. We sent a fresh BVS confirmation link.',
          })
        } catch {
          return bad('An account with this email already exists. Sign in, or use Forgot password.', 409)
        }
      }
      return bad(msg, create.res.status || 400)
    }

    const userId = create.data?.id as string | undefined
    if (userId) {
      await ensureProfile(userId, username, fullName, role)
    }

    await sendSignupConfirm(email)

    return NextResponse.json({
      ok: true,
      needsConfirmation: true,
      message: 'Check your email for a confirmation link from BVS Radio (contact@bvsradio.com).',
      user: userId ? { id: userId, email } : undefined,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    const safe = /SMTP|not configured|credentials/i.test(message)
      ? 'We could not send the confirmation email right now. Please try again in a minute.'
      : message
    return NextResponse.json({ error: safe }, { status: 500 })
  }
}
