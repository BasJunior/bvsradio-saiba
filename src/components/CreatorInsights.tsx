'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

type MetricKey = 'plays' | 'saves' | 'minutes'
type Insights = {
  rangeDays: number
  summary: {
    plays: number
    previousPlays: number
    playGrowthPercent: number
    uniqueSessions: number
    listeningMinutes: number
    saves: number
    saveRate: number
    playbackErrors: number
    playbackErrorRate: number
  }
  catalogue: {
    uploads: number
    beats: number
    published: number
    inRotation: number
    awaitingReview: number
    openRequests: number
  }
  daily: Array<{ day: string; plays: number; saves: number; minutes: number }>
  topItems: Array<{
    id: string
    title: string
    kind: string
    plays: number
    saves: number
    totalPlays: number
    status: string
    published: boolean
    inRotation: boolean
  }>
  genres: Array<{ genre: string; plays: number }>
}

function Card({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[.025] p-4">
      <p className="text-xs text-text-secondary">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-brand">{value}</p>
      {note ? <p className="mt-1 text-[11px] text-text-secondary">{note}</p> : null}
    </div>
  )
}

export default function CreatorInsights({ token }: { token: string }) {
  const [days, setDays] = useState(30)
  const [metric, setMetric] = useState<MetricKey>('plays')
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
    if (!data) return ''
    const max = Math.max(1, ...data.daily.map((point) => point[metric]))
    return data.daily.map((point, index) => {
      const x = data.daily.length === 1 ? 0 : (index / (data.daily.length - 1)) * 100
      const y = 92 - (point[metric] / max) * 80
      return `${x},${y}`
    }).join(' ')
  }, [data, metric])

  return (
    <section className="mt-10 rounded-3xl border border-white/10 bg-white/[.015] p-5 sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[.22em] text-brand">Your insights</p>
          <h2 className="mt-2 text-2xl font-semibold">Catalogue performance</h2>
          <p className="mt-2 text-sm text-text-secondary">Only activity tied to your own tracks and beats is included. Listener identities are never shown.</p>
          <p className="mt-1 text-[11px] text-text-secondary">Refreshes every 60 seconds{lastUpdated ? ` · updated ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}</p>
        </div>
        <div className="flex gap-2">
          {[7, 30, 90].map((range) => (
            <button key={range} onClick={() => setDays(range)} className={`rounded-full border px-3 py-1.5 text-xs ${days === range ? 'border-brand bg-brand text-black' : 'border-white/15 text-text-secondary'}`}>
              {range} days
            </button>
          ))}
        </div>
      </div>

      {loading && !data ? <p className="mt-6 animate-pulse text-sm text-text-secondary">Loading your insights…</p> : null}
      {error ? <p className="mt-5 rounded-xl bg-red-500/10 p-4 text-sm text-red-200">{error} <button onClick={() => void load()} className="underline">Retry</button></p> : null}

      {data ? (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <Card label="Playback starts" value={data.summary.plays} note={`${data.summary.playGrowthPercent >= 0 ? '+' : ''}${data.summary.playGrowthPercent}% vs previous period`} />
            <Card label="Listening sessions" value={data.summary.uniqueSessions} note="Sessions with at least one start" />
            <Card label="Listening minutes" value={data.summary.listeningMinutes} note="Privacy-safe estimate" />
            <Card label="Saves" value={data.summary.saves} note={`${data.summary.saveRate}% save-to-play rate`} />
            <Card label="Published" value={data.catalogue.published} />
            <Card label="In rotation" value={data.catalogue.inRotation} />
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-semibold">Performance over time</h3>
              <div className="flex gap-2">
                {(['plays', 'saves', 'minutes'] as MetricKey[]).map((value) => (
                  <button key={value} onClick={() => setMetric(value)} className={`rounded-full px-3 py-1 text-xs capitalize ${metric === value ? 'bg-brand text-black' : 'border border-white/10 text-text-secondary'}`}>
                    {value === 'plays' ? 'starts' : value}
                  </button>
                ))}
              </div>
            </div>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="mt-4 h-44 w-full" role="img" aria-label={`${metric} over ${data.rangeDays} days`}>
              <line x1="0" y1="92" x2="100" y2="92" stroke="currentColor" className="text-white/10" />
              <polyline points={chart} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" className="text-brand" />
            </svg>
            {!data.daily.some((point) => point[metric] > 0) ? <p className="text-center text-xs text-text-secondary">No {metric} recorded in this period yet.</p> : null}
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
            <div className="rounded-2xl border border-white/10 p-5">
              <h3 className="font-semibold">Your top catalogue</h3>
              <div className="mt-4 space-y-3">
                {data.topItems.map((item) => (
                  <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3 first:border-t-0 first:pt-0">
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
