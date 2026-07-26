import { NextResponse } from 'next/server'
import { sendBvsEmail } from '@/lib/mailer'

export const runtime = 'nodejs'

const attempts = new Map<string, { count: number; resetAt: number }>()
const topics = new Set([
  'general',
  'music',
  'business',
  'press',
  'technical',
  'account',
  'account_deletion',
  'other',
])

function clean(value: unknown, max: number) {
  return String(value || '').trim().slice(0, max)
}

function allowed(request: Request) {
  const key = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const now = Date.now()
  const current = attempts.get(key)
  if (!current || current.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + 15 * 60_000 })
    return true
  }
  current.count += 1
  attempts.set(key, current)
  return current.count <= 5
}

export async function POST(request: Request) {
  if (!allowed(request)) {
    return NextResponse.json({ error: 'Too many messages. Please try again later.' }, { status: 429 })
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const name = clean(body.name, 120)
  const email = clean(body.email, 200).toLowerCase()
  const topic = clean(body.topic, 40).toLowerCase().replaceAll('-', '_')
  const message = clean(body.message, 5000)
  const website = clean(body.website, 200)

  if (website) return NextResponse.json({ ok: true })
  if (name.length < 2) return NextResponse.json({ error: 'Enter your name.' }, { status: 400 })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
  }
  if (!topics.has(topic)) return NextResponse.json({ error: 'Choose a valid topic.' }, { status: 400 })
  if (message.length < 10) {
    return NextResponse.json({ error: 'Add a little more detail so the team can help.' }, { status: 400 })
  }

  const reference = `BVS-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
  const inbox = process.env.BVS_SUPPORT_EMAIL || process.env.BVS_ORDER_EMAIL || 'contact@bvsradio.com'

  try {
    await sendBvsEmail({
      to: inbox,
      subject: `[${reference}] BVS ${topic.replaceAll('_', ' ')} — ${name}`,
      text: [
        `Reference: ${reference}`,
        `Topic: ${topic.replaceAll('_', ' ')}`,
        `From: ${name} <${email}>`,
        '',
        message,
      ].join('\n'),
    })
    await sendBvsEmail({
      to: email,
      subject: `BVS received your message — ${reference}`,
      text: [
        `Hi ${name},`,
        '',
        'BVS Radio received your message.',
        `Reference: ${reference}`,
        `Topic: ${topic.replaceAll('_', ' ')}`,
        '',
        'The team normally replies within 1–2 business days. Keep this reference if you follow up.',
        '',
        'Your message:',
        message,
      ].join('\n'),
    })
    return NextResponse.json({ ok: true, reference })
  } catch (error) {
    console.error('Contact email failed', error)
    return NextResponse.json(
      { error: 'Your message could not be sent. Please email contact@bvsradio.com directly.' },
      { status: 503 },
    )
  }
}
