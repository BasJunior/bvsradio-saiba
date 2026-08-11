'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

type Analytics = {
  rangeDays: number
  registrations: {
    total: number
    previousTotal: number
    growthPercent: number
    daily: Array<{ day: string; count: number }>
    byRole: Record<string, number>
  }
  activity: {
    uniqueSessions: number
    playerStarts: number
    listeningMinutes: number
    uploads: number
    trackSaves: number
  }
  pipeline: {
    awaitingReview: number
    published: number
    inRotation: number
    openRequests: number
    publicationRate: number
  }
  performance: {
    topPlayed: Array<{ id: string; label: string; plays: number }>
    topSaved: Array<{ id: string; label: string; saves: number }>
    popularGenres: Array<{ genre: string; plays: number }>
  }
  reliability: {
    playbackErrors: number
    playbackErrorRate: number
    checkoutStarts?: number
    checkoutCompletions?: number
    paymentErrors?: number
    paymentErrorRate?: number
  }
  permissions: { commerce: boolean }
}

function Metric({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
      <p className="text-xs text-text-secondary">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-brand">{value}</p>
      {note ? <p className="mt-1 text-[11px] text-text-secondary">{note}</p> : null}
    </div>
  )
}

function RankedList({ title, rows }: { title: string; rows: Array<{ label: string; value: number }> }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[.025] p-5">
      <h3 className="font-semibold">{title}</h3>
      <div className="mt-4 space-y-3">
        {rows.map((row, index) => (
          <div key={`${row.label}-${index}`} className="flex items-start justify-between gap-4 text-sm">
            <p className="min-w-0 truncate text-text-secondary">{index + 1}. {row.label}</p>
            <span className="shrink-0 text-brand">{row.value.toLocaleString()}</span>
          </div>
        ))}
        {!rows.length ? <p className="text-sm text-text-secondary">Not enough activity yet.</p> : null}
      </div>
    </div>
  )
}

export default function EditorialAnalytics({ token }: { token: string }) {
  const [days, setDays] = useState(30)
  const [data, setData] = useState<Analytics | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`/api/admin/editorial/analytics?days=${days}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Could not load analytics.')
      setData(payload)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load analytics.')
    } finally {
      setLoading(false)
    }
  }, [days, token])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const chart = useMemo(() => {
    if (!data) return null
    const points = data.registrations.daily
    const width = 760
    const height = 220
    const left = 44
    const right = 16
    const top = 18
    const bottom = 34
    const plotWidth = width - left - right
    const plotHeight = height - top - bottom
    const max = Math.max(1, ...points.map((point) => point.count))
    const plotted = points.map((point, index) => ({
      ...point,
      x: points.length === 1 ? left + plotWidth / 2 : left + (index / (points.length - 1)) * plotWidth,
      y: top + plotHeight - (point.count / max) * plotHeight,
    }))
    const line = plotted.map((point) => `${point.x},${point.y}`).join(' ')
    const area = plotted.length
      ? `${left},${top + plotHeight} ${line} ${left + plotWidth},${top + plotHeight}`
      : ''
    const labelIndexes = Array.from(new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])).filter((index) => index >= 0)

    return { width, height, left, top, plotWidth, plotHeight, max, points: plotted, line, area, labelIndexes }
  }, [data])

  return (
    <section id="ed-analytics" className="mt-10 scroll-mt-36">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[.2em] text-brand">Staff analytics</p>
          <h2 className="mt-2 text-2xl font-semibold">Site health and growth</h2>
          <p className="mt-2 text-sm text-text-secondary">Aggregated first-party activity. No member emails, IP addresses or payment details.</p>
        </div>
        <div className="flex gap-2">
          {[7, 30, 90].map((range) => (
            <button key={range} onClick={() => setDays(range)} className={`rounded-full border px-4 py-2 text-xs ${days === range ? 'border-brand bg-brand text-black' : 'border-white/15 text-text-secondary'}`}>
              {range} days
            </button>
          ))}
        </div>
      </div>

      {loading && !data ? <div className="mt-5 animate-pulse rounded-2xl border border-white/10 p-8 text-sm text-text-secondary">Loading analytics…</div> : null}
      {error ? (
        <div className="mt-5 rounded-2xl border border-red-400/30 bg-red-500/10 p-5 text-sm text-red-200">
          {error} <button onClick={() => void load()} className="ml-2 underline">Retry</button>
        </div>
      ) : null}

      {data ? (
        <>
          <div className="mt-5 grid gap-4 lg:grid-cols-[1.7fr_1fr]">
            <div className="rounded-2xl border border-white/10 bg-white/[.025] p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <p className="text-sm text-text-secondary">New members</p>
                  <p className="mt-1 text-3xl font-semibold">{data.registrations.total}</p>
                </div>
                <p className={data.registrations.growthPercent >= 0 ? 'text-emerald-300' : 'text-red-300'}>
                  {data.registrations.growthPercent >= 0 ? '+' : ''}{data.registrations.growthPercent}% vs previous period
                </p>
              </div>
              {chart ? (
                <div className="mt-5 overflow-hidden rounded-xl border border-white/[.06] bg-black/20 px-2 py-3">
                  <svg viewBox={`0 0 ${chart.width} ${chart.height}`} className="h-52 w-full" role="img" aria-label={`Daily new members over ${data.rangeDays} days`}>
                    <defs>
                      <linearGradient id="memberGrowthFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="currentColor" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {[0, 0.5, 1].map((ratio) => {
                      const y = chart.top + chart.plotHeight * ratio
                      const value = Math.round(chart.max * (1 - ratio))
                      return (
                        <g key={ratio}>
                          <line x1={chart.left} y1={y} x2={chart.left + chart.plotWidth} y2={y} stroke="currentColor" strokeDasharray="4 7" className="text-white/10" />
                          <text x={chart.left - 10} y={y + 4} textAnchor="end" fill="currentColor" className="text-[11px] text-text-secondary">{value}</text>
                        </g>
                      )
                    })}
                    {chart.area ? <polygon points={chart.area} fill="url(#memberGrowthFill)" className="text-brand" /> : null}
                    <polyline points={chart.line} fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" className="text-brand" />
                    {chart.points.map((point, index) => (
                      <circle key={point.day} cx={point.x} cy={point.y} r={index === chart.points.length - 1 ? 5 : 3} fill="currentColor" stroke="#111" strokeWidth="2" className="text-brand">
                        <title>{point.day}: {point.count} new member{point.count === 1 ? '' : 's'}</title>
                      </circle>
                    ))}
                    {chart.labelIndexes.map((index) => {
                      const point = chart.points[index]
                      return point ? <text key={point.day} x={point.x} y={chart.height - 9} textAnchor={index === 0 ? 'start' : index === chart.points.length - 1 ? 'end' : 'middle'} fill="currentColor" className="text-[11px] text-text-secondary">{new Date(`${point.day}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</text> : null
                    })}
                  </svg>
                </div>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(data.registrations.byRole).map(([role, count]) => (
                  <span key={role} className="rounded-full border border-white/10 px-3 py-1 text-xs capitalize text-text-secondary">{role}: {count}</span>
                ))}
                {!Object.keys(data.registrations.byRole).length ? <span className="text-xs text-text-secondary">No registrations in this period.</span> : null}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Metric label="Listening sessions" value={data.activity.uniqueSessions} />
              <Metric label="Player starts" value={data.activity.playerStarts} />
              <Metric label="Listening minutes" value={data.activity.listeningMinutes.toLocaleString()} note="Estimated from privacy-safe duration buckets" />
              <Metric label="Track saves" value={data.activity.trackSaves} />
              <Metric label="Uploads" value={data.activity.uploads} />
              <Metric label="Awaiting review" value={data.pipeline.awaitingReview} />
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Published catalogue" value={data.pipeline.published} />
            <Metric label="In rotation" value={data.pipeline.inRotation} />
            <Metric label="Open artist requests" value={data.pipeline.openRequests} />
            <Metric label="Publication rate" value={`${data.pipeline.publicationRate}%`} note="Published tracks/releases ÷ catalogue records" />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <RankedList title="Most played catalogue" rows={data.performance.topPlayed.map((item) => ({ label: item.label, value: item.plays }))} />
            <RankedList title="Most saved this period" rows={data.performance.topSaved.map((item) => ({ label: item.label, value: item.saves }))} />
            <RankedList title="Genres by catalogue plays" rows={data.performance.popularGenres.map((item) => ({ label: item.genre, value: item.plays }))} />
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[.025] p-5">
            <h3 className="font-semibold">Attention required</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="Playback failures" value={data.reliability.playbackErrors} note={`${data.reliability.playbackErrorRate}% of player starts`} />
              <Metric label="Editorial queue" value={data.pipeline.awaitingReview} />
              {data.permissions.commerce ? <Metric label="Checkout completions" value={data.reliability.checkoutCompletions || 0} /> : null}
              {data.permissions.commerce ? <Metric label="Payment failures" value={data.reliability.paymentErrors || 0} note={`${data.reliability.paymentErrorRate || 0}% of checkout starts`} /> : null}
            </div>
          </div>
        </>
      ) : null}
    </section>
  )
}
