'use client'

import CreatorTrending from '@/components/CreatorTrending'
import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'

type Insights = {
  rangeDays: number
  summary: {
    plays: number
    premiumPlays: number
    previousPlays: number
    playGrowthPercent: number
    uniqueSessions: number
    listeningMinutes: number
    saves: number
    likes: number
    submissions: number
    saveRate: number
    playbackErrors: number
    playbackErrorRate: number
  }
  catalogue: {
    uploads: number
    beats: number
    lifetimePlays: number
    published: number
    inRotation: number
    awaitingReview: number
    openRequests: number
  }
  daily: Array<{ day: string; plays: number; premiumPlays: number; saves: number; minutes: number; submissions: number }>
  topItems: Array<{
    id: string
    title: string
    kind: string
    plays: number
    saves: number
    totalPlays: number
    artwork?: string | null
    status: string
    published: boolean
    inRotation: boolean
  }>
  genres: Array<{ genre: string; plays: number }>
}

function Card({ label, value, note, featured = false }: { label: string; value: string | number; note?: string; featured?: boolean }) {
  return (
    <div className={`bvs-insight-stat ${featured ? 'is-featured' : ''}`}>
      <p className="text-xs text-text-secondary">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-brand">{value}</p>
      {note ? <p className="mt-1 text-[11px] text-text-secondary">{note}</p> : null}
    </div>
  )
}

export default function CreatorInsights({ token }: { token: string }) {
  const [days, setDays] = useState(30)
  const [data, setData] = useState<Insights | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`/api/creator/analytics?days=${days}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Could not load creator insights.')
      setData(payload)
      setLastUpdated(new Date())
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load creator insights.')
    } finally {
      setLoading(false)
    }
  }, [days, token])

  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0)
    const refresh = window.setInterval(() => void load(), 60_000)
    return () => {
      window.clearTimeout(initial)
      window.clearInterval(refresh)
    }
  }, [load])

  const chart = useMemo(() => {
    if (!data) return { max: 1, plays: '', saves: '', submissions: '' }
    const max = Math.max(1, ...data.daily.flatMap((point) => [point.plays, point.premiumPlays, point.saves, point.submissions]))
    const points = (key: 'plays' | 'premiumPlays' | 'saves' | 'submissions') => data.daily.map((point, index) => {
      const x = data.daily.length === 1 ? 0 : (index / (data.daily.length - 1)) * 100
      const y = 92 - (point[key] / max) * 80
      return `${x},${y}`
    }).join(' ')
    return {
      max,
      plays: points('plays'),
      premiumPlays: points('premiumPlays'),
      saves: points('saves'),
      submissions: points('submissions'),
    }
  }, [data])

  return (
    <section className="mt-10 rounded-3xl border border-white/10 bg-white/[.015] p-5 sm:p-7">
      <CreatorTrending token={token} />
      <div className="bvs-insights-heading">
        <div>
          <p className="text-xs uppercase tracking-[.22em] text-brand">Your insights</p>
          <h2 className="mt-2 text-2xl font-semibold">Catalogue performance</h2>
          <p className="mt-2 text-sm text-text-secondary">Only activity tied to your own tracks and beats is included. Listener identities are never shown.</p>
          <p className="bvs-insights-live"><span aria-hidden="true" /> Live sync · every 60 seconds{lastUpdated ? ` · updated ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}</p>
        </div>
        <div className="bvs-insights-actions">
          {[7, 30, 90].map((range) => (
            <button key={range} onClick={() => setDays(range)} className={`rounded-full border px-3 py-1.5 text-xs ${days === range ? 'border-brand bg-brand text-black' : 'border-white/15 text-text-secondary'}`}>
              {range} days
            </button>
          ))}
          <button type="button" onClick={() => void load()} disabled={loading} className="bvs-insights-refresh">{loading ? 'Updating…' : 'Refresh now'}</button>
        </div>
      </div>

      {loading && !data ? <p className="mt-6 animate-pulse text-sm text-text-secondary">Loading your insights…</p> : null}
      {error ? <p className="mt-5 rounded-xl bg-red-500/10 p-4 text-sm text-red-200">{error} <button onClick={() => void load()} className="underline">Retry</button></p> : null}

      {data ? (
        <>
          <div className="bvs-insight-stats">
            <Card label="Plays" value={data.summary.plays.toLocaleString()} note={`Last ${data.rangeDays} days · ${data.summary.playGrowthPercent >= 0 ? '+' : ''}${data.summary.playGrowthPercent}% vs previous`} featured />
            <Card label="Premium listener plays" value={data.summary.premiumPlays.toLocaleString()} note="Verified premium listeners" />
            <Card label="Listening sessions" value={data.summary.uniqueSessions} note="Sessions with at least one start" />
            <Card label="Listening minutes" value={data.summary.listeningMinutes} note="Privacy-safe estimate" />
            <Card label="Saves" value={data.summary.saves} note={`${data.summary.saveRate}% save-to-play rate`} />
            <Card label="Likes" value={data.summary.likes.toLocaleString()} note="Current catalogue total" />
            <Card label="Submissions" value={data.summary.submissions} note={`Added in the last ${data.rangeDays} days`} />
            <Card label="Published" value={data.catalogue.published} />
            <Card label="In rotation" value={data.catalogue.inRotation} />
            <Card label="Lifetime plays" value={data.catalogue.lifetimePlays.toLocaleString()} note="Total plays (all time)" />
          </div>
          <div className="bvs-insight-earnings-note">
            <div><p className="text-xs uppercase tracking-[.16em] text-brand">Earnings</p><p className="mt-1 text-sm text-text-secondary">Playback insights show audience activity. Sales, fees, refunds and payout-ready balances are tracked separately in your wallet.</p></div>
            <Link href="/artists" className="bvs-insights-refresh">Open wallet &amp; earnings →</Link>
          </div>

          <div className="bvs-insight-chart">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h3 className="font-semibold">Performance over time</h3><p className="mt-1 text-xs text-text-secondary">Daily activity across the selected period</p></div>
              <div className="bvs-insights-legend" aria-label="Chart legend"><span className="is-primary"><i className="is-plays" />Plays</span><span><i className="is-premium-plays" />Premium listener plays</span><span><i className="is-saves" />Saves</span><span><i className="is-submissions" />Submissions</span></div>
            </div>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="mt-4 h-52 w-full" role="img" aria-label={`Starts, saves and submissions over ${data.rangeDays} days`}>
              <line x1="0" y1="12" x2="100" y2="12" stroke="currentColor" className="text-white/5" /><line x1="0" y1="52" x2="100" y2="52" stroke="currentColor" className="text-white/5" /><line x1="0" y1="92" x2="100" y2="92" stroke="currentColor" className="text-white/10" />
              <polyline points={chart.plays} fill="none" stroke="#a7cbea" strokeWidth="2.2" vectorEffect="non-scaling-stroke" />
              <polyline points={chart.premiumPlays} fill="none" stroke="#c084fc" strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
              <polyline points={chart.saves} fill="none" stroke="#c1ff52" strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
              <polyline points={chart.submissions} fill="none" stroke="#f59e9e" strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
            </svg>
            {!data.daily.some((point) => point.plays || point.saves || point.submissions) ? <p className="text-center text-xs text-text-secondary">No activity recorded in this period yet.</p> : null}
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
            <div className="rounded-2xl border border-white/10 p-5">
              <h3 className="font-semibold">Your top catalogue</h3>
              <div className="mt-4 space-y-3">
                {data.topItems.length ? <div className="bvs-insight-bars" aria-label="Top catalogue by period starts">{data.topItems.slice(0, 5).map((item) => {
                  const maximum = Math.max(1, ...data.topItems.map((row) => row.plays))
                  return <div key={`bar-${item.id}`}><div className="flex justify-between gap-3 text-xs"><span className="truncate">{item.title}</span><span className="text-brand">{item.plays}</span></div><div className="bvs-insight-bar-track"><span style={{ width: `${Math.max(item.plays ? 4 : 0, item.plays / maximum * 100)}%` }} /></div></div>
                })}</div> : null}
                {data.topItems.map((item) => (
                  <div key={item.id} className="bvs-insight-item">
                    <div className="bvs-insight-item-art">{item.artwork ? <Image src={item.artwork} alt="" fill unoptimized sizes="44px" /> : <span aria-hidden="true">{item.title.slice(0, 1)}</span>}</div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.title}</p>
                      <p className="text-xs capitalize text-text-secondary">{item.kind} · {item.status.replaceAll('_', ' ')}{item.inRotation ? ' · in rotation' : ''}</p>
                    </div>
                    <p className="text-xs text-text-secondary">{item.plays} starts · {item.saves} save actions</p>
                  </div>
                ))}
                {!data.topItems.length ? <p className="text-sm text-text-secondary">Your submitted catalogue will appear here.</p> : null}
              </div>
            </div>

            <div className="space-y-5">
              <div className="rounded-2xl border border-white/10 p-5">
                <h3 className="font-semibold">Editorial progress</h3>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Card label="Uploads" value={data.catalogue.uploads} />
                  <Card label="Beats" value={data.catalogue.beats} />
                  <Card label="Awaiting review" value={data.catalogue.awaitingReview} />
                  <Card label="Open requests" value={data.catalogue.openRequests} />
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 p-5">
                <h3 className="font-semibold">Playback health</h3>
                <p className="mt-3 text-2xl text-brand">{data.summary.playbackErrors}</p>
                <p className="text-xs text-text-secondary">audio failures · {data.summary.playbackErrorRate}% of starts</p>
              </div>
              <div className="rounded-2xl border border-white/10 p-5">
                <h3 className="font-semibold">Genres by playback starts</h3>
                <div className="mt-3 space-y-2">
                  {data.genres.map((genre) => <p key={genre.genre} className="flex justify-between text-sm text-text-secondary"><span>{genre.genre}</span><span className="text-brand">{genre.plays}</span></p>)}
                  {!data.genres.length ? <p className="text-sm text-text-secondary">No genre activity yet.</p> : null}
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </section>
  )
}
