'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase'

type QueueItem = {
  id: string
  artistUserId: string
  requestedAmount: number
  currency: string
  minimumAmountSnapshot: number
  status: string
  artistNote: string | null
  staffNote: string | null
  requestedAt: string | null
  approvedAt: string | null
  paidAt: string | null
  payoutReference: string | null
  artist: { displayName: string | null; username: string | null }
  method: {
    id: string
    methodType: string
    label: string
    currency: string
    accountHolderName: string | null
    destinationSummary: string | null
    isDefault: boolean
    status: string
  } | null
}

function money(value: number | string, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(value) || 0)
}

function human(value: string) {
  return value.replaceAll('_', ' ')
}

export default function EditorialPayoutQueuePage() {
  const [token, setToken] = useState('')
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [role, setRole] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [references, setReferences] = useState<Record<string, string>>({})

  const load = useCallback(async (accessToken: string) => {
    const response = await fetch('/api/admin/editorial/payouts', {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error || 'Could not load payout queue.')
    setQueue(payload.queue || [])
    setRole(payload.role || '')
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setError('Supabase is not configured.')
      setLoading(false)
      return
    }
    createClient().auth.getSession().then(async ({ data }) => {
      const accessToken = data.session?.access_token
      if (!accessToken) throw new Error('Sign in with an Editorial wallet account.')
      setToken(accessToken)
      await load(accessToken)
    }).catch((caught) => setError(caught instanceof Error ? caught.message : 'Could not load payout queue.')).finally(() => setLoading(false))
  }, [load])

  const counts = useMemo(() => ({
    requested: queue.filter((item) => item.status === 'requested').length,
    approved: queue.filter((item) => item.status === 'approved').length,
    processing: queue.filter((item) => item.status === 'processing').length,
    paid: queue.filter((item) => item.status === 'paid').length,
  }), [queue])

  async function transition(item: QueueItem, status: 'approved' | 'processing' | 'rejected' | 'paid') {
    if (!token) return
    const payoutReference = String(references[item.id] || '').trim()
    if (status === 'paid' && !payoutReference) {
      setError('Enter the external payment reference before marking a payout paid.')
      return
    }
    setBusyId(item.id); setError(''); setMessage('')
    try {
      const response = await fetch('/api/admin/editorial/payouts', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: item.id,
          status,
          staffNote: String(notes[item.id] || '').trim(),
          payoutReference: status === 'paid' ? payoutReference : undefined,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Could not update payout.')
      setQueue(payload.queue || [])
      setMessage(status === 'paid' ? 'Payout marked paid and wallet debit posted.' : `Payout moved to ${human(status)}.`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update payout.')
    } finally {
      setBusyId('')
    }
  }

  if (loading) return <main className="min-h-[65vh] p-20 text-center text-text-secondary">Loading payout queue…</main>

  return <main className="mx-auto max-w-7xl px-5 py-12 sm:px-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-brand">Editorial · Finance · Wallet</p>
        <h1 className="mt-2 text-4xl font-semibold">Payout queue</h1>
        <p className="mt-3 max-w-3xl text-text-secondary">Approve creator withdrawal requests, confirm transfer processing, and post the final wallet debit only after the external payment has a real reference.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/admin/editorial/finance" className="rounded-full border border-white/20 px-4 py-2 text-sm">Finance</Link>
        <Link href="/admin/editorial" className="rounded-full border border-white/20 px-4 py-2 text-sm">Editorial</Link>
      </div>
    </div>

    {role && <p className="mt-4 text-xs capitalize text-text-secondary">Signed in as {human(role)}</p>}
    {error && <p className="mt-6 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-red-200">{error}</p>}
    {message && <p className="mt-6 rounded-xl border border-brand/30 bg-brand/10 p-4 text-brand">{message}</p>}

    <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Metric label="Needs review" value={counts.requested} />
      <Metric label="Approved" value={counts.approved} />
      <Metric label="Processing" value={counts.processing} />
      <Metric label="Paid records" value={counts.paid} />
    </section>

    <section className="mt-8 space-y-4">
      {queue.length ? queue.map((item) => {
        const artistName = item.artist.displayName || item.artist.username || item.artistUserId.slice(0, 8)
        const busy = busyId === item.id
        return <article key={item.id} className="rounded-2xl border border-white/10 bg-white/[.025] p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-semibold">{artistName}</h2><span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] capitalize text-text-secondary">{human(item.status)}</span></div>
              <p className="mt-2 text-3xl font-semibold text-brand">{money(item.requestedAmount, item.currency)}</p>
              <p className="mt-1 text-xs text-text-secondary">Requested {item.requestedAt ? new Date(item.requestedAt).toLocaleString() : '—'} · minimum snapshot {money(item.minimumAmountSnapshot, item.currency)}</p>
            </div>
            <div className="min-w-[240px] rounded-xl border border-white/10 bg-black/20 p-4 text-sm">
              <p className="font-semibold">{item.method?.label || 'Payout method unavailable'}</p>
              <p className="mt-1 capitalize text-text-secondary">{item.method ? human(item.method.methodType) : '—'}</p>
              <p className="mt-1 text-text-secondary">{item.method?.destinationSummary || 'No destination summary'}</p>
              {item.method?.accountHolderName && <p className="mt-1 text-xs text-text-secondary">Holder: {item.method.accountHolderName}</p>}
            </div>
          </div>

          {item.artistNote && <p className="mt-4 rounded-xl border border-white/10 p-3 text-sm text-text-secondary"><span className="font-semibold text-text-primary">Creator note:</span> {item.artistNote}</p>}

          {!['paid', 'cancelled'].includes(item.status) && <div className="mt-5 grid gap-3 md:grid-cols-2">
            <label className="text-sm">Staff note<textarea value={notes[item.id] ?? item.staffNote ?? ''} onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))} maxLength={1000} className="mt-2 min-h-20 w-full rounded-xl border border-white/15 bg-black/30 p-3" placeholder="Review or transfer note" /></label>
            {item.status === 'processing' ? <label className="text-sm">External payment reference<input value={references[item.id] ?? ''} onChange={(event) => setReferences((current) => ({ ...current, [item.id]: event.target.value }))} maxLength={200} className="mt-2 min-h-11 w-full rounded-xl border border-white/15 bg-black/30 px-3" placeholder="Bank / PayPal / mobile-money transfer reference" /></label> : <div className="rounded-xl border border-white/10 p-3 text-sm text-text-secondary">The wallet balance is not debited during review or processing. It is debited atomically only when this request becomes <strong className="text-text-primary">paid</strong>.</div>}
          </div>}

          <div className="mt-5 flex flex-wrap gap-2">
            {item.status === 'requested' && <><button disabled={busy} onClick={() => void transition(item, 'approved')} className="min-h-10 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-black disabled:opacity-40">Approve</button><button disabled={busy} onClick={() => void transition(item, 'rejected')} className="min-h-10 rounded-full border border-red-400/30 px-4 py-2 text-sm text-red-200 disabled:opacity-40">Reject</button></>}
            {item.status === 'approved' && <><button disabled={busy} onClick={() => void transition(item, 'processing')} className="min-h-10 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-black disabled:opacity-40">Mark processing</button><button disabled={busy} onClick={() => void transition(item, 'rejected')} className="min-h-10 rounded-full border border-red-400/30 px-4 py-2 text-sm text-red-200 disabled:opacity-40">Reject</button></>}
            {item.status === 'processing' && <button disabled={busy} onClick={() => void transition(item, 'paid')} className="min-h-10 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-black disabled:opacity-40">{busy ? 'Posting…' : 'Mark paid + post debit'}</button>}
            {item.status === 'paid' && <span className="text-sm text-emerald-300">Paid {item.paidAt ? new Date(item.paidAt).toLocaleString() : ''}{item.payoutReference ? ` · ${item.payoutReference}` : ''}</span>}
            {item.status === 'cancelled' && <span className="text-sm text-text-secondary">Cancelled by creator before approval.</span>}
          </div>
        </article>
      }) : <div className="rounded-2xl border border-white/10 p-8 text-center text-text-secondary">No payout requests yet.</div>}
    </section>
  </main>
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[.025] p-5"><p className="text-xs uppercase tracking-[.12em] text-text-secondary">{label}</p><p className="mt-2 text-3xl font-semibold text-brand">{value}</p></div>
}
