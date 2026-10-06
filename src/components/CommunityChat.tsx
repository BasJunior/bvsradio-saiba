'use client'

import Link from 'next/link'
import { FormEvent, useCallback, useEffect, useId, useRef, useState } from 'react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase'

type ChatMessage = { id: string; body: string; created_at: string; profile?: { username?: string; display_name?: string } | null }
type ChatData = { messages: ChatMessage[]; access: { premium: boolean; staff: boolean; canPost: boolean } }
async function token() { if (!isSupabaseConfigured()) return null; const { data } = await createClient().auth.getSession(); return data.session?.access_token || null }

export default function CommunityChat({
  roomTitle = 'Broadcast room',
  loginNext = '/community',
  prompts = [],
}: {
  roomTitle?: string
  loginNext?: string
  prompts?: Array<{ label: string; text: string }>
} = {}) {
  const requestVersion = useRef(0)
  const accountId = useRef<string | null>(null)
  const composerId = useId()
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const [data, setData] = useState<ChatData | null>(null), [message, setMessage] = useState(''), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true), [sending, setSending] = useState(false), [signedIn, setSignedIn] = useState<boolean | null>(null)
  const refresh = useCallback(async (quiet = false) => {
    const version = ++requestVersion.current
    try {
      const accessToken = await token()
      if (version !== requestVersion.current) return
      setSignedIn(Boolean(accessToken))
      if (!accessToken) { setData(null); setError(''); setLoading(false); return }
      const response = await fetch('/api/community/messages', { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' })
      const text = await response.text()
      let payload: { error?: string } & Partial<ChatData> = {}
      try { payload = text ? JSON.parse(text) : {} } catch {
        throw new Error(response.status === 404 ? 'Community chat is not deployed yet.' : 'Could not load live chat.')
      }
      if (!response.ok) throw new Error(payload.error || 'Could not load live chat.')
      if (version !== requestVersion.current) return
      setData(payload as ChatData)
      setError('')
    } catch (issue) {
      if (version !== requestVersion.current) return
      setError(quiet ? 'The conversation could not refresh. Showing the last messages received.' : issue instanceof Error ? issue.message : 'Could not load live chat.')
    } finally {
      if (version === requestVersion.current) setLoading(false)
    }
  }, [])
  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0)
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(true) }, 8_000)
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh(true) }
    document.addEventListener('visibilitychange', onVisible)
    let authRefresh: number | undefined
    const subscription = isSupabaseConfigured() ? createClient().auth.onAuthStateChange((_event, session) => {
      const nextAccount = session?.user.id || null
      if (nextAccount !== accountId.current) {
        accountId.current = nextAccount
        requestVersion.current += 1
        setData(null)
        setMessage('')
        setNotice('')
      }
      setSignedIn(Boolean(session))
      window.clearTimeout(authRefresh)
      // Defer session reads until the auth callback has released its lock.
      authRefresh = window.setTimeout(() => void refresh(), 0)
    }).data.subscription : null
    return () => { requestVersion.current += 1; window.clearTimeout(authRefresh); window.clearTimeout(initial); window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); subscription?.unsubscribe() }
  }, [refresh])
  async function submit(event: FormEvent) { event.preventDefault(); if (!message.trim() || sending) return; const accessToken = await token(); if (!accessToken) return setError('Sign in to post.'); setSending(true); setError(''); setNotice(''); try { const response = await fetch('/api/community/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ message }) }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error || 'Could not post message.'); setMessage(''); await refresh(true) } catch (issue) { setError(issue instanceof Error ? issue.message : 'Could not post message.') } finally { setSending(false) } }
  async function report(messageId: string) { if (!window.confirm('Report this message to BVS moderators?')) return; try { const accessToken = await token(); if (!accessToken) return; const response = await fetch('/api/community/reports', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ messageId, reason: 'other' }) }); setNotice(response.ok ? 'Report sent privately to the moderation team.' : 'The report could not be sent.') } catch { setNotice('The report could not be sent. Please try again.') } }
  if (loading) return <div role="status" className="rounded-2xl border border-white/10 bg-bg-card/50 p-8 text-text-secondary">Connecting to the BVS community…</div>
  if (signedIn === false) return <div className="rounded-2xl border border-white/10 bg-bg-card/50 p-8"><h2 className="text-2xl font-semibold">Join the conversation</h2><p className="mt-2 text-text-secondary">Sign in to follow the discussion. Premium members and staff can post.</p><Link href={`/auth/login?next=${encodeURIComponent(loginNext)}`} className="mt-5 inline-block rounded-full bg-brand px-5 py-2.5 font-medium text-black">Sign in to the room</Link></div>
  return <div className="overflow-hidden rounded-2xl border border-white/10 bg-bg-card/50"><div className="border-b border-white/10 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">{roomTitle}</h2><p className="text-sm text-text-secondary">Signed-in members can read. Premium members can join the live conversation.</p></div><span className="rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs text-brand">{data?.access.staff ? 'Staff access' : data?.access.premium ? 'Premium access' : 'Listener access'}</span></div></div><div className="max-h-[32rem] min-h-64 space-y-3 overflow-y-auto overscroll-contain p-5" role="log" aria-label="Room messages" aria-relevant="additions">{data?.messages.length ? data.messages.map((item) => <article key={item.id} className="border-b border-white/5 py-4 first:pt-0 last:border-0"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm font-medium text-brand">{item.profile?.display_name || item.profile?.username || 'BVS member'}</p><p className="mt-1 whitespace-pre-wrap break-words text-base leading-7">{item.body}</p><time className="mt-2 block text-xs text-text-secondary" dateTime={item.created_at}>{new Date(item.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</time></div><button type="button" onClick={() => void report(item.id)} className="min-h-11 shrink-0 px-2 text-sm text-text-secondary hover:text-white">Report</button></div></article>) : <div className="grid min-h-64 place-items-center text-center"><div><p className="text-lg font-medium">The room is quiet.</p><p className="mt-1 text-sm text-text-secondary">Start with a track you love or a question about what you’re hearing.</p></div></div>}</div><form onSubmit={submit} className="border-t border-white/10 p-5">{error && <div><p role="alert" className="mb-3 rounded-lg bg-red-500/10 p-3 text-sm text-red-300">{error}</p><button type="button" onClick={() => void refresh()} className="mb-3 min-h-11 text-sm text-brand hover:underline">Retry conversation</button></div>}{notice && <p role="status" className="mb-3 rounded-lg bg-brand/10 p-3 text-sm text-brand">{notice}</p>}{data?.access.canPost ? <><div className="mb-4 flex flex-wrap gap-2">{prompts.map(prompt => <button key={prompt.label} type="button" onClick={() => { setMessage(prompt.text); composerRef.current?.focus() }} className="min-h-11 rounded-full border border-white/15 px-3 py-2 text-sm hover:bg-white/5">{prompt.label}</button>)}</div><label htmlFor={composerId} className="mb-2 block text-sm font-medium">Add to the conversation</label><textarea ref={composerRef} id={composerId} value={message} onChange={(event) => setMessage(event.target.value)} maxLength={500} rows={2} placeholder="Add to the live conversation…" className="w-full resize-none rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-brand"/><div className="mt-3 flex items-center justify-between"><span className="text-xs text-text-secondary">{message.length}/500 · Be respectful. Posts can be reported.</span><button disabled={sending || !message.trim()} className="min-h-11 rounded-full bg-brand px-5 py-2 font-medium text-black disabled:opacity-50">{sending ? 'Sending…' : 'Send'}</button></div></> : <div className="rounded-xl border border-white/10 bg-black/20 p-4"><p className="font-medium">Premium chat</p><p className="mt-1 text-sm text-text-secondary">You can follow the room. Posting unlocks with an active BVS premium membership.</p><Link href="/contact" className="mt-3 inline-block text-sm text-brand hover:underline">Ask about premium access</Link></div>}</form></div>
}
