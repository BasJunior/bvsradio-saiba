'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { PublishedArtistSummary } from '@/lib/artist-content'

export default function PublishedArtistsShelf({ limit = 6 }: { limit?: number }) {
  const [artists, setArtists] = useState<PublishedArtistSummary[]>([])

  useEffect(() => {
    let active = true
    fetch('/api/artists')
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((payload: { artists?: PublishedArtistSummary[] }) => {
        if (active) setArtists(payload.artists || [])
      })
      .catch(() => undefined)
    return () => { active = false }
  }, [])

  if (!artists.length) return null

  return (
    <section className="mb-10 rounded-3xl border border-white/10 bg-bg-card/35 p-5 sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[3px] text-brand">Published on BVS</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">Meet the artists</h2>
          <p className="mt-2 text-sm text-text-secondary">Editorially verified profiles and their published music.</p>
        </div>
        <Link href="/music/artists" className="rounded-full border border-white/15 px-4 py-2 text-sm hover:border-brand">
          View all artists →
        </Link>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {artists.slice(0, limit).map((artist) => (
          <Link key={artist.id} href={`/artist/${artist.username}`} className="group min-w-0">
            <div className="relative aspect-square overflow-hidden rounded-2xl border border-white/10 bg-white/5">
              <Image src={artist.image} alt={artist.name} fill unoptimized={/^https?:\/\//i.test(artist.image)} className="object-cover transition group-hover:scale-[1.03]" />
            </div>
            <h3 className="mt-3 truncate font-semibold group-hover:text-brand">{artist.name}</h3>
            <p className="truncate text-xs text-text-secondary">
              {artist.trackCount} published {artist.trackCount === 1 ? 'track' : 'tracks'}
            </p>
          </Link>
        ))}
      </div>
    </section>
  )
}
