'use client'

import { loadNotificationInbox, mergeNotificationInbox } from '@/lib/notification-inbox'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient, isSupabaseConfigured } from '@/lib/supabase'
import './notifications.css'

type NotificationEvent = {
  id: string
  source?: "operations" | "participation" | "marketplace"
  title: string
  detail: string
  created_at: string
  href: string
  kind: string
  notificationId?: string
  seen_at?: string | null
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
  const [refreshing, setRefreshing] = useState(false)
  const [reload, setReload] = useState(0)
  const [replies, setReplies] = useState<Record<string, string>>({})
  const [sending, setSending] = useState('')
  const [replyNotice, setReplyNotice] = useState<Record<string, string>>({})
  const [activeCategory, setActiveCategory] = useState('all')
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!configured) return
    let alive = true, pending = false
    const controller = new AbortController()
    const refresh = async () => {
      if (pending || !alive || document.visibilityState === 'hidden') return
      pending = true; setRefreshing(true)
      try {
        const { data } = await createClient().auth.getSession()
        if (!alive) return
        const token = data.session?.access_token
        if (!token) { setEvents([]); setError('Sign in to view notifications.'); return }
        const result = await loadNotificationInbox(token, undefined, controller.signal)
        if (!alive) return
        setEvents(current => mergeNotificationInbox(current, result.loaded))
        setError(result.failed === result.total ? 'Could not load notifications. Please retry.' : result.failed ? 'Some updates could not be loaded. Available updates are shown below.' : '')
      } catch { if (alive) setError('Could not load notifications. Please retry.') }
      finally { pending = false; if (alive) { setLoading(false); setRefreshing(false) } }
    }
    void refresh()
    const onRefresh = () => void refresh()
    const timer = window.setInterval(onRefresh, 60000)
    document.addEventListener('visibilitychange', onRefresh)
    const { data } = createClient().auth.onAuthStateChange(() => { setEvents([]); void refresh() })
    return () => { alive = false; controller.abort(); window.clearInterval(timer); document.removeEventListener('visibilitychange', onRefresh); data.subscription.unsubscribe() }
  }, [configured, reload])

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

  const categoryFor = (event: NotificationEvent) => {
    if (event.source === 'marketplace' || event.kind === 'order') return 'orders'
    if (event.source === 'participation') return 'community'
    if (['track', 'release', 'beat', 'request', 'message', 'rights', 'payout', 'writer', 'article', 'show', 'episode'].includes(event.kind)) return 'editorial'
    return 'account'
  }
  const categoryMeta = [
    { id: 'all', label: 'All activity', icon: '✦' },
    { id: 'editorial', label: 'Editorial', icon: '↗' },
    { id: 'orders', label: 'Orders & wallet', icon: '$' },
    { id: 'community', label: 'Community', icon: '◉' },
    { id: 'account', label: 'Account', icon: '⚙' },
  ]
  const filteredEvents = events.filter((event) => {
    const matchesCategory = activeCategory === 'all' || categoryFor(event) === activeCategory
    const text = `${event.title} ${event.detail} ${event.kind}`.toLowerCase()
    return matchesCategory && (!query.trim() || text.includes(query.trim().toLowerCase()))
  })
  const categoryCount = (id: string) => id === 'all' ? events.length : events.filter((event) => categoryFor(event) === id).length
  const isNew = (event: NotificationEvent) => event.source === 'participation' && !event.seen_at && !event.read_at

  return <main className="bvs-notifications-page mx-auto min-h-[70vh] max-w-5xl px-6 py-12">
    <header className="bvs-notifications-hero"><div><p className="bvs-notifications-eyebrow">Your BVS inbox</p><h1>Notifications</h1><p>Keep up with editorial, orders, community conversations, and account updates in one place.</p></div><button type="button" disabled={refreshing} onClick={() => setReload(current => current + 1)} className="bvs-notifications-refresh">{refreshing ? 'Refreshing…' : 'Refresh inbox ↻'}</button></header>
    {loading && <p className="mt-10 text-text-secondary">Loading notifications…</p>}
    {error && <div className="mt-8 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-red-200">{error}<div className="mt-3"><Link href="/auth/login?next=/notifications" className="text-brand">Sign in →</Link></div></div>}
    {!loading && <div className="bvs-notifications-shell">
      <nav className="bvs-notifications-tabs" aria-label="Notification categories">{categoryMeta.map((category) => <button type="button" key={category.id} aria-pressed={activeCategory === category.id} onClick={() => setActiveCategory(category.id)}><span>{category.icon}</span>{category.label}<b>{categoryCount(category.id)}</b></button>)}</nav>
      <div className="bvs-notifications-toolbar"><label><span className="sr-only">Search notifications</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search notifications" /></label><span>{filteredEvents.length} update{filteredEvents.length === 1 ? '' : 's'}</span></div>
      <div className="space-y-3">{filteredEvents.map(event => <article key={event.id} className={`bvs-notification-card ${isNew(event) ? 'is-new' : ''}`}>
      <Link href={event.href || '/account'} aria-label={event.title} className="block">
        <div className="flex flex-wrap items-start gap-3"><span className="bvs-notification-icon">{categoryMeta.find((item) => item.id === categoryFor(event))?.icon || '•'}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="bvs-notification-category">{categoryMeta.find((item) => item.id === categoryFor(event))?.label}</p>{isNew(event) && <span className="bvs-notification-new">New</span>}</div><h2 className="mt-1 font-semibold">{event.title}</h2><p className="mt-2 whitespace-pre-wrap text-sm text-text-secondary">{event.detail}</p></div><time className="text-xs text-text-secondary" dateTime={event.created_at}>{new Date(event.created_at).toLocaleString()}</time></div>
      </Link>
      {event.canReply && event.marketplaceEntity && event.marketplaceEntityId ? <div className="mt-4 border-t border-white/10 pt-4">
        <label className="text-xs font-medium text-text-secondary" htmlFor={`reply-${event.id}`}>Reply to Editorial</label>
        <textarea id={`reply-${event.id}`} maxLength={2000} rows={3} value={replies[event.id] || ''} onChange={e => setReplies(current => ({ ...current, [event.id]: e.target.value }))} placeholder="Type your Marketplace reply" className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm" />
        <div className="mt-2 flex flex-wrap items-center gap-3"><button type="button" disabled={sending === event.id || !(replies[event.id] || '').trim()} onClick={() => void replyToMarketplace(event)} className="rounded-full bg-brand px-4 py-2 text-xs font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40">{sending === event.id ? 'Sending…' : 'Send reply'}</button>{replyNotice[event.id] ? <span role="status" className="text-xs text-text-secondary">{replyNotice[event.id]}</span> : null}</div>
      </div> : null}
    </article>)}{!error && !filteredEvents.length && <div className="bvs-notifications-empty"><h2>{events.length ? 'No updates in this category' : 'You’re all caught up'}</h2><p>{events.length ? 'Try another category or search term.' : 'New BVS workflow updates will appear here.'}</p></div>}</div></div>}
  </main>
}