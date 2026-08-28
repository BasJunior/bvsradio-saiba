'use client'

import Link from 'next/link'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient, isSupabaseConfigured } from '@/lib/supabase'

type PremiumState = {
  premiumActive: boolean
  premiumUntil: string | null
  distributionEnabled: boolean
  planId?: string | null
  billingInterval?: string | null
  cancelAt?: string | null
  membershipStatus?: string
  provider?: string | null
  stripeEnabled?: boolean
  paynowEnabled?: boolean
  standardMonthlyUsd: number
  standardYearlyUsd: number
  instantPriceUsd: number
  distributionStores?: string[]
}

function ArtistPremiumInner() {
  const searchParams = useSearchParams()
  const configured = isSupabaseConfigured()
  const [data, setData] = useState<PremiumState | null>(null)
  const [token, setToken] = useState('')
  const [error, setError] = useState(configured ? '' : 'Account service not configured.')
  const [busy, setBusy] = useState(false)
  const [interval, setInterval] = useState<'month' | 'year'>('month')
  const [info, setInfo] = useState(() => {
    const checkout = searchParams.get('checkout')
    if (checkout === 'stripe-success') return 'Stripe checkout completed. Premium status updates after verified payment confirmation.'
    if (checkout === 'stripe-cancelled') return 'Stripe checkout cancelled.'
    if (checkout === 'return') return 'Returned from Paynow. If payment completed, Premium activates after verification.'
    return ''
  })

  const load = useCallback(async (accessToken: string) => {
    const response = await fetch('/api/artist/premium', {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error || 'Could not load Premium status.')
    setData(payload)
  }, [])

  useEffect(() => {
    if (!configured) return
    createClient().auth.getSession().then(async ({ data: sessionData }) => {
      const accessToken = sessionData.session?.access_token
      if (!accessToken) {
        setError('Sign in with an artist account.')
        return
      }
      setToken(accessToken)
      await load(accessToken)
    }).catch((caught) => setError(caught instanceof Error ? caught.message : 'Could not open Artist Premium.'))
  }, [configured, load])

  const standardPrice = useMemo(
    () => interval === 'year' ? `US$${data?.standardYearlyUsd ?? 120}/year` : `US$${data?.standardMonthlyUsd ?? 12}/month`,
    [data, interval],
  )

  const subscribe = async (provider: 'stripe' | 'paynow') => {
    if (!token) return
    setBusy(true)
    setError('')
    setInfo('')
    try {
      const response = await fetch(provider === 'stripe' ? '/api/artist/premium/subscribe/stripe' : '/api/artist/premium/subscribe', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: 'standard', interval }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Could not start checkout.')
      if (payload.note) setInfo(payload.note)
      if (!payload.redirectUrl) throw new Error('Payment provider did not return a checkout URL.')
      window.location.href = payload.redirectUrl as string
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Checkout failed.')
      setBusy(false)
    }
  }

  const cancel = async (mode: 'period_end' | 'immediate') => {
    if (!token) return
    setBusy(true)
    setError('')
    setInfo('')
    try {
      const response = await fetch('/api/artist/premium/cancel', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Cancel failed.')
      setInfo(payload.message || 'Premium updated.')
      await load(token)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Cancel failed.')
    } finally {
      setBusy(false)
    }
  }

  const activePlanName = data?.planId?.includes('founding')
    ? 'Founding Artist Premium (grandfathered)'
    : data?.planId?.includes('standard')
      ? 'Artist Premium'
      : 'Artist Premium'

  return (
    <main className="mx-auto max-w-4xl px-5 py-12 sm:px-6 sm:py-14">
      <p className="text-xs font-semibold uppercase tracking-[.2em] text-brand">Artists · Distribution</p>
      <h1 className="mt-2 text-4xl font-semibold">Choose how you distribute</h1>
      <p className="mt-3 max-w-3xl text-text-secondary">
        BVS editorial submission, publishing and radio rotation remain separate. Pay for wider distribution only when it makes sense for your release schedule.
      </p>

      {error && <p className="mt-6 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-red-200">{error}</p>}
      {info && <p className="mt-6 rounded-xl border border-brand/30 bg-brand/10 p-4 text-sm">{info}</p>}

      {data?.premiumActive && (
        <section className="mt-8 rounded-2xl border border-emerald-400/25 bg-emerald-500/[.06] p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-emerald-200">Active membership</p>
          <h2 className="mt-2 text-2xl font-semibold">{activePlanName}</h2>
          <p className="mt-2 text-sm text-text-secondary">
            Ongoing distribution access is active{data.premiumUntil ? ` until ${new Date(data.premiumUntil).toLocaleDateString()}` : ''}.
            {data.provider ? ` Billing provider: ${data.provider}.` : ''}
          </p>
          {data.planId?.includes('founding') && (
            <p className="mt-3 text-sm text-brand">Your founding rate is grandfathered. The founding offer is closed to new purchases.</p>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            <button disabled={busy} onClick={() => void cancel('period_end')} className="min-h-11 rounded-full border border-white/20 px-5 py-2 text-sm disabled:opacity-40">Cancel at period end</button>
            <button disabled={busy} onClick={() => void cancel('immediate')} className="min-h-11 rounded-full border border-red-400/40 px-5 py-2 text-sm text-red-200 disabled:opacity-40">Cancel now</button>
          </div>
        </section>
      )}

      <section className="mt-8 grid gap-5 md:grid-cols-2">
        <article className="flex flex-col rounded-3xl border border-brand/40 bg-brand/[.06] p-6">
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-brand">Premium Instant</p>
          <h2 className="mt-3 text-3xl font-semibold">US$5.99 per release</h2>
          <p className="mt-2 text-sm font-medium">One-time release fee. No monthly subscription.</p>
          <p className="mt-4 flex-1 text-sm leading-6 text-text-secondary">
            Best when you release occasionally. Choose one BVS-approved release and pay only for that release to enter the wider distribution path.
          </p>
          <ul className="mt-5 list-disc space-y-2 pl-5 text-sm text-text-secondary">
            <li>One approved release per payment</li>
            <li>No recurring membership</li>
            <li>No duplicate fee once that release is already eligible or in delivery</li>
            <li>Payment never buys editorial approval or guaranteed streams</li>
          </ul>
          <Link href="/artist/premium/instant" className={`mt-6 inline-flex min-h-11 items-center justify-center rounded-full px-6 py-3 font-semibold ${data?.premiumActive ? 'border border-white/15 text-text-secondary' : 'bg-brand text-black'}`}>
            {data?.premiumActive ? 'View Premium Instant' : 'Choose a release — US$5.99'}
          </Link>
        </article>

        <article className="flex flex-col rounded-3xl border border-white/15 bg-white/[.025] p-6">
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-brand">Artist Premium</p>
          <h2 className="mt-3 text-3xl font-semibold">US$12/month</h2>
          <p className="mt-2 text-sm font-medium">Ongoing distribution access for artists releasing regularly.</p>
          <p className="mt-4 flex-1 text-sm leading-6 text-text-secondary">
            Keep distribution eligibility active across approved releases while your membership remains active. Annual billing is US$120/year.
          </p>
          {!data?.premiumActive && (
            <>
              <div className="mt-5 flex flex-wrap gap-2">
                <button type="button" onClick={() => setInterval('month')} className={`min-h-11 rounded-full px-4 py-2 text-sm ${interval === 'month' ? 'bg-brand text-black' : 'border border-white/20'}`}>Monthly</button>
                <button type="button" onClick={() => setInterval('year')} className={`min-h-11 rounded-full px-4 py-2 text-sm ${interval === 'year' ? 'bg-brand text-black' : 'border border-white/20'}`}>Yearly · US$120</button>
              </div>
              <p className="mt-4 text-sm text-text-secondary"><strong className="text-text-primary">Selected:</strong> {standardPrice}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <button disabled={busy || !token || data?.stripeEnabled === false} onClick={() => void subscribe('stripe')} className="min-h-11 rounded-full bg-brand px-5 py-2 font-semibold text-black disabled:opacity-40">{busy ? 'Starting…' : `Subscribe ${standardPrice}`}</button>
                <button disabled={busy || !token || data?.paynowEnabled === false} onClick={() => void subscribe('paynow')} className="min-h-11 rounded-full border border-white/20 px-5 py-2 text-sm disabled:opacity-40">Pay prepaid with Paynow</button>
              </div>
            </>
          )}
          {data?.premiumActive && <p className="mt-5 rounded-xl border border-white/10 p-4 text-sm text-text-secondary">Your current membership already provides ongoing distribution eligibility; you do not need a new subscription checkout.</p>}
        </article>
      </section>

      {data?.distributionStores?.length ? (
        <section className="mt-10 rounded-2xl border border-white/10 p-5 sm:p-6">
          <h2 className="text-xl font-semibold">Distribution destinations</h2>
          <p className="mt-2 text-sm text-text-secondary">Availability still depends on rights, metadata, territory and partner delivery readiness.</p>
          <ul className="mt-4 grid grid-cols-2 gap-2 text-xs text-text-secondary sm:grid-cols-3 md:grid-cols-4">
            {data.distributionStores.map((store) => <li key={store} className="rounded-lg border border-white/10 px-3 py-2">{store}</li>)}
          </ul>
        </section>
      ) : null}

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/creator/studio/create/release" className="min-h-11 rounded-full border border-white/20 px-5 py-2.5 text-sm">Submit a release</Link>
        <Link href="/premium" className="min-h-11 rounded-full border border-white/20 px-5 py-2.5 text-sm">All BVS plans</Link>
      </div>
    </main>
  )
}

export default function ArtistPremiumPage() {
  return <Suspense fallback={<main className="p-20 text-center text-text-secondary">Opening Artist Premium…</main>}><ArtistPremiumInner /></Suspense>
}
