import { NextResponse } from 'next/server'
import {
  generateAuthEmailLink,
  sendConfirmAccountEmail,
  supabaseAdmin,
} from '@/lib/auth-email'
import { isSignupRole, profileRoleForSignup, type SignupRole } from '@/lib/signup-roles'

type Attribution = Partial<Record<'utm_source' | 'utm_medium' | 'utm_campaign' | 'utm_content' | 'ref', string>>
type Body = {
  email?: string
  password?: string
  username?: string
  fullName?: string
  role?: string
  resendOnly?: boolean
  next?: string
  attribution?: Attribution
}

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status })
}

function safeNextPath(raw?: string) {
  const value = String(raw || '').trim()
  if (!value.startsWith('/') || value.startsWith('//')) return ''
  if (!/^\/app\/(ios|android)(?:\/|$)/.test(value)) return ''
  return value.slice(0, 500)
}

function cleanAttribution(value: unknown): Attribution {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const out: Attribution = {}
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'ref'] as const) {
    const raw = (value as Record<string, unknown>)[key]
    if (typeof raw !== 'string') continue
    const clean = raw.trim().slice(0, 80).replace(/[^a-zA-Z0-9._~:@/+-]/g, '-')
    if (clean) out[key] = clean
  }
  return out
}

async function ensureProfile(userId: string, username: string, role: SignupRole) {
  const producer = role === 'producer'
  const profileRole = profileRoleForSignup(role)
  await supabaseAdmin('/rest/v1/profiles', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      id: userId,
      username,
      display_name: username,
      role: profileRole,
      is_producer: producer,
    }),
  })
}

async function sendSignupConfirm(email: string, next?: string) {
  const safeNext = safeNextPath(next)
  const landingPath = safeNext ? `/auth/confirmed?next=${encodeURIComponent(safeNext)}` : '/auth/confirmed'
  const { link } = await generateAuthEmailLink({
    email,
    types: ['signup', 'magiclink'],
    landingPath,
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
    const resendOnly = Boolean(body.resendOnly)
    const next = safeNextPath(body.next)
    const attribution = cleanAttribution(body.attribution)

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return bad('Enter a valid email address (must include @ and a domain).')
    }

    if (resendOnly) {
      await sendSignupConfirm(email, next)
      return NextResponse.json({ ok: true, message: 'A new confirmation link was sent from BVS Radio. Check inbox and Spam.', next: next || undefined })
    }

    const requestedRole = (body.role || '').trim()
    if (!isSignupRole(requestedRole)) return bad('Choose what you want to do first on BVS.')
    const role = requestedRole
    const profileRole = profileRoleForSignup(role)

    if (!password || password.length < 8) return bad('Password must be at least 8 characters.')
    if (!/^[a-zA-Z0-9._-]{2,32}$/.test(username)) return bad('Username: 2–32 characters, letters/numbers/._- only (no spaces).')

    const create = await supabaseAdmin('/auth/v1/admin/users', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
        email_confirm: false,
        user_metadata: {
          username,
          full_name: fullName,
          role: profileRole,
          account_type: role,
          is_producer: role === 'producer',
          signup_attribution: attribution,
        },
      }),
    })

    if (!create.res.ok) {
      const msg = String(create.data?.msg || create.data?.message || 'Signup failed')
      if (/already|registered|exists/i.test(msg)) {
        try {
          await sendSignupConfirm(email, next)
          return NextResponse.json({ ok: true, needsConfirmation: true, message: 'This email already has an account awaiting confirmation. We sent a fresh BVS confirmation link.', next: next || undefined })
        } catch {
          return bad('An account with this email already exists. Sign in, or use Forgot password.', 409)
        }
      }
      return bad(msg, create.res.status || 400)
    }

    const userId = create.data?.id as string | undefined
    if (userId) await ensureProfile(userId, username, role)
    await sendSignupConfirm(email, next)

    return NextResponse.json({
      ok: true,
      needsConfirmation: true,
      message: 'Check your email for a confirmation link from BVS Radio (contact@bvsradio.com).',
      user: userId ? { id: userId, email } : undefined,
      next: next || undefined,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    const safe = /SMTP|not configured|credentials/i.test(message)
      ? 'We could not send the confirmation email right now. Please try again in a minute.'
      : 'We could not create your account right now. Please try again in a minute.'
    console.error('Signup failed:', message)
    return NextResponse.json({ error: safe }, { status: 500 })
  }
}
