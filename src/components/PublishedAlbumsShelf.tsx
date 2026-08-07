'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { PublicRelease } from '@/lib/public-releases'

export default function PublishedAlbumsShelf() {
  const [releases, setReleases] = useState<PublicRelease[]>([])

  useEffect(() => {
    fetch('/api/releases/public', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((payload: { releases?: PublicRelease[] }) => setReleases(payload.releases || []))
      .catch(() => undefined)
  }, [])

  if (!releases.length) return null
  return (
    <section className="mb-10 rounded-3xl border border-white/10 bg-bg-card/35 p-5 sm:p-7">
      <p className="text-xs uppercase tracking-[3px] text-brand">Published releases</p>
      <h2 className="mt-2 text-3xl font-semibold tracking-tight">Albums &amp; EPs</h2>
      <p className="mt-2 text-sm text-text-secondary">Open a release and listen in its intended track order.</p>
      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {releases.map((release) => (
          <Link key={release.id} href={`/album/${release.id}`} className="group min-w-0">
            <div className="relative aspect-square overflow-hidden rounded-2xl border border-white/10 bg-black/40">
              <Image src={release.cover} alt={`${release.title} cover`} fill unoptimized={/^https?:\/\//i.test(release.cover)} sizes="(max-width:768px) 50vw, 20vw" className="object-cover object-center transition duration-300 group-hover:scale-[1.04]" />
            </div>
            <h3 className="mt-3 truncate font-semibold group-hover:text-brand">{release.title}</h3>
            <p className="truncate text-xs text-text-secondary">{release.artist} · {release.tracks.length} tracks</p>
          </Link>
        ))}
      </div>
    </section>
  )
}
