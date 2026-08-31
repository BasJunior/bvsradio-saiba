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
    <section className="bvs-surface mb-6 rounded-[1.75rem] p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="bvs-section-kicker">Artist directory</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">Artists on BVS</h2>
          <p className="mt-1 text-sm text-text-secondary">Jump straight into a verified artist profile and their published music.</p>
        </div>
        <Link href="/music/artists" className="text-sm font-medium text-brand hover:underline">
          All artists →
        </Link>
      </div>

      <div className="mt-4 grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
        {artists.slice(0, limit).map((artist) => (
          <Link
            key={artist.id}
            href={`/artist/${artist.username}`}
            className="bvs-surface-quiet bvs-surface-hover group flex min-w-0 items-center gap-3 rounded-2xl p-3 transition"
          >
            <div className="relative h-12 w-12 flex-none overflow-hidden rounded-full border border-white/10 bg-black/40 shadow-[0_8px_24px_rgba(0,0,0,.25)]">
              <Image
                src={artist.image}
                alt={artist.name}
                fill
                unoptimized={/^https?:\/\//i.test(artist.image)}
                sizes="48px"
                className="object-cover object-center"
              />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-sm font-semibold tracking-tight group-hover:text-brand">{artist.name}</h3>
              <p className="truncate text-xs text-text-secondary">
                {artist.trackCount} published {artist.trackCount === 1 ? 'track' : 'tracks'}
              </p>
            </div>
            <span className="flex-none text-sm text-white/40 transition group-hover:translate-x-0.5 group-hover:text-brand" aria-hidden="true">→</span>
          </Link>
        ))}
      </div>
    </section>
  )
}
