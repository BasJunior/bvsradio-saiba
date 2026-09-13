'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase'

type Profile = { id: string; username: string | null; displayName: string; avatarUrl: string | null }
type Report = {
  id: string
  reason: string
  details: string | null
  status: 'open' | 'reviewing' | 'resolved' | 'dismissed'
  createdAt: string
  reviewedAt: string | null
  reporter: Profile
  reported: Profile | null
  reviewOwner: Profile | null
  thread: { id: string; thread_type: string; object_title?: string | null; status: string } | null
  message: { id: string; thread_id: string; body: string; status: string; message_kind: string } | null
}

type QueuePayload = { enabled: boolean; role?: string; reports: Report[] }
type Action = 'review' | 'hide' | 'restore' | 'lock' | 'unlock' | 'delete' | 'resolve_report' | 'dismiss_report'

const labels: Record<string, string> = {
  harassment: 'Harassment',
  spam: 'Spam',
  harmful_content: 'Harmful content',
  rights_concern: 'Rights concern',
  other: 'Other',
}

function timeLabel(value: string) {
  try { return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) } catch { return value }
}

export default function ParticipationModerationPage() {
  const [payload, setPayload] = useState<QueuePayload | null>(null)
  const [status, setStatus] = useState<'active' | 'resolved' | 'dismissed'>('active')
  const [reason, setReason] = useState('Reviewed under BVS community rules.')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const token = useCallback(async () => {
    if (!isSupabaseConfigured()) return null
    const { data } = await createClient().auth.getSession()
    return data.session?.access_token || null
  }, [])

  const load = useCallback(async () => {
    setError('')
    const accessToken = await token()
    if (!accessToken) { setError('Sign in with an active Editorial staff account.'); return }
    const query = status === 'active' ? 'open,reviewing' : status
    const response = await fetch(`/api/admin/participation/moderation?status=${encodeURIComponent(query)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    }).catch(() => null)
    const data = response ? await response.json().catch(() => ({})) as QueuePayload & { error?: string } : null
    if (!response?.ok || !data) { setError(data?.error || 'Could not load the moderation queue.'); return }
    setPayload(data)
  }, [status, token])

  useEffect(() => { void load() }, [load])

  const reports = useMemo(() => payload?.reports || [], [payload])

  const act = async (report: Report, action: Action) => {
    const accessToken = await token()
    if (!accessToken || busy) return
    if (action !== 'review' && !reason.trim()) { setError('Add a moderation reason first.'); return }
    setBusy(`${report.id}:${action}`)
    setError('')
    setMessage('')
    const response = await fetch('/api/admin/participation/moderation', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportId: report.id, action, reason: reason.trim() }),
    }).catch(() => null)
    const data = response ? await response.json().catch(() => ({})) as { error?: string } : {}
    if (!response?.ok) setError(data.error || 'Moderation action failed.')
    else { setMessage('Moderation action recorded.'); await load() }
    setBusy(null)
  }

  return <main className="mx-auto min-h-screen max-w-6xl px-4 pb-16 pt-8 sm:px-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-brand">Editorial · Participation</p>
        <h1 className="mt-2 text-4xl font-semibold sm:text-5xl">Community moderation</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/45">Review member reports with explicit ownership, reversible actions and an immutable moderation audit trail.</p>
      </div>
      <Link href="/admin/editorial" className="min-h-11 rounded-full border border-white/10 px-4 py-2.5 text-sm text-white/60 hover:border-white/20 hover:text-white">Back to Editorial</Link>
    </div>

    <div className="mt-7 flex flex-wrap gap-2">
      {(['active', 'resolved', 'dismissed'] as const).map((item) => <button key={item} type="button" onClick={() => setStatus(item)} className={`min-h-10 rounded-full border px-4 text-sm font-semibold ${status === item ? 'border-brand/40 bg-brand/[.08] text-brand' : 'border-white/10 text-white/45'}`}>{item === 'active' ? 'Open / reviewing' : item}</button>)}
      {payload?.role ? <span className="ml-auto rounded-full border border-white/10 px-3 py-2 text-xs text-white/35">Role: {payload.role}</span> : null}
    </div>

    <label className="mt-5 block rounded-2xl border border-white/[.08] bg-white/[.025] p-4">
      <span className="text-xs font-semibold uppercase tracking-[.14em] text-white/40">Audit reason for content actions</span>
      <textarea value={reason} onChange={(event) => setReason(event.target.value.slice(0, 500))} rows={2} className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-brand/40" />
    </label>

    {error ? <p className="mt-4 rounded-xl border border-red-400/20 bg-red-500/[.07] p-3 text-sm text-red-200">{error}</p> : null}
    {message ? <p className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-500/[.06] p-3 text-sm text-emerald-200">{message}</p> : null}

    <div className="mt-6 space-y-3">
      {reports.map((report) => {
        const locked = report.thread?.status === 'locked'
        const hidden = report.message?.status === 'hidden' || report.thread?.status === 'hidden'
        return <article key={report.id} className="rounded-[1.4rem] border border-white/[.08] bg-white/[.02] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs"><span className="rounded-full border border-brand/25 bg-brand/[.06] px-2.5 py-1 font-semibold text-brand">{labels[report.reason] || report.reason}</span><span className="text-white/30">{report.status}</span></div>
              <h2 className="mt-3 text-lg font-semibold">{report.reported?.displayName || 'Reported BVS content'}</h2>
              <p className="mt-1 text-xs text-white/35">Reported by {report.reporter.displayName} · {timeLabel(report.createdAt)}</p>
            </div>
            {report.reviewOwner ? <span className="text-xs text-white/35">Owner: {report.reviewOwner.displayName}</span> : null}
          </div>

          {report.details ? <p className="mt-4 rounded-xl bg-black/20 p-3 text-sm leading-6 text-white/60">{report.details}</p> : null}
          {report.message ? <div className="mt-3 rounded-xl border border-white/[.07] bg-black/20 p-3"><p className="text-[10px] uppercase tracking-[.14em] text-white/30">Reported message · {report.message.status}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/65">{report.message.body}</p></div> : null}
          {!report.message && report.thread ? <div className="mt-3 rounded-xl border border-white/[.07] bg-black/20 p-3"><p className="text-[10px] uppercase tracking-[.14em] text-white/30">Conversation · {report.thread.status}</p><p className="mt-2 text-sm text-white/65">{report.thread.object_title || report.thread.id}</p></div> : null}

          <div className="mt-4 flex flex-wrap gap-2">
            {report.status === 'open' ? <button type="button" disabled={Boolean(busy)} onClick={() => void act(report, 'review')} className="min-h-10 rounded-full border border-[#7BA9D0]/35 px-3 text-xs font-semibold text-[#a8c9e5] disabled:opacity-40">Claim review</button> : null}
            {hidden ? <button type="button" disabled={Boolean(busy)} onClick={() => void act(report, 'restore')} className="min-h-10 rounded-full border border-emerald-400/30 px-3 text-xs font-semibold text-emerald-200 disabled:opacity-40">Restore</button> : <button type="button" disabled={Boolean(busy)} onClick={() => void act(report, 'hide')} className="min-h-10 rounded-full border border-amber-400/30 px-3 text-xs font-semibold text-amber-200 disabled:opacity-40">Hide</button>}
            {report.thread ? <button type="button" disabled={Boolean(busy)} onClick={() => void act(report, locked ? 'unlock' : 'lock')} className="min-h-10 rounded-full border border-white/15 px-3 text-xs font-semibold text-white/60 disabled:opacity-40">{locked ? 'Unlock' : 'Lock thread'}</button> : null}
            <button type="button" disabled={Boolean(busy)} onClick={() => void act(report, 'delete')} className="min-h-10 rounded-full border border-red-400/25 px-3 text-xs font-semibold text-red-200 disabled:opacity-40">Delete content</button>
            <span className="mx-1 hidden h-10 w-px bg-white/10 sm:block" />
            <button type="button" disabled={Boolean(busy)} onClick={() => void act(report, 'resolve_report')} className="min-h-10 rounded-full bg-brand px-4 text-xs font-bold text-black disabled:opacity-40">Resolve report</button>
            <button type="button" disabled={Boolean(busy)} onClick={() => void act(report, 'dismiss_report')} className="min-h-10 rounded-full border border-white/10 px-3 text-xs text-white/45 disabled:opacity-40">Dismiss</button>
          </div>
        </article>
      })}
    </div>

    {!error && !reports.length ? <div className="mt-8 rounded-[1.5rem] border border-dashed border-white/10 p-10 text-center"><h2 className="text-xl font-semibold">Queue clear.</h2><p className="mt-2 text-sm text-white/38">No reports match this view.</p></div> : null}
  </main>
}
