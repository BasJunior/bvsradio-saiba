'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient, isSupabaseConfigured } from '@/lib/supabase'

type WalletData = {
  profile: { username?: string; display_name?: string; role?: string; is_verified?: boolean; is_published?: boolean } | null
  waitlist: { artist_name: string; status: string; created_at: string } | null
  deposits: Array<{ id: string; amount: number | string; currency: string; status: string; source: string; created_at: string }>
  ledger: Array<{ id: string; direction: string; entry_type: string; amount: number | string; currency: string; status: string; memo?: string; effective_at: string }>
  payoutRequests: Array<{ id: string; requested_amount: number | string; currency: string; status: string; requested_at: string }>
  settings: { payoutMinimumUsd: number; currency: string }
  balances: { available: number; pendingDeposits: number }
}

const emptyData: WalletData = {
  profile: null,
  waitlist: null,
  deposits: [],
  ledger: [],
  payoutRequests: [],
  settings: { payoutMinimumUsd: 25, currency: 'USD' },
  balances: { available: 0, pendingDeposits: 0 },
}

function money(amount: number | string, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(amount) || 0)
}

export default function ArtistsPage() {
  const configured = isSupabaseConfigured()
  const router = useRouter()
  const [token, setToken] = useState('')
  const [data, setData] = useState<WalletData>(emptyData)
  const [form, setForm] = useState({ artistName: '', contactName: '', country: '', city: '', instagram: '', spotify: '', website: '', notes: '' })
  const [loading, setLoading] = useState(configured)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = async (accessToken: string) => {
    const response = await fetch('/api/artist/wallet', { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' })
    const payload = await response.json()
    if (!response.ok) throw new Error(payload.error || 'Could not load artist wallet.')
    setData(payload)
    setForm((current) => ({
      ...current,
      artistName: current.artistName || payload.waitlist?.artist_name || payload.profile?.display_name || payload.profile?.username || '',
    }))
  }

  useEffect(() => {
    if (!configured) return
    createClient().auth.getSession().then(async ({ data: sessionData }) => {
      const accessToken = sessionData.session?.access_token
      if (!accessToken) {
        setLoading(false)
        return
      }
      setToken(accessToken)
      try {
        await load(accessToken)
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Artist wallet is not ready.')
      } finally {
        setLoading(false)
      }
    })
  }, [configured])

  const nextPayout = useMemo(() => Math.max(0, data.settings.payoutMinimumUsd - data.balances.available), [data])

  const submitWaitlist = async (event: FormEvent) => {
    event.preventDefault()
    if (!token) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const response = await fetch('/api/artist/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Could not save queue entry.')
      await load(token)
      setMessage('Artist queue entry saved.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save queue entry.')
    } finally {
      setSaving(false)
    }
  }

  const reserveDeposit = (amount: number) => {
    const item = {
      id: `artist-priority-deposit-${amount}`,
      title: 'Artist priority deposit',
      artist: form.artistName || data.profile?.display_name || 'BVS artist',
      type: 'artist_deposit',
      price: amount,
      quantity: 1,
      delivery: 'Creditable BVS artist platform balance. Does not guarantee airplay or publication.',
    }
    window.localStorage.setItem('bvs_cart', JSON.stringify([item]))
    router.push('/checkout')
  }

  if (!configured) return <AccessNotice title="Artist access unavailable" text="Account service is not configured." />
  if (loading) return <main className="min-h-[65vh] p-20 text-center text-text-secondary">Loading artist wallet...</main>
  if (!token) return <AccessNotice title="Artist login required" text="Sign in or create a free artist account to join the priority queue and track credits." />

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-brand">For artists</p>
          <h1 className="mt-2 text-4xl font-semibold">Artist access and wallet</h1>
          <p className="mt-3 max-w-2xl text-text-secondary">Join the onboarding queue, reserve a creditable priority deposit, and track wallet activity as BVS expands artist monetization.</p>
        </div>
        <Link href="/upload" className="rounded-full border border-white/20 px-5 py-2 text-sm hover:border-brand">Submit music</Link>
      </div>

      {error && <p className="mt-6 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-red-200">{error}</p>}
      {message && <p className="mt-6 rounded-xl border border-brand/30 bg-brand/10 p-4 text-brand">{message}</p>}

      <section className="mt-10 grid gap-3 md:grid-cols-4">
        <Metric label="Available balance" value={money(data.balances.available)} />
        <Metric label="Pending deposits" value={money(data.balances.pendingDeposits)} />
        <Metric label="Payout threshold" value={money(data.settings.payoutMinimumUsd)} />
        <Metric label="Queue status" value={data.waitlist?.status?.replace('_', ' ') || 'Not joined'} />
      </section>

      <section className="mt-12 grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <form onSubmit={submitWaitlist} className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
          <h2 className="text-2xl font-semibold">Priority artist queue</h2>
          <p className="mt-2 text-sm text-text-secondary">Deposits become platform credit for uploads, promotion, distribution, mixing, or mastering. They do not guarantee airplay or catalogue acceptance.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Field label="Artist name" value={form.artistName} onChange={(artistName) => setForm({ ...form, artistName })} required />
            <Field label="Contact name" value={form.contactName} onChange={(contactName) => setForm({ ...form, contactName })} />
            <Field label="Country" value={form.country} onChange={(country) => setForm({ ...form, country })} />
            <Field label="City" value={form.city} onChange={(city) => setForm({ ...form, city })} />
            <Field label="Instagram" value={form.instagram} onChange={(instagram) => setForm({ ...form, instagram })} />
            <Field label="Spotify / DSP link" value={form.spotify} onChange={(spotify) => setForm({ ...form, spotify })} />
            <Field label="Website / Link hub" value={form.website} onChange={(website) => setForm({ ...form, website })} className="sm:col-span-2" />
            <label className="text-sm font-medium sm:col-span-2">
              Notes
              <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} rows={4} className="mt-1.5 w-full resize-y rounded-xl border border-white/10 bg-black/20 p-3 outline-none focus:border-brand" />
            </label>
          </div>
          <button disabled={saving || !form.artistName} className="mt-6 rounded-full bg-brand px-6 py-3 font-semibold text-black disabled:opacity-60">
            {saving ? 'Saving...' : data.waitlist ? 'Update queue entry' : 'Join artist queue'}
          </button>
        </form>

        <div className="space-y-6">
          <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
            <h2 className="text-2xl font-semibold">Creditable deposit</h2>
            <p className="mt-2 text-sm text-text-secondary">Reserve priority onboarding/review access. The deposit is recorded as BVS platform credit after payment is confirmed.</p>
            <div className="mt-5 flex flex-wrap gap-3">
              {[5, 10, 20].map((amount) => (
                <button key={amount} onClick={() => reserveDeposit(amount)} className="rounded-full border border-brand px-5 py-2 text-sm font-semibold text-brand hover:bg-brand hover:text-black">
                  {money(amount)}
                </button>
              ))}
            </div>
          </section>
          <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
            <h2 className="text-2xl font-semibold">Payout readiness</h2>
            <p className="mt-2 text-sm text-text-secondary">{nextPayout > 0 ? `${money(nextPayout)} more needed before payout requests open.` : 'Balance is above the current payout threshold.'}</p>
          </section>
        </div>
      </section>

      <section className="mt-12 grid gap-8 lg:grid-cols-2">
        <ActivityTable title="Wallet ledger" rows={data.ledger.map((entry) => [entry.entry_type.replaceAll('_', ' '), entry.status, money(entry.amount, entry.currency), new Date(entry.effective_at).toLocaleDateString()])} empty="No wallet entries yet." />
        <ActivityTable title="Deposits" rows={data.deposits.map((deposit) => [deposit.source, deposit.status, money(deposit.amount, deposit.currency), new Date(deposit.created_at).toLocaleDateString()])} empty="No deposits yet." />
      </section>
    </main>
  )
}

function AccessNotice({ title, text }: { title: string; text: string }) {
  return <main className="mx-auto min-h-[65vh] max-w-2xl px-6 py-20 text-center"><h1 className="text-3xl">{title}</h1><p className="mt-4 text-text-secondary">{text}</p><div className="mt-7 flex justify-center gap-3"><Link href="/auth/login" className="rounded-full bg-brand px-6 py-3 font-semibold text-black">Sign in</Link><Link href="/auth/signup" className="rounded-full border border-white/20 px-6 py-3">Create account</Link></div></main>
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"><p className="text-sm text-text-secondary">{label}</p><p className="mt-2 text-2xl font-semibold capitalize text-brand">{value}</p></div>
}

function Field({ label, value, onChange, required, className = '' }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; className?: string }) {
  return <label className={`text-sm font-medium ${className}`}>{label}<input value={value} onChange={(event) => onChange(event.target.value)} required={required} className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/20 p-3 outline-none focus:border-brand" /></label>
}

function ActivityTable({ title, rows, empty }: { title: string; rows: string[][]; empty: string }) {
  return <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-6"><h2 className="text-2xl font-semibold">{title}</h2>{rows.length ? <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[460px] text-left text-sm"><tbody>{rows.map((row, index) => <tr key={`${row.join('-')}-${index}`} className="border-t border-white/10 first:border-t-0">{row.map((cell, cellIndex) => <td key={cellIndex} className={`py-3 pr-3 ${cellIndex === 0 ? 'capitalize' : 'text-text-secondary'}`}>{cell}</td>)}</tr>)}</tbody></table></div> : <p className="mt-4 text-sm text-text-secondary">{empty}</p>}</section>
}
