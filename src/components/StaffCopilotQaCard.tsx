'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient, isSupabaseConfigured } from '@/lib/supabase'

type Health = {
  routeMounted: boolean
  tablesPresent: { threads: boolean; messages: boolean; audit: boolean }
  mode: 'stub' | 'model'
  auditCount24h: number | null
  lastSanitizedError: Record<string, unknown> | null
}

export default function StaffCopilotQaCard() {
  const [data, setData] = useState<Health | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isSupabaseConfigured()) return
    void createClient().auth.getSession().then(async ({ data: session }) => {
      const token = session.session?.access_token || ''
      if (!token) return
      const response = await fetch('/api/staff/copilot/health', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Copilot health unavailable.')
      setData(payload)
    }).catch(() => setError('Staff Copilot health unavailable.'))
  }, [])

  return (
    <section className="mx-auto mb-12 mt-[-1rem] max-w-6xl px-6">
      <div className="rounded-2xl border border-brand/30 bg-brand/5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-xs font-semibold uppercase tracking-[.16em] text-brand">Staff Copilot</p><h2 className="mt-1 text-xl font-semibold">Read-only ops assistant</h2></div>
          <Link href="/admin/copilot" className="rounded-full border border-brand/40 px-4 py-2 text-sm font-semibold text-brand">Open Ops Copilot →</Link>
        </div>
        {error ? <p className="mt-4 text-sm text-amber-100">{error}</p> : null}
        {data ? <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-white/10 p-3"><p className="text-xs uppercase tracking-[.12em] text-text-secondary">Route</p><p className="mt-1 font-semibold">{data.routeMounted ? 'mounted' : 'missing'}</p></div>
          <div className="rounded-xl border border-white/10 p-3"><p className="text-xs uppercase tracking-[.12em] text-text-secondary">Tables</p><p className="mt-1 font-semibold">{Object.values(data.tablesPresent).every(Boolean) ? 'present' : 'incomplete'}</p></div>
          <div className="rounded-xl border border-white/10 p-3"><p className="text-xs uppercase tracking-[.12em] text-text-secondary">Engine</p><p className="mt-1 font-semibold">{data.mode}</p></div>
          <div className="rounded-xl border border-white/10 p-3"><p className="text-xs uppercase tracking-[.12em] text-text-secondary">Audit 24h</p><p className="mt-1 font-semibold">{data.auditCount24h == null ? 'not tracked' : data.auditCount24h}</p></div>
        </div> : <p className="mt-4 text-sm text-text-secondary">Loading Staff Copilot health…</p>}
        {data?.lastSanitizedError ? <details className="mt-4"><summary className="cursor-pointer text-xs text-text-secondary">Last sanitized error</summary><pre className="mt-2 overflow-auto rounded-lg border border-white/10 p-3 text-[11px] text-text-secondary">{JSON.stringify(data.lastSanitizedError, null, 2)}</pre></details> : null}
      </div>
    </section>
  )
}
