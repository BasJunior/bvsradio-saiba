'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
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
  billingReady?: boolean
  paynowEnabled?: boolean
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
    const res = await fetch('/api/artist/premium', {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    })
    const payload = await res.json()
    if (!res.ok) throw new Error(payload.error || 'Could not load premium status')
    setData(payload)
    if (payload.founding && !payload.founding.available) setPlanChoice('standard')
    if (payload.planId?.includes('standard')) setPlanChoice('standard')
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setError('Account service not configured.')
      return
    }
    createClient()
      .auth.getSession()
      .then(({ data: s }) => {
        const t = s.session?.access_token
        if (!t) {
          setError('Sign in with an artist account.')
          return
        }
        setToken(t)
        load(t).catch((e: Error) => setError(e.message))
      })
  }, [load])

  useEffect(() => {
    const checkout = searchParams.get('checkout')
    const ref = searchParams.get('ref')
    if (checkout === 'return') {
      setInfo(
        ref
          ? `Returned from Paynow (ref ${ref}). If you paid, Premium activates within a minute — refresh this page.`
          : 'Returned from Paynow. If you paid, refresh in a moment to see active Premium.',
      )
      if (token) void load(token)
    }
  }, [searchParams, token, load])

  const priceLabel = useMemo(() => {
    if (planChoice === 'standard') return interval === 'year' ? 'US$120/year' : 'US$12/month'
    return interval === 'year' ? 'US$90/year' : 'US$9/month'
  }, [planChoice, interval])

  const subscribe = async () => {
    setBusy(true)
    setInfo('')
    setError('')
    try {
      const res = await fetch('/api/artist/premium/subscribe', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: planChoice, interval }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || 'Could not start checkout')
      if (payload.note) setInfo(payload.note)
      if (payload.redirectUrl) {
        window.location.href = payload.redirectUrl as string
        return
      }
      throw new Error('Paynow did not return a checkout URL.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Checkout failed')
    } finally {
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
      setInfo(payload.message || 'Canceled')
      await load(token)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Cancel failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-14">
      <p className="text-xs uppercase tracking-[.2em] text-brand">Artists</p>
      <h1 className="mt-2 text-4xl font-semibold">Premium Artist</h1>
      <p className="mt-3 text-text-secondary">
        Paynow prepaid membership for multi-platform distribution of{' '}
        <strong className="text-text-primary">approved</strong> releases. Continuous BVS rotation after editorial
        publish does <strong className="text-text-primary">not</strong> require Premium.
      </p>

      {error && <p className="mt-6 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-red-200">{error}</p>}
      {info && <p className="mt-6 rounded-xl border border-brand/30 bg-brand/10 p-4 text-sm">{info}</p>}

      {data && (
        <section className="mt-10 space-y-6 rounded-2xl border border-white/10 bg-white/[.03] p-6">
          <div>
            <h2 className="text-2xl font-semibold">{data.copy.title}</h2>
            <p className="mt-2 text-sm text-text-secondary">{data.copy.summary}</p>
          </div>
          <ul className="list-disc space-y-2 pl-5 text-sm text-text-secondary">
            {data.copy.includes.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>

          {data.founding && (
            <p className="text-sm text-text-secondary">
              Founding seats:{' '}
              <strong className="text-text-primary">
                {data.founding.used}/{data.founding.cap} used
              </strong>
              {data.founding.available ? ' · still open' : ' · full — Standard only'}
            </p>
          )}

          <p className="text-sm">
            Status:{' '}
            <strong className="text-text-primary">
              {data.premiumActive ? 'Premium active' : 'Free artist path'}
            </strong>
            {data.planId && <> · {data.planId.replaceAll('_', ' ')}</>}
            {data.billingInterval && <> · {data.billingInterval}</>}
            {data.premiumUntil && data.premiumActive && (
              <> · until {new Date(data.premiumUntil).toLocaleDateString()}</>
            )}
            {data.distributionEnabled && <> · distribution eligible</>}
            {data.cancelAt && <> · cancel scheduled</>}
            {data.provider && <> · via {data.provider}</>}
          </p>

          {data.tiers && data.tiers.length > 0 && !data.premiumActive && (
            <div className="grid gap-3 sm:grid-cols-2">
              {data.tiers.map((tier) => {
                const id = tier.id === 'standard' ? 'standard' : 'founding'
                const disabled = id === 'founding' && data.founding && !data.founding.available
                return (
                  <button
                    key={tier.id}
                    type="button"
                    disabled={Boolean(disabled)}
                    onClick={() => setPlanChoice(id)}
                    className={`rounded-xl border p-4 text-left text-sm transition ${
                      planChoice === id ? 'border-brand bg-brand/10' : 'border-white/10 bg-black/20'
                    } disabled:opacity-40`}
                  >
                    <p className="text-[11px] uppercase tracking-wide text-brand">{tier.badge}</p>
                    <p className="mt-1 font-semibold">{tier.name}</p>
                    <p className="mt-2 text-lg font-semibold">
                      US${tier.monthlyUsd}
                      <span className="text-xs font-normal text-text-secondary">/mo</span>
                    </p>
                    <p className="text-xs text-text-secondary">or US${tier.yearlyUsd}/year</p>
                  </button>
                )
              })}
            </div>
          )}

          {!data.premiumActive && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setInterval('month')}
                className={`rounded-full px-4 py-2 text-sm ${interval === 'month' ? 'bg-brand text-black' : 'border border-white/20'}`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setInterval('year')}
                className={`rounded-full px-4 py-2 text-sm ${interval === 'year' ? 'bg-brand text-black' : 'border border-white/20'}`}
              >
                Yearly (2 months free)
              </button>
            </div>
          )}

          <p className="text-sm text-text-secondary">
            <strong className="text-brand">Price:</strong> {data.premiumActive ? data.priceNote : priceLabel}
          </p>

          {data.distributionStores && data.distributionStores.length > 0 && (
            <div>
              <p className="text-sm font-medium text-text-primary">
                Distribution destinations ({data.distributionStores.length})
              </p>
              <ul className="mt-2 grid max-h-40 grid-cols-2 gap-1 overflow-y-auto text-xs text-text-secondary sm:grid-cols-3">
                {data.distributionStores.map((s) => (
                  <li key={s} className="truncate rounded border border-white/5 px-2 py-1">
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            {!data.premiumActive ? (
              <button
                type="button"
                disabled={busy || !token || data.billingReady === false}
                onClick={() => void subscribe()}
                className="rounded-full bg-brand px-6 py-3 font-semibold text-black disabled:opacity-50"
              >
                {busy ? 'Starting Paynow…' : `Pay ${priceLabel} with Paynow`}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void cancel('period_end')}
                  className="rounded-full border border-white/20 px-6 py-3 text-sm"
                >
                  Cancel at period end
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void cancel('immediate')}
                  className="rounded-full border border-red-400/40 px-6 py-3 text-sm text-red-200"
                >
                  Cancel now
                </button>
              </>
            )}
            <Link href="/creator/studio#premium-desk" className="rounded-full border border-white/20 px-6 py-3 text-sm hover:border-brand">
              Studio Premium desk
            </Link>
            <Link href="/upload" className="rounded-full border border-white/20 px-6 py-3 text-sm hover:border-brand">
              Submit a release
            </Link>
          </div>

          <p className="text-xs text-text-secondary">
            Prepaid period via Paynow (EcoCash, cards, OneMoney). Not auto-renew yet — re-subscribe when the period
            ends. Payment never buys editorial approval or BVS rotation. Billing ready:{' '}
            {data.billingReady ? 'yes' : 'waiting on Paynow env'}.
          </p>
        </section>
      )}
    </main>
  )
}

export default function ArtistPremiumPage() {
  return (
    <Suspense fallback={<main className="p-16 text-center text-text-secondary">Loading Premium…</main>}>
      <ArtistPremiumInner />
    </Suspense>
  )
}
