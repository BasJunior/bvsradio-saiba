'use client'

import Link from 'next/link'
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase'

type PayoutMethod = {
  id: string
  methodType: string
  label: string
  currency: string
  accountHolderName: string | null
  destinationSummary: string | null
  isDefault: boolean
  status: string
}

type PayoutRequest = {
  id: string
  payoutMethodId: string | null
  requestedAmount: number
  currency: string
  status: string
  artistNote: string | null
  staffNote: string | null
  requestedAt: string | null
  paidAt: string | null
  payoutReference: string | null
}

type Snapshot = {
  settings: { payoutMinimumUsd: number; currency: string }
  balances: { available: number; reserved: number; withdrawable: number }
  methods: PayoutMethod[]
  requests: PayoutRequest[]
}

const EMPTY: Snapshot = {
  settings: { payoutMinimumUsd: 25, currency: 'USD' },
  balances: { available: 0, reserved: 0, withdrawable: 0 },
  methods: [],
  requests: [],
}

function money(value: number | string, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(value) || 0)
}

function label(value: string) {
  return value.replaceAll('_', ' ')
}

export default function CreatorPayoutsPage() {
  const configured = isSupabaseConfigured()
  const [token, setToken] = useState('')
  const [data, setData] = useState<Snapshot>(EMPTY)
  const [loading, setLoading] = useState(configured)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(configured ? '' : 'Account service is not configured.')
  const [message, setMessage] = useState('')
  const [amount, setAmount] = useState('')
  const [methodId, setMethodId] = useState('')
  const [note, setNote] = useState('')
  const [methodForm, setMethodForm] = useState({ methodType: 'mobile_money', label: '', destination: '', accountHolderName: '', currency: 'USD' })

  const load = useCallback(async (accessToken: string) => {
    const response = await fetch('/api/artist/payouts', {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error || 'Could not load payouts.')
    setData({ ...EMPTY, ...payload, balances: { ...EMPTY.balances, ...(payload.balances || {}) }, settings: { ...EMPTY.settings, ...(payload.settings || {}) }, methods: payload.methods || [], requests: payload.requests || [] })
    const preferred = (payload.methods || []).find((method: PayoutMethod) => method.isDefault && method.status === 'active') || (payload.methods || []).find((method: PayoutMethod) => method.status === 'active')
    if (preferred) setMethodId((current) => current || preferred.id)
  }, [])

  useEffect(() => {
    if (!configured) return
    createClient().auth.getSession().then(async ({ data: sessionData }) => {
      const accessToken = sessionData.session?.access_token
      if (!accessToken) { setError('Sign in to manage payouts.'); setLoading(false); return }
      setToken(accessToken)
      try { await load(accessToken) }
      catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not load payouts.') }
      finally { setLoading(false) }
    })
  }, [configured, load])

  const activeMethods = useMemo(() => data.methods.filter((method) => method.status === 'active'), [data.methods])
  const canRequest = data.balances.withdrawable >= data.settings.payoutMinimumUsd && activeMethods.length > 0

  async function addMethod(event: FormEvent) {
    event.preventDefault()
    if (!token) return
    setBusy(true); setError(''); setMessage('')
    try {
      const response = await fetch('/api/artist/payout-methods', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(methodForm),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Could not save payout method.')
      setData(payload.snapshot || EMPTY)
      const preferred = payload.snapshot?.methods?.find((method: PayoutMethod) => method.isDefault) || payload.snapshot?.methods?.[0]
      if (preferred) setMethodId(preferred.id)
      setMethodForm({ methodType: 'mobile_money', label: '', destination: '', accountHolderName: '', currency: 'USD' })
      setMessage('Payout method saved.')
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not save payout method.') }
    finally { setBusy(false) }
  }

  async function requestPayout(event: FormEvent) {
    event.preventDefault()
    if (!token) return
    setBusy(true); setError(''); setMessage('')
    try {
      const response = await fetch('/api/artist/payouts', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ payoutMethodId: methodId, amount, note }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Could not request payout.')
      setData(payload.snapshot || EMPTY)
      setAmount(''); setNote('')
      setMessage('Payout request submitted for BVS wallet review.')
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not request payout.') }
    finally { setBusy(false) }
  }

  async function methodAction(id: string, action: 'default' | 'disable') {
    if (!token) return
    setBusy(true); setError(''); setMessage('')
    try {
      const response = await fetch('/api/artist/payout-methods', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ methodId: id, action }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Could not update payout method.')
      setData(payload.snapshot || EMPTY)
      setMessage(action === 'default' ? 'Default payout method updated.' : 'Payout method disabled.')
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not update payout method.') }
    finally { setBusy(false) }
  }

  async function cancelRequest(id: string) {
    if (!token) return
    setBusy(true); setError(''); setMessage('')
    try {
      const response = await fetch('/api/artist/payouts', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: id, action: 'cancel' }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Could not cancel payout.')
      setData(payload.snapshot || EMPTY)
      setMessage('Payout request cancelled and its reserved amount released.')
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not cancel payout.') }
    finally { setBusy(false) }
  }

  if (loading) return <main className="min-h-[65vh] p-20 text-center text-text-secondary">Loading payouts…</main>

  return <main className="mx-auto max-w-6xl px-5 py-12 sm:px-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-semibold uppercase tracking-[.18em] text-brand">Creator Studio · Money</p><h1 className="mt-2 text-4xl font-semibold">Payouts</h1><p className="mt-3 max-w-3xl text-text-secondary">Request withdrawals from posted wallet balance. Active requests reserve balance immediately so the same earnings cannot be withdrawn twice.</p></div>
      <div className="flex gap-2"><Link href="/creator/studio" className="rounded-full border border-white/20 px-4 py-2 text-sm">Studio</Link><Link href="/artists" className="rounded-full border border-white/20 px-4 py-2 text-sm">Full wallet</Link></div>
    </div>

    {error && <p className="mt-6 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-red-200">{error}</p>}
    {message && <p className="mt-6 rounded-xl border border-brand/30 bg-brand/10 p-4 text-brand">{message}</p>}

    <section className="mt-8 grid gap-3 sm:grid-cols-3">
      <Metric label="Posted balance" value={money(data.balances.available, data.settings.currency)} note="Posted credits minus posted debits" />
      <Metric label="Reserved for payouts" value={money(data.balances.reserved, data.settings.currency)} note="Requested, approved or processing" />
      <Metric label="Withdrawable now" value={money(data.balances.withdrawable, data.settings.currency)} note={`Minimum request ${money(data.settings.payoutMinimumUsd, data.settings.currency)}`} strong />
    </section>

    <section className="mt-8 grid gap-6 lg:grid-cols-2">
      <form onSubmit={requestPayout} className="rounded-2xl border border-brand/25 bg-brand/[.05] p-6">
        <p className="text-xs font-semibold uppercase tracking-[.16em] text-brand">Request payout</p>
        <h2 className="mt-1 text-2xl font-semibold">Withdraw posted earnings</h2>
        <label className="mt-5 block text-sm">Payout method<select value={methodId} onChange={(event) => setMethodId(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-white/15 bg-black/30 px-3" required><option value="">Choose method</option>{activeMethods.map((method) => <option key={method.id} value={method.id}>{method.label} · {method.destinationSummary}</option>)}</select></label>
        <label className="mt-4 block text-sm">Amount<input value={amount} onChange={(event) => setAmount(event.target.value)} type="number" min={data.settings.payoutMinimumUsd} max={data.balances.withdrawable || undefined} step="0.01" placeholder={String(data.settings.payoutMinimumUsd)} className="mt-2 min-h-11 w-full rounded-xl border border-white/15 bg-black/30 px-3" required /></label>
        <label className="mt-4 block text-sm">Note to payout team<textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} className="mt-2 min-h-24 w-full rounded-xl border border-white/15 bg-black/30 p-3" placeholder="Optional reference or payout note" /></label>
        <button disabled={busy || !canRequest} className="mt-5 min-h-11 rounded-full bg-brand px-5 py-2 font-semibold text-black disabled:opacity-40">{busy ? 'Saving…' : 'Request payout'}</button>
        {!canRequest && <p className="mt-3 text-xs text-text-secondary">You need an active payout method and at least {money(data.settings.payoutMinimumUsd, data.settings.currency)} withdrawable balance.</p>}
      </form>

      <form onSubmit={addMethod} className="rounded-2xl border border-white/10 p-6">
        <p className="text-xs font-semibold uppercase tracking-[.16em] text-brand">Payout destination</p>
        <h2 className="mt-1 text-2xl font-semibold">Add a method</h2>
        <p className="mt-2 text-sm text-text-secondary">This first path supports staff-assisted PayPal, mobile-money, Paynow and other destinations. Raw bank-account secrets are not stored here.</p>
        <label className="mt-5 block text-sm">Type<select value={methodForm.methodType} onChange={(event) => setMethodForm({ ...methodForm, methodType: event.target.value })} className="mt-2 min-h-11 w-full rounded-xl border border-white/15 bg-black/30 px-3"><option value="mobile_money">Mobile money</option><option value="paypal">PayPal</option><option value="paynow">Paynow / supported wallet</option><option value="other">Other staff-assisted method</option></select></label>
        <label className="mt-4 block text-sm">Label<input value={methodForm.label} onChange={(event) => setMethodForm({ ...methodForm, label: event.target.value })} className="mt-2 min-h-11 w-full rounded-xl border border-white/15 bg-black/30 px-3" placeholder="e.g. EcoCash personal" required /></label>
        <label className="mt-4 block text-sm">Destination<input value={methodForm.destination} onChange={(event) => setMethodForm({ ...methodForm, destination: event.target.value })} className="mt-2 min-h-11 w-full rounded-xl border border-white/15 bg-black/30 px-3" placeholder="Phone, PayPal email, or payout handle" required /></label>
        <label className="mt-4 block text-sm">Account holder<input value={methodForm.accountHolderName} onChange={(event) => setMethodForm({ ...methodForm, accountHolderName: event.target.value })} className="mt-2 min-h-11 w-full rounded-xl border border-white/15 bg-black/30 px-3" placeholder="Optional" /></label>
        <button disabled={busy} className="mt-5 min-h-11 rounded-full border border-brand/50 px-5 py-2 font-semibold text-brand disabled:opacity-40">Add method</button>
      </form>
    </section>

    <section className="mt-10 rounded-2xl border border-white/10 p-6">
      <h2 className="text-2xl font-semibold">Payout methods</h2>
      {data.methods.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2">{data.methods.map((method) => <div key={method.id} className="rounded-xl border border-white/10 bg-white/[.025] p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{method.label}</p><p className="mt-1 text-sm text-text-secondary">{label(method.methodType)} · {method.destinationSummary || 'No destination summary'}</p></div>{method.isDefault && method.status === 'active' ? <span className="rounded-full border border-brand/30 px-2 py-1 text-[10px] uppercase text-brand">Default</span> : null}</div><div className="mt-4 flex gap-2">{method.status === 'active' && !method.isDefault ? <button disabled={busy} onClick={() => void methodAction(method.id, 'default')} type="button" className="rounded-full border border-white/15 px-3 py-1.5 text-xs">Make default</button> : null}{method.status === 'active' ? <button disabled={busy} onClick={() => void methodAction(method.id, 'disable')} type="button" className="rounded-full border border-red-400/25 px-3 py-1.5 text-xs text-red-200">Disable</button> : <span className="text-xs capitalize text-text-secondary">{label(method.status)}</span>}</div></div>)}</div> : <p className="mt-4 text-sm text-text-secondary">No payout method yet.</p>}
    </section>

    <section className="mt-10 rounded-2xl border border-white/10 p-6">
      <h2 className="text-2xl font-semibold">Payout history</h2>
      {data.requests.length ? <div className="mt-4 overflow-x-auto"><table className="min-w-[760px] w-full text-left text-sm"><thead className="text-xs uppercase tracking-[.08em] text-text-secondary"><tr><th className="pb-3">Requested</th><th className="pb-3">Amount</th><th className="pb-3">Status</th><th className="pb-3">Reference</th><th className="pb-3">Action</th></tr></thead><tbody>{data.requests.map((request) => <tr key={request.id} className="border-t border-white/10"><td className="py-4">{request.requestedAt ? new Date(request.requestedAt).toLocaleString() : '—'}</td><td className="py-4 font-semibold">{money(request.requestedAmount, request.currency)}</td><td className="py-4 capitalize">{label(request.status)}</td><td className="py-4 text-text-secondary">{request.payoutReference || request.staffNote || '—'}</td><td className="py-4">{request.status === 'requested' ? <button disabled={busy} onClick={() => void cancelRequest(request.id)} className="rounded-full border border-white/15 px-3 py-1.5 text-xs">Cancel</button> : '—'}</td></tr>)}</tbody></table></div> : <p className="mt-4 text-sm text-text-secondary">No payout requests yet.</p>}
    </section>
  </main>
}

function Metric({ label, value, note, strong = false }: { label: string; value: string; note: string; strong?: boolean }) {
  return <div className={`rounded-2xl border p-5 ${strong ? 'border-brand/35 bg-brand/[.05]' : 'border-white/10 bg-white/[.025]'}`}><p className="text-xs uppercase tracking-[.12em] text-text-secondary">{label}</p><p className={`mt-2 text-2xl font-semibold ${strong ? 'text-brand' : ''}`}>{value}</p><p className="mt-2 text-xs text-text-secondary">{note}</p></div>
}
