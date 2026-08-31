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
    <section className="bvs-surface mb-6 rounded-[1.75rem] p-4 sm:p-5">
      <p className="bvs-section-kicker">Release directory</p>
      <h2 className="mt-1 text-2xl font-semibold tracking-tight">Albums & EPs</h2>
      <p className="mt-1 text-sm text-text-secondary">Open a release directly instead of browsing another row of cover cards.</p>

      <div className="mt-4 grid gap-2.5 md:grid-cols-2">
        {releases.map((release) => (
          <Link
            key={release.id}
            href={`/album/${release.id}`}
            data-flow-detail-trigger="release"
            data-flow-detail-id={release.id}
            data-flow-detail-title={release.title}
            data-flow-detail-artist={release.artist}
            data-flow-detail-image={release.cover}
            data-flow-detail-collection={release.releaseType}
            data-flow-detail-href={`/album/${release.id}`}
            className="bvs-surface-quiet bvs-surface-hover group flex min-w-0 items-center gap-3 rounded-2xl p-3 transition"
          >
            <div className="relative h-14 w-14 flex-none overflow-hidden rounded-xl border border-white/10 bg-black/40 shadow-[0_8px_24px_rgba(0,0,0,.25)]">
              <Image
                src={release.cover}
                alt={`${release.title} cover`}
                fill
                unoptimized={/^https?:\/\//i.test(release.cover)}
                sizes="56px"
                className="object-cover object-center"
              />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-sm font-semibold tracking-tight group-hover:text-brand">{release.title}</h3>
              <p className="truncate text-xs text-text-secondary">{release.artist}</p>
              <p className="mt-0.5 truncate text-[11px] text-white/45">{release.releaseType} · {release.tracks.length} tracks</p>
            </div>
            <span className="flex-none text-sm text-white/40 transition group-hover:translate-x-0.5 group-hover:text-brand" aria-hidden="true">→</span>
          </Link>
        ))}
      </div>
    </section>
  )
}
