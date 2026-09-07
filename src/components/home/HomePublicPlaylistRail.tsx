'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type PublicPlaylist = {
  id: string
  title: string
  description?: string | null
  creator: string
  creatorUsername?: string | null
  coverUrl?: string | null
  trackCount: number
}

export default function HomePublicPlaylistRail() {
  const [playlists, setPlaylists] = useState<PublicPlaylist[]>([])

  useEffect(() => {
    let active = true
    fetch('/api/playlists/public', { cache: 'no-store' })
      .then(response => response.ok ? response.json() : Promise.reject())
      .then((payload: { playlists?: PublicPlaylist[] }) => {
        if (active) setPlaylists((payload.playlists || []).filter(item => item.trackCount > 0).slice(0, 6))
      })
      .catch(() => undefined)
    return () => { active = false }
  }, [])

  if (!playlists.length) return null

  return <section className="border-y border-white/10 bg-bg-secondary/35 py-10 sm:py-14" aria-labelledby="made-on-bvs-title">
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.2em] text-brand">Made on BVS</p>
          <h2 id="made-on-bvs-title" className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Playlists from listeners and creators.</h2>
          <p className="mt-2 max-w-2xl text-sm text-text-secondary sm:text-base">See how other people are putting the BVS catalogue together, then build your own.</p>
        </div>
        <Link href="/search?mode=playlists" className="text-sm font-semibold text-brand hover:underline">Explore playlists →</Link>
      </div>

      <div className="mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3">
        {playlists.map(playlist => <Link key={playlist.id} href={`/playlist/${playlist.id}`} className="group w-[15.5rem] shrink-0 snap-start overflow-hidden rounded-[1.45rem] border border-white/10 bg-white/[.025] transition hover:-translate-y-0.5 hover:border-brand/35">
          <div className="relative aspect-square bg-gradient-to-br from-brand/20 via-white/[.04] to-black">
            {playlist.coverUrl ? <img src={playlist.coverUrl} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-5xl font-semibold text-brand/65">BVS</div>}
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
            <span className="absolute bottom-3 left-3 rounded-full bg-black/65 px-2.5 py-1 text-[11px] text-white/80 backdrop-blur">{playlist.trackCount} track{playlist.trackCount === 1 ? '' : 's'}</span>
          </div>
          <div className="p-4">
            <h3 className="truncate text-lg font-semibold">{playlist.title}</h3>
            <p className="mt-1 truncate text-sm text-text-secondary">by {playlist.creator}</p>
            {playlist.description ? <p className="mt-2 line-clamp-2 text-sm leading-5 text-text-secondary">{playlist.description}</p> : null}
            <p className="mt-3 text-sm font-semibold text-brand">Open playlist →</p>
          </div>
        </Link>)}
      </div>
    </div>
  </section>
}
