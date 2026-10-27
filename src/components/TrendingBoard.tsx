'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import LibraryAction from '@/components/LibraryAction'
import SongShareButton from '@/components/SongShareButton'
import { useStationPlayer } from '@/components/StationPlayer'
import { rankMovement, type TrendingBoard as Board, type TrendingWindow } from '@/lib/trending'

export default function TrendingBoard({ surface, preview = false }: { surface?: 'ios' | 'android'; preview?: boolean }) {
  const [window, setWindow] = useState<TrendingWindow>(preview ? 'week' : 'now')
  const [result, setResult] = useState<{ key: string; board: Board | null; error: boolean; receivedAt: number } | null>(null)
  const [retry, setRetry] = useState(0)
  const player = useStationPlayer()
  const path = surface ? `/app/${surface}/trending` : '/trending'
  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/trending?window=${window}`, { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('Unavailable')
      return response.json() as Promise<Board>
    }).then(board => { if (!controller.signal.aborted) setResult({ key: `${window}:${retry}`, board, error: false, receivedAt: Date.now() }) }).catch(() => { if (!controller.signal.aborted) setResult({ key: `${window}:${retry}`, board: null, error: true, receivedAt: Date.now() }) })
    return () => controller.abort()
  }, [window, retry])
  const currentResult = result?.key === `${window}:${retry}` ? result : null
  const board = currentResult?.board
  const error = currentResult?.error
  const entries = board?.entries.slice(0, preview ? 5 : 20) || []
  const stale = board?.generatedAt && (currentResult?.receivedAt || 0) - Date.parse(board.generatedAt) > 3 * 60 * 60 * 1000
  return <section className="mt-8 border-t border-white/15 pt-6" aria-label="BVS Trending">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="text-xs uppercase tracking-[.2em] text-brand">BVS Trending</p><h2 className="mt-2 text-2xl font-semibold">Hear what’s picking up.</h2><p className="mt-2 max-w-xl text-sm text-text-secondary">The songs listeners are discovering, saving and coming back to.</p></div>
      {preview ? <Link href={path} className="inline-flex min-h-11 items-center text-sm text-brand">Full Top 20 →</Link> : null}
    </div>
    <div className="mt-5 flex gap-2" aria-label="Trending period">{([['now', 'Trending Now'], ['week', 'This Week']] as const).map(([key, label]) => <button type="button" key={key} aria-pressed={window === key} onClick={() => setWindow(key)} className={`min-h-11 border px-4 text-sm ${window === key ? 'border-brand bg-brand/10 text-brand' : 'border-white/15 text-text-secondary'}`}>{label}</button>)}</div>
    <p className="mt-3 text-xs text-text-secondary">{window === 'now' ? 'Last 24 hours' : 'Last 7 days'} · Updated hourly · Listener momentum</p>
    {board?.generatedAt ? <p className="mt-1 text-xs text-text-secondary">{stale ? 'Last available chart' : 'Chart updated'} {new Date(board.generatedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}{board.hasPrevious ? ' · Movement since the previous chart' : ' · First chart'}</p> : null}
    {error ? <div role="status" className="mt-5 text-sm text-text-secondary">Trending couldn’t load. <button type="button" onClick={() => setRetry(x => x + 1)} className="min-h-11 px-2 text-brand">Try again</button></div> : !board ? <p role="status" className="py-8 text-sm text-text-secondary">Loading the chart…</p> : !entries.length ? <div className="py-8"><p className="font-semibold">The next wave is still building.</p><p className="mt-2 text-sm text-text-secondary">This period does not have enough distinct listener momentum yet. BVS keeps the chart honest rather than filling it with weak signals.</p>{window === 'now' ? <button type="button" onClick={() => setWindow('week')} className="mt-3 min-h-11 border border-brand/30 px-4 text-sm font-semibold text-brand">See what’s moving this week →</button> : null}</div> : <ol className="mt-5 divide-y divide-white/10">{entries.map(entry => {
      const songPath = `${surface ? `/app/${surface}` : ''}/song/${entry.id}`
      const active = player.current?.id === entry.id
      const movement = rankMovement(entry.rank, entry.previousRank, board!.hasPrevious)
      return <li key={entry.id} className={`py-4 ${active ? 'bg-brand/[.06]' : ''}`}>
        <div className="flex items-center gap-3 sm:gap-5">
          <div className="w-10 shrink-0 text-center"><span className="block text-xl font-semibold tabular-nums">{entry.rank}</span><span aria-label={movement === '—' ? 'No rank change' : movement === 'NEW' ? 'New entry' : movement.startsWith('↑') ? `Up ${movement.slice(1)} places` : `Down ${movement.slice(1)} places`} className={`text-[10px] font-semibold ${movement.startsWith('↓') ? 'text-text-secondary' : 'text-brand'}`}>{movement}</span></div>
          <button type="button" aria-label={`${active && player.isPlaying ? 'Pause' : 'Play'} ${entry.title}`} onClick={() => active ? player.toggle() : player.playNow({ id: entry.id, title: entry.title, artist: entry.artist, src: entry.src, artwork: entry.artwork, project: 'BVS Trending' }, { from: 'BVS Trending', related: board!.entries.map(row => ({ id: row.id, title: row.title, artist: row.artist, src: row.src, artwork: row.artwork, project: 'BVS Trending' })) })} className="relative h-16 w-16 shrink-0 overflow-hidden bg-white/5">
            {entry.artwork ? <Image src={entry.artwork} alt="" fill unoptimized className="object-cover" /> : null}<span className="absolute inset-0 grid place-items-center bg-black/30 text-white" aria-hidden="true">{active && player.isPlaying ? 'Ⅱ' : '▶'}</span>
          </button>
          <div className="min-w-0 flex-1"><Link href={songPath} className="block truncate font-semibold hover:text-brand">{entry.title}</Link><p className="truncate text-sm text-text-secondary">{entry.artist}</p><p className="mt-1 hidden text-xs text-text-secondary sm:block">{entry.reason}</p></div>
        </div>
        <div className="ml-[3.25rem] mt-3 flex flex-wrap items-center gap-3 sm:ml-[4rem]">
          <LibraryAction rectangular compact analyticsSource="trending" item={{ id: entry.id, title: entry.title, subtitle: entry.artist, image: entry.artwork, kind: 'track', href: songPath }} />
          <SongShareButton id={entry.id} title={entry.title} artist={entry.artist} image={entry.artwork} />
        </div>
      </li>
    })}</ol>}
    {!preview ? <details className="mt-6 border-t border-white/10 pt-4 text-sm text-text-secondary"><summary className="min-h-11 cursor-pointer">How BVS Trending works</summary><p className="max-w-2xl leading-6">Unique qualified listeners, listening completion, saves, shares, return listeners and recent growth shape the chart. Repeat actions are capped and unusual bursts are limited. Only published, BVS-approved songs qualify. Premium never buys a position. Radio rotation remains an editorial decision.</p></details> : null}
  </section>
}
