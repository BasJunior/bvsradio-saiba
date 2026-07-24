import { NextResponse } from 'next/server'
import { generateAuthEmailLink, sendPasswordResetEmail } from '@/lib/auth-email'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const email = String(body.email || '')
      .trim()
      .toLowerCase()

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: 'Enter a valid email address (must include @ and a domain).' },
        { status: 400 },
      )
    }

    // Always return a generic success to avoid account enumeration.
    try {
      const { link } = await generateAuthEmailLink({
        email,
        types: ['recovery'],
        landingPath: '/auth/reset-password',
      })
      await sendPasswordResetEmail(email, link)
    } catch {
      // Swallow user-not-found / provider detail. Log server-side only.
      console.warn('forgot-password mail path failed for request')
    }

    return NextResponse.json({
      ok: true,
      message:
        'If an account exists for that email, a reset link was sent from BVS Radio (contact@bvsradio.com). Check inbox and Spam.',
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    const safe = /SMTP|not configured|credentials/i.test(message)
      ? 'We could not send the reset email right now. Please try again in a minute.'
      : 'Could not send reset email.'
    return NextResponse.json({ error: safe }, { status: 500 })
  }
}
