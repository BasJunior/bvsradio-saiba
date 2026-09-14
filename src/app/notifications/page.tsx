'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient, isSupabaseConfigured } from '@/lib/supabase'

type NotificationEvent = {
  id: string
  title: string
  detail: string
  created_at: string
  href: string
  kind: string
  notificationId?: string
  read_at?: string | null
  marketplaceEntity?: 'profile' | 'listing'
  marketplaceEntityId?: string
  canReply?: boolean
}

export default function NotificationsPage() {
  const configured = isSupabaseConfigured()
  const [events, setEvents] = useState<NotificationEvent[]>([])
  const [loading, setLoading] = useState(configured)
  const [error, setError] = useState(configured ? '' : 'Notification service unavailable.')
  const [replies, setReplies] = useState<Record<string, string>>({})
  const [sending, setSending] = useState('')
  const [replyNotice, setReplyNotice] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!configured) return
    createClient().auth.getSession().then(async ({ data }) => {
      const token = data.session?.access_token
      if (!token) {
        setError('Sign in to view notifications.')
        setLoading(false)
        return
      }
      const [response, social, marketplace] = await Promise.all([
        fetch('/api/notifications', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }),
        fetch('/api/app/participation/notifications?limit=50', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }),
        fetch('/api/marketplace/messages/notifications', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }),
      ])
      const payload = await response.json()
      const community = social.ok ? await social.json() : { events: [] }
      const marketplacePayload = marketplace.ok ? await marketplace.json() : { events: [] }
      if (!social.ok) setError('Community updates could not be loaded. Please retry.')
      if (!response.ok) setError(payload.error || 'Could not load notifications.')
      else {
        setEvents([...(payload.events || []), ...(community.events || []), ...(marketplacePayload.events || [])].sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at)))
        window.localStorage.setItem(`bvs_notifications_seen_at:${data.session?.user.id}`, new Date().toISOString())
        window.dispatchEvent(new Event('bvs:notifications-seen'))
      }
      setLoading(false)
    })
  }, [configured])

  async function markRead(event: NotificationEvent) {
    if (!event.notificationId) return
    const { data } = await createClient().auth.getSession()
    if (!data.session) return
    const response = await fetch('/api/app/participation/notifications', { method: 'PATCH', headers: {Authorization: `Bearer ${data.session.access_token}`, 'Content-Type':'application/json'}, body:JSON.stringify({ids:[event.notificationId],read:true}) })
    if (response.ok) window.dispatchEvent(new Event('bvs:notifications-seen'))
  }

  async function replyToMarketplace(event: NotificationEvent) {
    const message = (replies[event.id] || '').trim()
    if (!message || !event.marketplaceEntity || !event.marketplaceEntityId) return
    setSending(event.id)
    setReplyNotice(current => ({ ...current, [event.id]: '' }))
    const { data } = await createClient().auth.getSession()
    if (!data.session) {
      setReplyNotice(current => ({ ...current, [event.id]: 'Sign in again to reply.' }))
      setSending('')
      return
    }
    const response = await fetch('/api/marketplace/messages', {
      method: 'POST',
      headers: { Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity: event.marketplaceEntity, entityId: event.marketplaceEntityId, message }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) setReplyNotice(current => ({ ...current, [event.id]: payload.error || 'Could not send your reply.' }))
    else {
      setReplies(current => ({ ...current, [event.id]: '' }))
      setReplyNotice(current => ({ ...current, [event.id]: 'Reply sent to Editorial.' }))
    }
    setSending('')
  }

  return <main className="mx-auto min-h-[70vh] max-w-4xl px-6 py-12">
    <p className="text-xs uppercase tracking-[.22em] text-brand">Your BVS</p>
    <h1 className="mt-2 text-4xl font-semibold">Notifications</h1>
    <p className="mt-3 text-text-secondary">Review messages, approvals, submissions, orders and creator workflow updates appear here.</p>
    {loading && <p className="mt-10 text-text-secondary">Loading notifications…</p>}
    {error && <div className="mt-8 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-red-200">{error}<div className="mt-3"><Link href="/auth/login?next=/notifications" className="text-brand">Sign in →</Link></div></div>}
    {!loading && !error && <div className="mt-8 space-y-3">{events.map(event => <article key={event.id} className="rounded-2xl border border-white/10 bg-white/[.025] p-5 hover:border-brand/40">
      <Link onClick={() => void markRead(event)} href={event.href || '/account'} className="block">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-wider text-brand">{event.kind.replaceAll('_', ' ')}</p><h2 className="mt-1 font-semibold">{event.title}</h2><p className="mt-2 whitespace-pre-wrap text-sm text-text-secondary">{event.detail}</p></div><time className="text-xs text-text-secondary" dateTime={event.created_at}>{new Date(event.created_at).toLocaleString()}</time></div>
      </Link>
      {event.canReply && event.marketplaceEntity && event.marketplaceEntityId ? <div className="mt-4 border-t border-white/10 pt-4">
        <label className="text-xs font-medium text-text-secondary" htmlFor={`reply-${event.id}`}>Reply to Editorial</label>
        <textarea id={`reply-${event.id}`} maxLength={2000} rows={3} value={replies[event.id] || ''} onChange={e => setReplies(current => ({ ...current, [event.id]: e.target.value }))} placeholder="Type your Marketplace reply" className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm" />
        <div className="mt-2 flex flex-wrap items-center gap-3"><button type="button" disabled={sending === event.id || !(replies[event.id] || '').trim()} onClick={() => void replyToMarketplace(event)} className="rounded-full bg-brand px-4 py-2 text-xs font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40">{sending === event.id ? 'Sending…' : 'Send reply'}</button>{replyNotice[event.id] ? <span role="status" className="text-xs text-text-secondary">{replyNotice[event.id]}</span> : null}</div>
      </div> : null}
    </article>)}{!events.length && <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center"><h2 className="text-xl">You’re all caught up</h2><p className="mt-2 text-text-secondary">New BVS workflow updates will appear here.</p></div>}</div>}
  </main>
}
