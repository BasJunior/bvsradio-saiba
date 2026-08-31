'use client'

import Link from 'next/link'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient, isSupabaseConfigured } from '@/lib/supabase'

type PremiumTier = {
  id: string
  name: string
  monthlyUsd: number
  yearlyUsd: number
  badge: string
  summary: string
  featured: boolean
  notes: string[]
}

type PremiumState = {
  premiumActive: boolean
  premiumUntil: string | null
  distributionEnabled: boolean
  planId?: string | null
  billingInterval?: string | null
  cancelAt?: string | null
  membershipStatus?: string
  provider?: string | null
  foundingSeat?: boolean
  founding?: { used: number; cap: number; available: boolean }
  billingModel?: string
  daysRemaining?: number | null
  canResubscribe?: boolean
  foundingWindow?: { open: boolean; daysRemaining: number; headline: string }
  billingReady?: boolean
  paynowEnabled?: boolean
  stripeEnabled?: boolean
  monthlyUsd: number | null
  priceNote: string
  tiers?: PremiumTier[]
  distributionStores?: string[]
  copy: { title: string; summary: string; includes: string[] }
}

function ArtistPremiumInner() {
  const searchParams = useSearchParams()
  const [data, setData] = useState<PremiumState | null>(null)
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [info, setInfo] = useState('')
  const [interval, setInterval] = useState<'month' | 'year'>('month')
  const [planChoice, setPlanChoice] = useState<'founding' | 'standard'>('founding')

  const load = useCallback(async (accessToken: string) => {
    const res = await fetch('/api/artist/premium', { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' })
    const payload = await res.json()
    if (!res.ok) throw new Error(payload.error || 'Could not load premium status')
    setData(payload)
    if (payload.founding && !payload.founding.available) setPlanChoice('standard')
    if (payload.foundingWindow && !payload.foundingWindow.open) setPlanChoice('standard')
    if (payload.planId?.includes('standard')) setPlanChoice('standard')
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setError('Account service not configured.')
      return
    }
    createClient().auth.getSession().then(({ data: session }) => {
      const accessToken = session.session?.access_token
      if (!accessToken) {
        setError('Sign in with an artist account.')
        return
      }
      setToken(accessToken)
      load(accessToken).catch((issue: Error) => setError(issue.message))
    })
  }, [load])

  useEffect(() => {
    if (searchParams.get('checkout') !== 'return') return
    const ref = searchParams.get('ref')
    setInfo(ref ? `Returned from Paynow (ref ${ref}). Premium activates after verified payment.` : 'Returned from Paynow. Premium activates after verified payment.')
    if (token) void load(token)
  }, [searchParams, token, load])

  const priceLabel = useMemo(() => {
    if (planChoice === 'standard') return interval === 'year' ? 'US$120/year' : 'US$12/month'
    return interval === 'year' ? 'US$90/year' : 'US$9/month'
  }, [planChoice, interval])

  const subscribe = async (provider: 'paynow' | 'stripe') => {
    setBusy(true)
    setInfo('')
    setError('')
    try {
      const res = await fetch(provider === 'stripe' ? '/api/artist/premium/subscribe/stripe' : '/api/artist/premium/subscribe', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: planChoice, interval }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || 'Could not start checkout')
      if (payload.note) setInfo(payload.note)
      if (!payload.redirectUrl) throw new Error('Payment provider did not return a checkout URL.')
      window.location.href = payload.redirectUrl as string
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'Checkout failed')
      setBusy(false)
    }
  }

  const cancel = async (mode: 'period_end' | 'immediate') => {
    setBusy(true)
    setInfo('')
    setError('')
    try {
      const res = await fetch('/api/artist/premium/cancel', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || 'Cancel failed')
      setInfo(payload.message || 'Premium updated')
      await load(token)
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'Cancel failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 px-5 py-7 sm:px-8 sm:py-9">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(212,175,55,.18),transparent_34%),linear-gradient(120deg,rgba(255,255,255,.04),transparent_42%)]" />
        <div className="relative">
          <div className="flex flex-wrap gap-2"><span className="bvs-chip bvs-chip-brand">Artist Premium</span><span className="bvs-chip">Distribution</span></div>
          <h1 className="mt-5 max-w-3xl text-balance text-4xl font-semibold tracking-tight sm:text-5xl">Wider distribution when your release schedule needs it.</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-text-secondary sm:text-base">Editorial submission, BVS publishing and radio rotation remain separate. Premium adds distribution capability; it never buys approval or guaranteed streams.</p>
        </div>
      </section>

      {error && <p className="mt-5 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-red-200">{error}</p>}
      {info && <p className="mt-5 rounded-2xl border border-brand/30 bg-brand/10 p-4 text-sm">{info}</p>}

      {data && (
        <>
          <section className="mt-6 grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
            <div className="bvs-surface rounded-[1.75rem] p-5 sm:p-6">
              <p className="bvs-section-kicker">What Premium adds</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">{data.copy.title}</h2>
              <p className="mt-2 text-sm leading-6 text-text-secondary">{data.copy.summary}</p>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {data.copy.includes.map((line) => <div key={line} className="bvs-surface-quiet rounded-xl p-3 text-sm text-text-secondary">{line}</div>)}
              </div>
            </div>

            <div className="bvs-surface rounded-[1.75rem] p-5 sm:p-6">
              <p className="bvs-section-kicker">Your status</p>
              <h2 className="mt-2 text-2xl font-semibold">{data.premiumActive ? 'Premium active' : 'Free artist path'}</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className={`bvs-chip ${data.premiumActive ? 'bvs-chip-brand' : ''}`}>{data.premiumActive ? 'Active' : 'Free'}</span>
                {data.distributionEnabled && <span className="bvs-chip bvs-chip-brand">Distribution eligible</span>}
                {data.provider && <span className="bvs-chip">{data.provider}</span>}
              </div>
              <p className="mt-4 text-sm leading-6 text-text-secondary">{data.premiumUntil && data.premiumActive ? `Active until ${new Date(data.premiumUntil).toLocaleDateString()}. ` : ''}{data.daysRemaining != null && data.premiumActive ? `${data.daysRemaining} day${data.daysRemaining === 1 ? '' : 's'} remaining. ` : ''}{data.cancelAt ? 'Cancellation is scheduled.' : ''}</p>
              {data.founding && <p className="mt-3 text-sm text-text-secondary">Founding seats: <strong className="text-text-primary">{data.founding.used}/{data.founding.cap}</strong>{data.founding.available ? ' · still open' : ' · full'}</p>}
            </div>
          </section>

          {!data.premiumActive && (
            <section className="mt-6">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div><p className="bvs-section-kicker">Choose a plan</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">Pick the rate that fits.</h2></div>
                {data.foundingWindow && <p className="max-w-md text-sm text-text-secondary">{data.foundingWindow.headline}</p>}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {(data.tiers || []).map((tier) => {
                  const id = tier.id === 'standard' ? 'standard' : 'founding'
                  const disabled = id === 'founding' && data.founding && !data.founding.available
                  const selected = planChoice === id
                  return (
                    <button key={tier.id} type="button" disabled={Boolean(disabled)} onClick={() => setPlanChoice(id)} className={`bvs-surface bvs-surface-hover rounded-[1.6rem] p-5 text-left disabled:opacity-40 ${selected ? 'border-brand/50 ring-1 ring-brand/20' : ''}`}>
                      <div className="flex items-center justify-between gap-3"><span className="bvs-chip bvs-chip-brand">{tier.badge}</span>{selected && <span className="bvs-chip">Selected</span>}</div>
                      <h3 className="mt-4 text-2xl font-semibold">{tier.name}</h3>
                      <p className="mt-2 text-3xl font-semibold">US${tier.monthlyUsd}<span className="text-sm font-normal text-text-secondary">/mo</span></p>
                      <p className="mt-1 text-xs text-text-secondary">or US${tier.yearlyUsd}/year</p>
                      <p className="mt-4 text-sm leading-6 text-text-secondary">{tier.summary}</p>
                    </button>
                  )
                })}
              </div>

              <div className="bvs-surface mt-4 rounded-[1.6rem] p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div><p className="bvs-section-kicker">Billing</p><p className="mt-2 text-2xl font-semibold">{priceLabel}</p></div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setInterval('month')} className={`rounded-full px-4 py-2 text-sm ${interval === 'month' ? 'bg-brand text-black' : 'border border-white/15'}`}>Monthly</button>
                    <button type="button" onClick={() => setInterval('year')} className={`rounded-full px-4 py-2 text-sm ${interval === 'year' ? 'bg-brand text-black' : 'border border-white/15'}`}>Yearly</button>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  <button type="button" disabled={busy || !token || data.stripeEnabled === false} onClick={() => void subscribe('stripe')} className="rounded-full bg-brand px-6 py-3 font-semibold text-black shadow-[0_12px_30px_rgba(212,175,55,.2)] disabled:opacity-50">{busy ? 'Starting checkout…' : `Auto-renew with Stripe`}</button>
                  <button type="button" disabled={busy || !token || data.paynowEnabled === false} onClick={() => void subscribe('paynow')} className="rounded-full border border-white/15 bg-white/[.03] px-6 py-3 text-sm disabled:opacity-50">Pay once with Paynow</button>
                </div>
              </div>
            </section>
          )}

          {data.premiumActive && (
            <section className="bvs-surface mt-6 rounded-[1.6rem] p-5 sm:p-6">
              <p className="bvs-section-kicker">Membership controls</p>
              <div className="mt-4 flex flex-wrap gap-3">
                {data.canResubscribe && data.paynowEnabled !== false && <button type="button" disabled={busy || !token} onClick={() => void subscribe('paynow')} className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-black disabled:opacity-50">Resubscribe with Paynow</button>}
                {data.provider !== 'stripe' && data.stripeEnabled !== false && <button type="button" disabled={busy || !token} onClick={() => void subscribe('stripe')} className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-black disabled:opacity-50">Connect Stripe auto-renew</button>}
                <button type="button" disabled={busy} onClick={() => void cancel('period_end')} className="rounded-full border border-white/15 px-5 py-2.5 text-sm">Cancel at period end</button>
                <button type="button" disabled={busy} onClick={() => void cancel('immediate')} className="rounded-full border border-red-400/40 px-5 py-2.5 text-sm text-red-200">Cancel now</button>
              </div>
            </section>
          )}

          {data.distributionStores?.length ? (
            <section className="mt-8">
              <p className="bvs-section-kicker">Distribution destinations</p>
              <h2 className="mt-2 text-2xl font-semibold">Where approved releases can go</h2>
              <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {data.distributionStores.map((store) => <li key={store} className="bvs-surface-quiet rounded-xl px-3 py-2 text-xs text-text-secondary">{store}</li>)}
              </ul>
            </section>
          ) : null}

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/creator/studio" className="rounded-full border border-white/15 px-5 py-2.5 text-sm hover:border-brand">Back to Studio</Link>
            <Link href="/upload" className="rounded-full border border-white/15 px-5 py-2.5 text-sm hover:border-brand">Submit a release</Link>
            <Link href="/premium" className="rounded-full border border-white/15 px-5 py-2.5 text-sm hover:border-brand">All BVS plans</Link>
          </div>
          <p className="mt-6 text-xs leading-5 text-text-secondary">Stripe renews automatically until cancelled. Paynow is prepaid and must be renewed manually when the period ends. Payment never buys editorial approval or BVS rotation.</p>
        </>
      )}
    </main>
  )
}

export default function ArtistPremiumPage() {
  return <Suspense fallback={<main className="p-16 text-center text-text-secondary">Loading Premium…</main>}><ArtistPremiumInner /></Suspense>
}
