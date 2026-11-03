'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useStationPlayer } from '@/components/StationPlayer'
import { rankMovement, type TrendingBoard } from '@/lib/trending'

export default function HomeTopFive() {
  const player = useStationPlayer()
  const [board, setBoard] = useState<TrendingBoard | null>(null)

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

  const entries = board?.entries.slice(0, 5) || []

  return (
    <section className="mt-8 overflow-hidden rounded-[1.6rem] border border-white/10 bg-white/[.025] shadow-[0_18px_50px_rgba(0,0,0,.18)]" aria-label="Top 5 songs">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-4 sm:px-5">
        <h2 className="text-base font-semibold tracking-tight sm:text-lg">Top 5</h2>
        <Link href="/trending" className="text-sm font-medium text-brand hover:underline">See all →</Link>
      </div>

      {!board ? (
        <div className="px-5 py-8 text-sm text-text-secondary">Loading Top 5…</div>
      ) : !entries.length ? (
        <div className="px-5 py-8 text-sm text-text-secondary">The chart is still building.</div>
      ) : (
        <ol className="divide-y divide-white/10">
          {entries.map(entry => {
            const active = player.current?.id === entry.id
            const movement = rankMovement(entry.rank, entry.previousRank, board.hasPrevious)
            const down = movement.startsWith('↓')
            const up = movement.startsWith('↑')
            const neutral = movement === '—'
            return (
              <li key={entry.id} className="flex items-center gap-3 px-3 py-3 sm:gap-4 sm:px-5">
                <div className="flex w-9 shrink-0 flex-col items-center justify-center text-center sm:w-10">
                  <span className="text-base font-semibold tabular-nums sm:text-lg">{entry.rank}</span>
                  <span className={`mt-0.5 text-[10px] font-semibold ${down ? 'text-rose-400' : up ? 'text-brand' : 'text-text-secondary'}`} aria-label={neutral ? 'No rank change' : movement === 'NEW' ? 'New entry' : movement}>
                    {movement}
                  </span>
                </div>

                <Link href={`/song/${entry.id}`} className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-white/5 sm:h-14 sm:w-14">
                  {entry.artwork ? <Image src={entry.artwork} alt="" fill unoptimized className="object-cover" /> : null}
                </Link>

                <div className="min-w-0 flex-1">
                  <Link href={`/song/${entry.id}`} className="block truncate text-sm font-semibold hover:text-brand sm:text-base">{entry.title}</Link>
                  <p className="mt-0.5 truncate text-xs text-text-secondary sm:text-sm">{entry.artist}</p>
                </div>

                <button
                  type="button"
                  aria-label={`${active && player.isPlaying ? 'Pause' : 'Play'} ${entry.title}`}
                  onClick={() => active ? player.toggle() : player.playNow({ id: entry.id, title: entry.title, artist: entry.artist, src: entry.src, artwork: entry.artwork, project: 'Top 5' }, { from: 'Top 5', related: entries.map(row => ({ id: row.id, title: row.title, artist: row.artist, src: row.src, artwork: row.artwork, project: 'Top 5' })) })}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/15 bg-white/[.04] text-sm text-white transition hover:border-brand/40 hover:text-brand sm:h-11 sm:w-11"
                >
                  {active && player.isPlaying ? 'Ⅱ' : '▶'}
                </button>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
