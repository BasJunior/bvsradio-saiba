'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useStationPlayer } from '@/components/StationPlayer'
import { rankMovement, type TrendingBoard } from '@/lib/trending'

export default function HomeTopFive() {
  const player = useStationPlayer()
  const [board, setBoard] = useState<TrendingBoard | null>(null)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/trending?window=week', { signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        if (!response.ok) throw new Error('Unavailable')
        return response.json() as Promise<TrendingBoard>
      })
      .then(value => { if (!controller.signal.aborted) setBoard(value) })
      .catch(() => undefined)
    return () => controller.abort()
  }, [])

  const entries = useMemo(() => board?.entries.slice(0, 5) || [], [board])

  useEffect(() => {
    if (entries.length < 2) return
    const timer = window.setInterval(() => {
      setIndex(current => (current + 1) % entries.length)
    }, 5000)
    return () => window.clearInterval(timer)
  }, [entries.length])

  useEffect(() => {
    if (index >= entries.length && entries.length) setIndex(0)
  }, [entries.length, index])

  const current = entries[index]
  const movement = current && board ? rankMovement(current.rank, current.previousRank, board.hasPrevious) : '—'
  const active = current ? player.current?.id === current.id : false

  const previous = () => setIndex(currentIndex => (currentIndex - 1 + entries.length) % entries.length)
  const next = () => setIndex(currentIndex => (currentIndex + 1) % entries.length)

  return (
    <section className="overflow-hidden rounded-[1.6rem] border border-white/10 bg-white/[.025] shadow-[0_18px_50px_rgba(0,0,0,.18)]" aria-label="Top 5 songs">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-brand">This week</p>
          <h2 className="mt-0.5 text-base font-semibold tracking-tight sm:text-lg">Top 5</h2>
        </div>
        <Link href="/trending" className="text-sm font-medium text-brand hover:underline">See all →</Link>
      </div>

      {!board ? (
        <div className="grid aspect-[4/3] place-items-center px-5 text-sm text-text-secondary">Loading Top 5…</div>
      ) : !entries.length || !current ? (
        <div className="grid aspect-[4/3] place-items-center px-5 text-sm text-text-secondary">The chart is still building.</div>
      ) : (
        <div className="relative aspect-[4/3] overflow-hidden bg-black">
          {current.artwork ? (
            <Image
              key={current.id}
              src={current.artwork}
              alt={`${current.title} by ${current.artist}`}
              fill
              priority
              unoptimized
              className="object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-white/[.04]" />
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/15 to-black/10" />

          <div className="absolute left-3 top-3 flex items-center gap-2">
            <span className="rounded-full border border-white/20 bg-black/55 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md">#{current.rank}</span>
            <span className={`rounded-full border border-white/15 bg-black/45 px-2.5 py-1 text-[10px] font-semibold backdrop-blur-md ${movement.startsWith('↓') ? 'text-rose-300' : movement.startsWith('↑') || movement === 'NEW' ? 'text-brand' : 'text-white/70'}`}>
              {movement}
            </span>
          </div>

          {entries.length > 1 ? (
            <>
              <button type="button" onClick={previous} aria-label="Previous Top 5 song" className="absolute left-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-black/45 text-white backdrop-blur-md hover:bg-black/65">‹</button>
              <button type="button" onClick={next} aria-label="Next Top 5 song" className="absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-black/45 text-white backdrop-blur-md hover:bg-black/65">›</button>
            </>
          ) : null}

          <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
            <div className="flex items-end gap-3">
              <div className="min-w-0 flex-1">
                <Link href={`/song/${current.id}`} className="block truncate text-xl font-semibold text-white hover:text-brand sm:text-2xl">{current.title}</Link>
                <p className="mt-1 truncate text-sm text-white/70">{current.artist}</p>
              </div>
              <button
                type="button"
                aria-label={`${active && player.isPlaying ? 'Pause' : 'Play'} ${current.title}`}
                onClick={() => active ? player.toggle() : player.playNow(
                  { id: current.id, title: current.title, artist: current.artist, src: current.src, artwork: current.artwork, project: 'Top 5' },
                  { from: 'Top 5', related: entries.map(row => ({ id: row.id, title: row.title, artist: row.artist, src: row.src, artwork: row.artwork, project: 'Top 5' })) },
                )}
                className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand text-base font-bold text-black shadow-lg transition hover:scale-105"
              >
                {active && player.isPlaying ? 'Ⅱ' : '▶'}
              </button>
            </div>

            <div className="mt-4 flex items-center justify-center gap-1.5" aria-label="Top 5 slide position">
              {entries.map((entry, entryIndex) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setIndex(entryIndex)}
                  aria-label={`Show number ${entry.rank}: ${entry.title}`}
                  aria-current={entryIndex === index ? 'true' : undefined}
                  className={`h-1.5 rounded-full transition-all ${entryIndex === index ? 'w-6 bg-brand' : 'w-1.5 bg-white/45 hover:bg-white/70'}`}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
