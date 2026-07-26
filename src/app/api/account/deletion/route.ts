import { NextResponse } from 'next/server'
import { sendBvsEmail } from '@/lib/mailer'
import { authUserId, serviceHeaders } from '@/lib/storage-upload'

export const runtime = 'nodejs'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

async function count(path: string) {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    method: 'HEAD',
    headers: { ...serviceHeaders(service), Prefer: 'count=exact' },
    cache: 'no-store',
  })
  const range = response.headers.get('content-range') || ''
  return Number(range.split('/')[1] || 0)
}

export async function POST(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token || !url || !service) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
  const user = await authUserId(url, service, token)
  if (!user?.id || !user.email) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })

  const body = await request.json().catch(() => ({})) as { confirmation?: string; reason?: string }
  if (String(body.confirmation || '').trim().toUpperCase() !== 'DELETE') {
    return NextResponse.json({ error: 'Type DELETE to confirm your request.' }, { status: 400 })
  }

  const profileResponse = await fetch(
    `${url}/rest/v1/profiles?id=eq.${user.id}&select=username,display_name,is_published,role&limit=1`,
    { headers: serviceHeaders(service), cache: 'no-store' },
  )
  const profile = profileResponse.ok ? (await profileResponse.json())[0] : null
  const [publishedTracks, publishedBeats, openOrders] = await Promise.all([
    count(`tracks?user_id=eq.${user.id}&is_public=eq.true`),
    count(`beats?producer_user_id=eq.${user.id}&is_public=eq.true`),
    count(`orders?customer_user_id=eq.${user.id}&status=in.(pending_payment,paid)`),
  ])

  const reference = `DEL-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
  const inbox = process.env.BVS_PRIVACY_EMAIL || process.env.BVS_SUPPORT_EMAIL || process.env.BVS_ORDER_EMAIL || 'contact@bvsradio.com'
  const reason = String(body.reason || '').trim().slice(0, 1000)
  const requiresReview = Boolean(profile?.is_published || publishedTracks || publishedBeats || openOrders)

  try {
    await sendBvsEmail({
      to: inbox,
      subject: `[${reference}] Authenticated BVS account deletion request`,
      text: [
        `Reference: ${reference}`,
        `User ID: ${user.id}`,
        `Email: ${user.email}`,
        `Profile: ${profile?.display_name || profile?.username || 'Unknown'}`,
        `Role: ${profile?.role || 'Unknown'}`,
        `Published profile: ${Boolean(profile?.is_published)}`,
        `Published tracks: ${publishedTracks}`,
        `Published beats: ${publishedBeats}`,
        `Open/paid orders: ${openOrders}`,
        `Editorial review required: ${requiresReview}`,
        '',
        `Reason: ${reason || 'Not provided'}`,
        '',
        'Verify fulfilment obligations, unpublish creator content where applicable, then remove/authonymise account data.',
      ].join('\n'),
    })
    await sendBvsEmail({
      to: user.email,
      subject: `BVS account deletion request received — ${reference}`,
      text: [
        'We received your authenticated request to delete your BVS Radio account.',
        `Reference: ${reference}`,
        '',
        requiresReview
          ? 'Your account has published creator content or active order records. The team will first protect outstanding purchases and unpublish relevant creator content, then complete deletion.'
          : 'The team will process the deletion and confirm by email.',
        '',
        'You can contact privacy@bvsradio.com with this reference if you need an update.',
      ].join('\n'),
    })
    return NextResponse.json({
      ok: true,
      reference,
      requiresReview,
      message: requiresReview
        ? 'Deletion requested. BVS will review published content and active orders before removal.'
        : 'Deletion requested. BVS will confirm by email when it is complete.',
    })
  } catch (error) {
    console.error('Account deletion request failed', error)
    return NextResponse.json(
      { error: 'Could not submit the deletion request. Email privacy@bvsradio.com from your account email.' },
      { status: 503 },
    )
  }
}
