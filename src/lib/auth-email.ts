import { getAuthCallbackUrl } from '@/lib/auth-url'
import { sendBvsEmail } from '@/lib/mailer'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export async function supabaseAdmin(path: string, init: RequestInit = {}) {
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

function forceProductionPath(path: string) {
  const redirectTo = getAuthCallbackUrl(path)
  if (redirectTo.includes('localhost') || redirectTo.includes('127.0.0.1')) {
    return `https://bvsradio.com${path.startsWith('/') ? path : `/${path}`}`
  }
  return redirectTo
}

function mapVerifyType(raw: unknown, fallback: string): string {
  const value = String(raw || fallback || 'signup').toLowerCase()
  if (value.includes('magic')) return 'magiclink'
  if (value.includes('recovery') || value.includes('reset')) return 'recovery'
  if (value.includes('invite')) return 'invite'
  if (value.includes('email_change')) return 'email_change'
  return fallback || 'signup'
}

function buildFirstPartyUrl(data: any, requestedType: string, safeRedirect: string): string | null {
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

export async function generateAuthEmailLink(opts: {
  email: string
  types: string[]
  landingPath: string
}) {
  const safeRedirect = forceProductionPath(opts.landingPath)
  let lastError = 'Could not create auth link'

  for (const type of opts.types) {
    const { res, data } = await supabaseAdmin('/auth/v1/admin/generate_link', {
      method: 'POST',
      body: JSON.stringify({
        type,
        email: opts.email,
        options: { redirect_to: safeRedirect },
        redirect_to: safeRedirect,
      }),
    })
    if (!res.ok) {
      lastError = data?.msg || data?.message || lastError
      continue
    }

    const firstParty = buildFirstPartyUrl(data, type, safeRedirect)
    if (firstParty) {
      return { link: firstParty, redirectTo: safeRedirect }
    }

    const finalLink = data?.action_link || data?.properties?.action_link
    if (!finalLink) {
      lastError = 'Auth link was not returned by auth service'
      continue
    }
    return {
      link: sanitizeActionLink(String(finalLink), safeRedirect),
      redirectTo: safeRedirect,
    }
  }

  throw new Error(lastError)
}

export async function sendConfirmAccountEmail(email: string, confirmUrl: string) {
  const subject = 'Confirm your BVS Radio account'
  const text = [
    'Welcome to BVS Radio.',
    '',
    'Confirm your email to finish creating your account:',
    confirmUrl,
    '',
    'This link opens on bvsradio.com.',
    'If you did not sign up, ignore this email.',
  ].join('\n')
  const html = `<!doctype html>
<html><body style="font-family:system-ui,sans-serif;background:#0a0a0a;color:#f5f5f5;padding:24px">
  <div style="max-width:520px;margin:0 auto;background:#141414;border:1px solid #333;border-radius:16px;padding:28px">
    <h1 style="margin:0 0 12px;font-size:22px">Confirm your BVS Radio account</h1>
    <p style="color:#cfcfcf;line-height:1.5">Thanks for joining. Tap the button below to confirm <strong>${email}</strong>.</p>
    <p style="margin:28px 0"><a href="${confirmUrl}" style="display:inline-block;background:#f5c518;color:#000;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:999px">Confirm email</a></p>
    <p style="color:#999;font-size:13px;line-height:1.5">Or paste this link into your browser:<br/><a href="${confirmUrl}" style="color:#f5c518;word-break:break-all">${confirmUrl}</a></p>
  </div>
</body></html>`
  await sendBvsEmail({ to: email, subject, text, html })
}

export async function sendPasswordResetEmail(email: string, resetUrl: string) {
  const subject = 'Reset your BVS Radio password'
  const text = [
    'Reset your BVS Radio password',
    '',
    'Use this link to choose a new password:',
    resetUrl,
    '',
    'This link opens on bvsradio.com and expires soon.',
    'If you did not request a reset, ignore this email.',
  ].join('\n')
  const html = `<!doctype html>
<html><body style="font-family:system-ui,sans-serif;background:#0a0a0a;color:#f5f5f5;padding:24px">
  <div style="max-width:520px;margin:0 auto;background:#141414;border:1px solid #333;border-radius:16px;padding:28px">
    <h1 style="margin:0 0 12px;font-size:22px">Reset your BVS Radio password</h1>
    <p style="color:#cfcfcf;line-height:1.5">We received a password reset request for <strong>${email}</strong>.</p>
    <p style="margin:28px 0"><a href="${resetUrl}" style="display:inline-block;background:#f5c518;color:#000;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:999px">Choose new password</a></p>
    <p style="color:#999;font-size:13px;line-height:1.5">Or paste this link into your browser:<br/><a href="${resetUrl}" style="color:#f5c518;word-break:break-all">${resetUrl}</a></p>
    <p style="color:#777;font-size:12px;margin-top:24px">If you did not request this, you can ignore the email.</p>
  </div>
</body></html>`
  await sendBvsEmail({ to: email, subject, text, html })
}
