import { NextResponse } from 'next/server'
import { getAuthCallbackUrl } from '@/lib/auth-url'
import { buildConfirmEmail, sendBvsEmail } from '@/lib/mailer'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

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

async function supabaseAdmin(path: string, init: RequestInit = {}) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Account service is not configured')
  }
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      ...(init.headers || {}),
    },
  })
  const text = await res.text()
  let data: any = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { message: text }
  }
  return { res, data }
}

function productionConfirmUrl() {
  const redirectTo = getAuthCallbackUrl('/auth/confirmed')
  return redirectTo.includes('localhost') || redirectTo.includes('127.0.0.1')
    ? 'https://bvsradio.com/auth/confirmed'
    : redirectTo
}

function mapVerifyType(raw: unknown, fallback: string): string {
  const value = String(raw || fallback || 'signup').toLowerCase()
  if (value.includes('magic')) return 'magiclink'
  if (value.includes('recovery') || value.includes('reset')) return 'recovery'
  if (value.includes('invite')) return 'invite'
  if (value.includes('email_change') || value.includes('email_change_current') || value.includes('email_change_new')) {
    return 'email_change'
  }
  return 'signup'
}

/**
 * Prefer a first-party bvsradio.com link with token_hash.
 * That way the member never lands on supabase.co/verify (which can bounce
 * to localhost when Supabase Site URL is still misconfigured).
 */
function buildFirstPartyConfirmUrl(data: any, requestedType: string, safeRedirect: string): string | null {
  const props = data?.properties || data || {}
  const tokenHash = props.hashed_token || data?.hashed_token
  if (!tokenHash) return null

  const type = mapVerifyType(props.verification_type || data?.verification_type, requestedType)
  const url = new URL(safeRedirect)
  url.searchParams.set('token_hash', String(tokenHash))
  url.searchParams.set('type', type)
  return url.toString()
}

function sanitizeActionLink(actionLink: string, safeRedirect: string) {
  let cleaned = String(actionLink)
  try {
    const u = new URL(cleaned)
    // If Supabase still emitted a verify URL, force redirect_to onto production.
    const redirect = u.searchParams.get('redirect_to')
    if (!redirect || /localhost|127\.0\.0\.1/i.test(redirect)) {
      u.searchParams.set('redirect_to', safeRedirect)
      cleaned = u.toString()
    }
  } catch {
    // keep original
  }
  return cleaned
}

async function generateConfirmLink(email: string) {
  const safeRedirect = productionConfirmUrl()

  const attempts: Array<{ type: string; body: Record<string, unknown> }> = [
    {
      type: 'signup',
      body: {
        type: 'signup',
        email,
        options: { redirect_to: safeRedirect },
        redirect_to: safeRedirect,
      },
    },
    {
      type: 'magiclink',
      body: {
        type: 'magiclink',
        email,
        options: { redirect_to: safeRedirect },
        redirect_to: safeRedirect,
      },
    },
  ]

  let lastError = 'Could not create confirmation link'
  for (const attempt of attempts) {
    const { res, data } = await supabaseAdmin('/auth/v1/admin/generate_link', {
      method: 'POST',
      body: JSON.stringify(attempt.body),
    })
    if (!res.ok) {
      lastError = data?.msg || data?.message || lastError
      continue
    }

    const firstParty = buildFirstPartyConfirmUrl(data, attempt.type, safeRedirect)
    if (firstParty) {
      return {
        actionLink: firstParty,
        redirectTo: safeRedirect,
      }
    }

    const finalLink = data?.action_link || data?.properties?.action_link
    if (!finalLink) {
      lastError = 'Confirmation link was not returned by auth service'
      continue
    }
    return {
      actionLink: sanitizeActionLink(String(finalLink), safeRedirect),
      redirectTo: safeRedirect,
    }
  }

  throw new Error(lastError)
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

async function sendConfirm(email: string, actionLink: string) {
  const mail = buildConfirmEmail({ confirmUrl: actionLink, email })
  await sendBvsEmail({
    to: email,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  })
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
      const { actionLink } = await generateConfirmLink(email)
      await sendConfirm(email, actionLink)
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
          const { actionLink } = await generateConfirmLink(email)
          await sendConfirm(email, actionLink)
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

    const { actionLink } = await generateConfirmLink(email)
    await sendConfirm(email, actionLink)

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
