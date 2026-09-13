'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient, isSupabaseConfigured } from '@/lib/supabase'

type NotificationEvent = { id: string; title: string; detail: string; created_at: string; href: string; kind: string; notificationId?: string; read_at?: string | null }

export default function NotificationsPage() {
  const configured = isSupabaseConfigured()
  const [events, setEvents] = useState<NotificationEvent[]>([])
  const [loading, setLoading] = useState(configured)
  const [error, setError] = useState(configured ? '' : 'Notification service unavailable.')

  useEffect(() => {
    if (!configured) return
    createClient().auth.getSession().then(async ({ data }) => {
      const token = data.session?.access_token
      if (!token) {
        setError('Sign in to view notifications.')
        setLoading(false)
        return
      }
      const [response, social] = await Promise.all([
        fetch('/api/notifications', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }),
        fetch('/api/app/participation/notifications?limit=50', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }),
      ])
      const payload = await response.json()
      const community = social.ok ? await social.json() : { events: [] }
      if (!social.ok) setError('Community updates could not be loaded. Please retry.')
      if (!response.ok) setError(payload.error || 'Could not load notifications.')
      else {
        setEvents([...(payload.events || []), ...(community.events || [])].sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at)))
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

  return <main className="mx-auto min-h-[70vh] max-w-4xl px-6 py-12">
    <p className="text-xs uppercase tracking-[.22em] text-brand">Your BVS</p>
    <h1 className="mt-2 text-4xl font-semibold">Notifications</h1>
    <p className="mt-3 text-text-secondary">Review messages, approvals, submissions, orders and creator workflow updates appear here.</p>
    {loading && <p className="mt-10 text-text-secondary">Loading notifications…</p>}
    {error && <div className="mt-8 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-red-200">{error}<div className="mt-3"><Link href="/auth/login?next=/notifications" className="text-brand">Sign in →</Link></div></div>}
    {!loading && !error && <div className="mt-8 space-y-3">{events.map(event => <Link key={event.id} onClick={() => void markRead(event)} href={event.href || '/account'} className="block rounded-2xl border border-white/10 bg-white/[.025] p-5 hover:border-brand/40"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-wider text-brand">{event.kind}</p><h2 className="mt-1 font-semibold">{event.title}</h2><p className="mt-2 whitespace-pre-wrap text-sm text-text-secondary">{event.detail}</p></div><time className="text-xs text-text-secondary" dateTime={event.created_at}>{new Date(event.created_at).toLocaleString()}</time></div></Link>)}{!events.length && <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center"><h2 className="text-xl">You’re all caught up</h2><p className="mt-2 text-text-secondary">New BVS workflow updates will appear here.</p></div>}</div>}
  </main>
}
