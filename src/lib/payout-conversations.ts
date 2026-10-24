import 'server-only'
import { NextResponse } from 'next/server'
import { can, editorialIdentity, serviceHeaders } from '@/lib/editorial-server'
import { payoutConfigured, payoutRpc, payoutUser } from '@/lib/artist-payouts'
import { sendBvsEmail, wrapBvsEmailHtml } from '@/lib/mailer'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Row = Record<string, unknown>
export async function payoutMessageRows(path: string, init?: RequestInit): Promise<Row[]> {
  const response = await fetch(`${url}/rest/v1/${path}`, { ...init, headers: { ...serviceHeaders, ...init?.headers }, cache: 'no-store' })
  if (!response.ok) throw new Error('Payout conversation is unavailable. Please retry.')
  return response.status === 204 ? [] : await response.json()
}
function publicMessage(row: Row) {
  return { id: row.id, body: row.body, authorKind: row.author_kind, confirmedName: row.confirmed_name, createdAt: row.created_at, readAt: row.recipient_read_at, emailState: row.email_state }
}
export async function payoutConversationRoute(request: Request, staff: boolean) {
  try {
    if (!payoutConfigured()) return NextResponse.json({ error: 'Payout service is not configured.' }, { status: 503 })
    const identity = staff ? await editorialIdentity(request) : null
    const user = staff ? identity?.user : await payoutUser(request)
    if (!user) return NextResponse.json({ error: 'Sign in to open payout messages.' }, { status: 401 })
    if (staff && (!identity || !can(identity, 'manage_artist_wallet'))) return NextResponse.json({ error: 'Wallet permission required.' }, { status: 403 })
    const isGet = request.method === 'GET'
    const body = isGet ? {} : await request.json().catch(() => ({}))
    const params = new URL(request.url).searchParams
    const requestId = String(isGet ? params.get('requestId') || '' : body.requestId || '')
    if (!uuid.test(requestId)) return NextResponse.json({ error: 'Choose a payout request.' }, { status: 400 })
    const [payout] = await payoutMessageRows(`artist_payout_requests?id=eq.${requestId}${staff ? '' : `&artist_user_id=eq.${user.id}`}&select=id,status,confirmed_account_holder_name,holder_confirmed_at&limit=1`)
    if (!payout) return NextResponse.json({ error: 'Payout request not found.' }, { status: 404 })
    if (isGet) {
      let cursor = ''
      const before = params.get('before')
      if (before) {
        const [at, id] = before.split('|')
        if (!uuid.test(id || '') || !/^\d{4}-\d\d-\d\dT[\d:.+-]+Z?$/.test(at || '') || !Number.isFinite(Date.parse(at))) return NextResponse.json({ error: 'Invalid message cursor.' }, { status: 400 })
        cursor = `&or=(created_at.lt.${encodeURIComponent(at)},and(created_at.eq.${encodeURIComponent(at)},id.lt.${id}))`
      }
      const messages = await payoutMessageRows(`artist_payout_messages?payout_request_id=eq.${requestId}&select=id,body,author_kind,confirmed_name,created_at,recipient_read_at,email_state&order=created_at.desc,id.desc&limit=100${cursor}`)
      const last = messages.at(-1)
      // Private account metadata is only returned to its owner, never staff/public profiles.
      const metadata = (user as { user_metadata?: { full_name?: unknown } }).user_metadata
      return NextResponse.json({ messages: messages.reverse().map(publicMessage), nextCursor: messages.length === 100 && last ? `${last.created_at}|${last.id}` : null,
        savedFullName: staff ? undefined : String(metadata?.full_name || '').trim(),
        confirmedName: payout.confirmed_account_holder_name || null, confirmedAt: payout.holder_confirmed_at || null,
      }, { headers: { 'Cache-Control': 'no-store' } })
    }
    if (request.method === 'PATCH') {
      // Mark only the displayed incoming messages, never replies arriving after a load.
      const ids = Array.isArray(body.ids) ? body.ids.filter((id: unknown) => typeof id === 'string' && uuid.test(id)).slice(0,100) : []
      if (ids.length) await payoutMessageRows(`artist_payout_messages?payout_request_id=eq.${requestId}&id=in.(${ids.join(',')})&author_kind=eq.${staff ? 'creator' : 'staff'}&recipient_read_at=is.null`, { method: 'PATCH', body: JSON.stringify({ recipient_read_at: new Date().toISOString() }) })
      return NextResponse.json({ ok: true })
    }
    const id = String(body.id || '')
    const text = String(body.message || '').trim()
    const name = body.confirmedName === undefined ? null : String(body.confirmedName).trim()
    if (!uuid.test(id) || (name === null && (!text || text.length > 2000)) || (name !== null && (staff || name.length < 2 || name.length > 160 || /[\x00-\x1f\x7f]/.test(name)))) return NextResponse.json({ error: 'Enter a message (up to 2,000 characters) or your registered account-holder name.' }, { status: 400 })
    const result = await payoutRpc<Row>('send_artist_payout_message', { p_id: id, p_request_id: requestId, p_actor_id: user.id, p_author_kind: staff ? 'staff' : 'creator', p_body: text, p_holder_name: name })
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.error.includes('wait a minute') ? 429 : 400 })
    // The message is durable before attempting email. The worker retries failures.
    const email = await deliverPayoutMessageEmails(id).catch(() => ({ sent: 0, failed: 1 }))
    return NextResponse.json({ ok: true, message: publicMessage(result.data), emailNotice: email.failed ? 'Message saved. Email notification is pending retry.' : null })
  } catch {
    return NextResponse.json({ error: 'Payout conversation is unavailable. Please retry; any saved message is kept.' }, { status: 503 })
  }
}

export async function deliverPayoutMessageEmails(id: string | null = null) {
  const claimed = await payoutRpc<Row[]>('claim_payout_message_emails', { p_id: id })
  if (!claimed.ok) throw new Error('Payout email queue unavailable.')
  let sent = 0, failed = 0
  for (const message of claimed.data) {
    try {
      const toCreator = message.author_kind === 'staff'
      let to = (process.env.BVS_PAYOUT_EMAIL || process.env.BVS_ORDER_EMAIL || 'contact@bvsradio.com').trim()
      if (toCreator) {
        const response = await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(String(message.artist_user_id))}`, { headers: { apikey: service, Authorization: `Bearer ${service}` }, cache: 'no-store' })
        if (!response.ok) throw new Error('Recipient unavailable')
        to = String((await response.json()).email || '')
      }
      if (!to || !to.includes('@')) throw new Error('Recipient unavailable')
      const href = `https://bvsradio.com/${toCreator ? 'creator/studio/payouts' : 'admin/editorial/finance/payouts'}#payout-${message.payout_request_id}`
      const subject = toCreator ? 'BVS Radio: new message about your payout' : 'BVS Radio: creator replied about a payout'
      const text = `There is a new private message in your payout conversation.\n\nRead it and reply securely on BVS Radio: ${href}\n\nPlease reply on the payout page, not to this email. Your payout account details are only shown after sign-in.`
      await sendBvsEmail({ to, subject, text, timeoutMs: 8000, html: wrapBvsEmailHtml({ title: 'Payout message', bodyHtml: `<p>There is a new private message in your payout conversation.</p><p><a href="${href}">Read and reply on BVS Radio</a></p><p>Please reply on the payout page, not to this email.</p>` }) })
      await payoutMessageRows(`artist_payout_messages?id=eq.${message.id}`, { method: 'PATCH', body: JSON.stringify({ email_state: 'sent', email_sent_at: new Date().toISOString() }) })
      sent++
    } catch {
      failed++
      await payoutMessageRows(`artist_payout_messages?id=eq.${message.id}`, { method: 'PATCH', body: JSON.stringify({ email_state: 'failed' }) }).catch(() => {})
    }
  }
  return { sent, failed }
}
