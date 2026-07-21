'use client'

import Link from 'next/link'
import { FormEvent, useCallback, useEffect, useState } from 'react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase'

type ChatMessage = { id: string; body: string; created_at: string; profile?: { username?: string; display_name?: string } | null }
type ChatData = { messages: ChatMessage[]; access: { premium: boolean; staff: boolean; canPost: boolean } }
async function token() { if (!isSupabaseConfigured()) return null; const { data } = await createClient().auth.getSession(); return data.session?.access_token || null }

export default function CommunityChat() {
  const [data, setData] = useState<ChatData | null>(null), [message, setMessage] = useState(''), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true), [sending, setSending] = useState(false), [signedIn, setSignedIn] = useState<boolean | null>(null)
  const refresh = useCallback(async (quiet = false) => {
    const accessToken = await token()
    setSignedIn(Boolean(accessToken))
    if (!accessToken) { setLoading(false); return }
    try {
      const response = await fetch('/api/community/messages', { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' })
      const text = await response.text()
      let payload: { error?: string } & Partial<ChatData> = {}
      try { payload = text ? JSON.parse(text) : {} } catch {
        throw new Error(response.status === 404 ? 'Community chat is not deployed yet.' : 'Could not load live chat.')
      }
      if (!response.ok) throw new Error(payload.error || 'Could not load live chat.')
      setData(payload as ChatData)
      if (!quiet) setError('')
    } catch (issue) {
      if (!quiet) setError(issue instanceof Error ? issue.message : 'Could not load live chat.')
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { const initial = window.setTimeout(() => void refresh(), 0); const timer = window.setInterval(() => void refresh(true), 8_000); return () => { window.clearTimeout(initial); window.clearInterval(timer) } }, [refresh])
  async function submit(event: FormEvent) { event.preventDefault(); if (!message.trim() || sending) return; const accessToken = await token(); if (!accessToken) return setError('Sign in to post.'); setSending(true); setError(''); setNotice(''); try { const response = await fetch('/api/community/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ message }) }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error || 'Could not post message.'); setMessage(''); await refresh(true) } catch (issue) { setError(issue instanceof Error ? issue.message : 'Could not post message.') } finally { setSending(false) } }
  async function report(messageId: string) { if (!window.confirm('Report this message to BVS moderators?')) return; const accessToken = await token(); if (!accessToken) return; const response = await fetch('/api/community/reports', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ messageId, reason: 'other' }) }); setNotice(response.ok ? 'Report sent privately to the moderation team.' : 'The report could not be sent.') }
  if (loading) return <div className="rounded-2xl border border-white/10 bg-bg-card/50 p-8 text-text-secondary">Connecting to the BVS community…</div>
  if (signedIn === false) return <div className="rounded-2xl border border-white/10 bg-bg-card/50 p-8"><h2 className="text-2xl font-semibold">Sign in to enter</h2><p className="mt-2 text-text-secondary">Community conversations are limited to signed-in BVS members.</p><Link href="/auth/login?next=/community" className="mt-5 inline-block rounded-full bg-brand px-5 py-2.5 font-medium text-black">Sign in</Link></div>
  return <div className="overflow-hidden rounded-2xl border border-white/10 bg-bg-card/50"><div className="border-b border-white/10 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">Broadcast room</h2><p className="text-sm text-text-secondary">Signed-in members can read. Premium members can join the live conversation.</p></div><span className="rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs text-brand">{data?.access.staff ? 'Staff access' : data?.access.premium ? 'Premium access' : 'Listener access'}</span></div></div><div className="h-[28rem] space-y-3 overflow-y-auto p-5" aria-live="polite">{data?.messages.length ? data.messages.map((item) => <article key={item.id} className="rounded-xl border border-white/5 bg-black/20 p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium text-brand">{item.profile?.display_name || item.profile?.username || 'BVS member'}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm">{item.body}</p><time className="mt-2 block text-xs text-text-secondary" dateTime={item.created_at}>{new Date(item.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</time></div><button type="button" onClick={() => void report(item.id)} className="text-xs text-text-secondary hover:text-white">Report</button></div></article>) : <div className="grid h-full place-items-center text-center"><div><p className="text-lg font-medium">The room is quiet.</p><p className="mt-1 text-sm text-text-secondary">The first live conversation will appear here.</p></div></div>}</div><form onSubmit={submit} className="border-t border-white/10 p-5">{error && <p className="mb-3 rounded-lg bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}{notice && <p className="mb-3 rounded-lg bg-brand/10 p-3 text-sm text-brand">{notice}</p>}{data?.access.canPost ? <><label htmlFor="community-message" className="sr-only">Live chat message</label><textarea id="community-message" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={500} rows={2} placeholder="Add to the live conversation…" className="w-full resize-none rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-brand"/><div className="mt-3 flex items-center justify-between"><span className="text-xs text-text-secondary">{message.length}/500 · Be respectful. Posts can be reported.</span><button disabled={sending || !message.trim()} className="rounded-full bg-brand px-5 py-2 font-medium text-black disabled:opacity-50">{sending ? 'Sending…' : 'Send'}</button></div></> : <div className="rounded-xl border border-white/10 bg-black/20 p-4"><p className="font-medium">Premium chat</p><p className="mt-1 text-sm text-text-secondary">You can follow the room. Posting unlocks with an active BVS premium membership.</p><Link href="/contact" className="mt-3 inline-block text-sm text-brand hover:underline">Ask about premium access →</Link></div>}</form></div>
}
