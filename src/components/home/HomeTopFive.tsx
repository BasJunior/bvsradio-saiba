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

  return (
    <section className="overflow-hidden border border-white/15 bg-black/55 shadow-[0_20px_60px_rgba(0,0,0,.28)]" aria-label="Top 5 songs">
      <div className="flex items-end justify-between px-4 pb-3 pt-4 sm:px-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-brand">BVS Discover</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight sm:text-xl">Top 5 this week</h2>
        </div>
        <Link href="/trending" className="pb-0.5 text-xs font-semibold text-brand hover:underline sm:text-sm">Full chart →</Link>
      </div>

      {!board ? (
        <div className="grid aspect-video place-items-center border-t border-white/10 px-5 text-sm text-text-secondary">Loading Top 5…</div>
      ) : !entries.length || !current ? (
        <div className="grid aspect-video place-items-center border-t border-white/10 px-5 text-sm text-text-secondary">The chart is still building.</div>
      ) : (
        <div className="relative aspect-video overflow-hidden border-t border-white/10 bg-black">
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

          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-black/5" />

          <button
            type="button"
            aria-label={`${active && player.isPlaying ? 'Pause' : 'Play'} ${current.title}`}
            onClick={() => active ? player.toggle() : player.playNow(
              { id: current.id, title: current.title, artist: current.artist, src: current.src, artwork: current.artwork, project: 'BVS Top 5' },
              { from: 'BVS Top 5', related: entries.map(row => ({ id: row.id, title: row.title, artist: row.artist, src: row.src, artwork: row.artwork, project: 'BVS Top 5' })) },
            )}
            className="absolute right-3 top-3 grid h-11 w-11 place-items-center bg-brand text-sm font-bold text-black shadow-lg transition hover:scale-105"
          >
            {active && player.isPlaying ? 'Ⅱ' : '▶'}
          </button>

          <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
            <div className="flex items-end gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center bg-brand text-base font-black text-black">#{current.rank}</div>
              <div className="min-w-0 flex-1">
                <Link href={`/song/${current.id}`} className="block truncate text-base font-semibold text-white hover:text-brand sm:text-lg">{current.title}</Link>
                <p className="mt-0.5 truncate text-xs text-white/75 sm:text-sm">{current.artist}</p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-1.5" aria-label="Top 5 slide position">
                {entries.map((entry, entryIndex) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => setIndex(entryIndex)}
                    aria-label={`Show number ${entry.rank}: ${entry.title}`}
                    aria-current={entryIndex === index ? 'true' : undefined}
                    className={`h-1.5 transition-all ${entryIndex === index ? 'w-8 bg-brand' : 'w-1.5 bg-white/45 hover:bg-white/70'}`}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-white/65 sm:text-xs">
                <span className={movement.startsWith('↑') || movement === 'NEW' ? 'text-brand' : movement.startsWith('↓') ? 'text-rose-300' : ''}>{movement}</span>
                <span>{index + 1} / {entries.length}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
