'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { PublicRelease } from '@/lib/public-releases'
import DiscoveryShelf from '@/components/discovery/DiscoveryShelf'
import ArtworkPlayTile from '@/components/discovery/ArtworkPlayTile'

export default function PublishedAlbumsShelf() {
  const [releases, setReleases] = useState<PublicRelease[]>([])

  useEffect(() => {
    fetch('/api/releases/public', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((payload: { releases?: PublicRelease[] }) => setReleases(payload.releases || []))
      .catch(() => undefined)
  }, [])

  if (!releases.length) return null

  const playRelease = (release: PublicRelease) => {
    const tracks = release.tracks
      .filter((track) => track.src)
      .map((track) => ({
        id: track.id,
        title: track.title,
        artist: release.artist,
        src: track.src,
        artwork: release.cover,
        project: release.title,
        genre: release.genre,
      }))
    if (!tracks.length) return
    window.dispatchEvent(
      new CustomEvent('bvs:queue', {
        detail: { action: 'play-all', tracks, from: release.title },
      }),
    )
  }

  return (
    <DiscoveryShelf
      eyebrow="Published releases"
      title="Albums & EPs"
      description="Open a release for the tracklist, credits and format details."
      action={
        <Link href="/catalogue" className="text-sm font-medium text-brand hover:underline">
          Browse catalogue →
        </Link>
      }
    >
      {releases.map((release) => (
        <ArtworkPlayTile
          key={release.id}
          layout="shelf"
          title={release.title}
          subtitle={release.artist}
          image={release.cover}
          meta={`${release.tracks.length} tracks${release.genre ? ` · ${release.genre}` : ''}`}
          canPlay={release.tracks.some((track) => track.src)}
          onPlay={() => playRelease(release)}
          onOpen={() => {
            window.location.assign(`/album/${release.id}`)
          }}
        />
      ))}
    </DiscoveryShelf>
  )
}
