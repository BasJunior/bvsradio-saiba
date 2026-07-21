'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient, isSupabaseConfigured } from '@/lib/supabase'

type PremiumState = {
  premiumActive: boolean
  premiumUntil: string | null
  distributionEnabled: boolean
  monthlyUsd: number | null
  priceNote: string
  copy: { title: string; summary: string; includes: string[] }
}

export default function ArtistPremiumPage() {
  const [data, setData] = useState<PremiumState | null>(null)
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [info, setInfo] = useState('')

  const load = useCallback(async (accessToken: string) => {
    const res = await fetch('/api/artist/premium', {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    })
    const payload = await res.json()
    if (!res.ok) throw new Error(payload.error || 'Could not load premium status')
    setData(payload)
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

  const toggle = async (enable: boolean) => {
    setBusy(true)
    setInfo('')
    setError('')
    try {
      const res = await fetch('/api/artist/premium', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ enable, distributionEnabled: enable }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || 'Update failed')
      setInfo(payload.message || 'Updated')
      await load(token)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-14">
      <p className="text-xs uppercase tracking-[.2em] text-brand">Artists</p>
      <h1 className="mt-2 text-4xl font-semibold">Premium Artist</h1>
      <p className="mt-3 text-text-secondary">
        Monthly subscription for multi-platform distribution when a BVS partner is configured. Continuous
        rotation on BVS after editorial publish does <strong className="text-text-primary">not</strong> require
        premium.
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
          <p className="text-sm">
            <strong className="text-brand">Price:</strong> {data.priceNote}
          </p>
          <p className="text-sm text-text-secondary">
            Status:{' '}
            <strong className="text-text-primary">
              {data.premiumActive ? 'Premium flag ON' : 'Free artist path'}
            </strong>
            {data.premiumUntil && data.premiumActive && (
              <> · until {new Date(data.premiumUntil).toLocaleDateString()}</>
            )}
            {data.distributionEnabled && <> · distribution eligible</>}
          </p>
          <div className="flex flex-wrap gap-3">
            {!data.premiumActive ? (
              <button
                type="button"
                disabled={busy || !token}
                onClick={() => void toggle(true)}
                className="rounded-full bg-brand px-6 py-3 font-semibold text-black disabled:opacity-50"
              >
                Enable premium shell
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => void toggle(false)}
                className="rounded-full border border-white/20 px-6 py-3 text-sm"
              >
                Disable premium shell
              </button>
            )}
            <Link href="/upload" className="rounded-full border border-white/20 px-6 py-3 text-sm hover:border-brand">
              Submit a release
            </Link>
          </div>
          <p className="text-xs text-text-secondary">
            Shell only: Stripe billing and named distributor will be connected when licence and partner costs are
            fixed. Run <code className="text-brand">supabase-releases-pipeline.sql</code> if premium columns are
            missing.
          </p>
        </section>
      )}
    </main>
  )
}
