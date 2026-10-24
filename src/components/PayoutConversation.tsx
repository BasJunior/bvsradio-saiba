'use client'

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'

type Message = { id: string; body: string; authorKind: 'staff' | 'creator'; confirmedName?: string | null; createdAt: string; readAt?: string | null; emailState?: string }
type Props = { requestId: string; token: string; staff?: boolean; active?: boolean; hasNewReply?: boolean; onRead?: () => void }
const input = 'mt-2 min-h-11 w-full rounded-xl border border-white/20 bg-black/30 p-3 text-base'
const button = 'min-h-11 rounded-full border border-brand/40 px-4 py-2 text-sm font-semibold text-brand disabled:opacity-40'

export default function PayoutConversation({ requestId, token, staff = false, active = true, hasNewReply = false, onRead }: Props) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [savedName, setSavedName] = useState('')
  const [confirmedName, setConfirmedName] = useState('')
  const [confirmedAt, setConfirmedAt] = useState('')
  const [choice, setChoice] = useState('saved')
  const [otherName, setOtherName] = useState('')
  const [text, setText] = useState('')
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const retry = useRef<{ id: string; fingerprint: string } | null>(null)
  const sending = useRef(false)
  const historyInitialized = useRef(false)
  const readCallback = useRef(onRead)
  useEffect(() => { readCallback.current = onRead }, [onRead])
  const endpoint = staff ? '/api/admin/editorial/payouts/messages' : '/api/artist/payouts/messages'
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  const load = useCallback(async (before?: string, signal?: AbortSignal) => {
    const response = await fetch(`${endpoint}?requestId=${requestId}${before ? `&before=${encodeURIComponent(before)}` : ''}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.error || 'Could not load messages.')
    if (signal?.aborted) return
    const incoming: Message[] = data.messages || []
    setMessages(current => [...new Map([...current, ...incoming].map(message => [message.id, message])).values()].sort((a,b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)))
    setSavedName(data.savedFullName || '')
    setConfirmedName(data.confirmedName || '')
    setConfirmedAt(data.confirmedAt || '')
    // Refreshes should not discard the cursor for history already loaded.
    if (before) setCursor(data.nextCursor || null)
    else if (!historyInitialized.current) { setCursor(data.nextCursor || null); historyInitialized.current = true }
    setLoaded(true)
    const ids = incoming.filter(message => message.authorKind === (staff ? 'creator' : 'staff') && !message.readAt).map(message => message.id)
    if (ids.length) {
      const acknowledged = await fetch(endpoint, { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId, ids }), signal })
      if (acknowledged.ok) readCallback.current?.()
    }
  }, [endpoint, requestId, token, staff])
  useEffect(() => {
    const openLinkedConversation = () => {
      if (window.location.hash !== `#payout-${requestId}`) return
      document.getElementById(`payout-${requestId}`)?.scrollIntoView({ block: 'start' })
      void Promise.resolve().then(() => setOpen(true))
    }
    openLinkedConversation()
    window.addEventListener('hashchange', openLinkedConversation)
    return () => window.removeEventListener('hashchange', openLinkedConversation)
  }, [requestId])
  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    const refresh = () => { void load(undefined, controller.signal).catch(caught => { if (!controller.signal.aborted) setError(caught.message) }) }
    refresh()
    const interval = window.setInterval(refresh, 30000)
    return () => { controller.abort(); window.clearInterval(interval) }
  }, [open, load])
  async function send(confirmed?: string) {
    if (sending.current) return
    sending.current = true
    setBusy(true); setError(''); setNotice('')
    const payload = { message: confirmed === undefined ? text.trim() : '', ...(confirmed === undefined ? {} : { confirmedName: confirmed }) }
    const fingerprint = JSON.stringify(payload)
    if (retry.current?.fingerprint !== fingerprint) retry.current = { id: crypto.randomUUID(), fingerprint }
    try {
      const response = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ requestId, id: retry.current.id, ...payload }) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Could not send. Retry to safely resend the same message.')
      retry.current = null
      if (confirmed === undefined) setText('')
      setNotice(data.emailNotice || (confirmed === undefined ? 'Message sent.' : 'Payout account-holder name confirmed.'))
      await load().catch(() => setError('Your message is saved. Refresh messages to view the latest replies.'))
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not send. Your text is kept.') }
    finally { sending.current = false; setBusy(false) }
  }
  async function older() {
    if (!cursor) return
    setLoading(true); setError('')
    try { await load(cursor) } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not load earlier messages.') }
    finally { setLoading(false) }
  }
  function submit(event: FormEvent) { event.preventDefault(); void send() }
  return <section id={`payout-${requestId}`} className="mt-5 scroll-mt-52 rounded-2xl border border-white/15 p-4 sm:p-5" aria-label="Private payout conversation">
    <button type="button" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-controls={`conversation-${requestId}`} className="flex min-h-11 w-full flex-wrap items-center justify-between gap-2 text-left font-semibold">
      <span>Messages & account-holder confirmation</span><span className="text-sm text-brand">{hasNewReply ? 'New creator reply · ' : ''}{open ? 'Close' : 'Open conversation'}</span>
    </button>
    {open && <div id={`conversation-${requestId}`}>
      <p className="mt-2 text-sm text-text-secondary">Private between you and BVS Finance. Messages do not change the payout status. Reply here rather than by email.</p>
      {error && <p role="alert" className="mt-3 text-sm text-red-200">{error}</p>}
      {notice && <p role="status" className="mt-3 text-sm text-brand">{notice}</p>}
      {!loaded ? <p className="mt-4 text-sm">Loading messages… <button type="button" className={button} onClick={() => void load().catch(caught => setError(caught.message))}>Retry</button></p> : <>
        <div className="mt-4 rounded-xl border border-brand/20 bg-brand/[.04] p-4">
          <p className="font-semibold">{confirmedName ? 'Creator-confirmed payout name' : 'Confirm the name registered to the payout account'}</p>
          {confirmedName && <p className="mt-2 text-sm">{confirmedName} <span className="text-text-secondary">· {new Date(confirmedAt).toLocaleString()}</span></p>}
          {staff ? <p className="mt-2 text-sm text-text-secondary">{confirmedName ? 'This name was explicitly confirmed by the creator for this payout. Match it with the payment service before transferring.' : 'Awaiting creator confirmation. Use the conversation below to ask for it.'}</p> : active && <fieldset disabled={busy} className="mt-3 space-y-3">
            <legend className="text-sm text-text-secondary">Choose the full name shown on your selected payment account. This does not change your profile name.</legend>
            {savedName && <label className="flex gap-3 text-sm"><input type="radio" name={`holder-${requestId}`} checked={choice === 'saved'} onChange={() => setChoice('saved')} /><span>Use my saved full name: <strong>{savedName}</strong></span></label>}
            <label className="flex gap-3 text-sm"><input type="radio" name={`holder-${requestId}`} checked={choice === 'other' || !savedName} onChange={() => setChoice('other')} /><span>My payout account uses a different name</span></label>
            {(choice === 'other' || !savedName) && <label className="block text-sm">Full registered account-holder name<input value={otherName} onChange={event => setOtherName(event.target.value)} autoComplete="name" maxLength={160} className={input} /></label>}
            <button type="button" className={button} disabled={busy || (choice === 'saved' && savedName ? savedName : otherName.trim()).length < 2} onClick={() => void send(choice === 'saved' && savedName ? savedName : otherName.trim())}>{confirmedName ? 'Update confirmed name' : 'Confirm payout name'}</button>
          </fieldset>}
        </div>
        {cursor && <button type="button" className={`${button} mt-4`} onClick={() => void older()} disabled={loading}>{loading ? 'Loading…' : 'Load earlier messages'}</button>}
        <ol className="mt-4 space-y-3" aria-label="Message history">{messages.map(message => <li key={message.id} className={`rounded-xl border p-3 ${message.authorKind === 'staff' ? 'border-brand/20 bg-brand/[.04]' : 'border-white/10 bg-white/[.02]'}`}>
          <p className="text-xs text-text-secondary">{message.authorKind === 'staff' ? 'BVS Finance' : 'Creator'} · {new Date(message.createdAt).toLocaleString()}{message.confirmedName ? ' · Account-holder confirmation' : ''}</p>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm">{message.body}</p>
          {message.authorKind === (staff ? 'staff' : 'creator') && message.emailState === 'failed' && <p className="mt-2 text-xs text-amber-200">Message saved. Email notice could not be delivered; the conversation remains available here.</p>}
        </li>)}</ol>
        {!messages.length && <p className="mt-4 text-sm text-text-secondary">No messages yet. Start the conversation below.</p>}
        <form onSubmit={submit} className="mt-5"><label className="block text-sm">{staff ? 'Message to creator' : 'Reply to BVS Finance'}<textarea value={text} onChange={event => setText(event.target.value)} maxLength={2000} required rows={3} disabled={busy} className={input} placeholder={staff ? 'Ask for information or share an update…' : 'Write your reply…'} /></label>
          <button type="submit" disabled={busy || !text.trim()} className={`${button} mt-3`}>{busy ? 'Sending…' : 'Send message'}</button>
        </form>
      </>}
    </div>}
  </section>
}
