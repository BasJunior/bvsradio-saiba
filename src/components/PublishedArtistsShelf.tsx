'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { PublishedArtistSummary } from '@/lib/artist-content'
import DiscoveryShelf from '@/components/discovery/DiscoveryShelf'
import ArtistPortraitTile from '@/components/discovery/ArtistPortraitTile'

export default function PublishedArtistsShelf({ limit = 12 }: { limit?: number }) {
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
    <DiscoveryShelf
      eyebrow="Artist directory"
      title="Artists on BVS"
      description="Tune into verified profiles and the music they have published."
      action={
        <Link href="/music/artists" className="text-sm font-medium text-brand hover:underline">
          All artists →
        </Link>
      }
    >
      {artists.slice(0, limit).map((artist) => (
        <ArtistPortraitTile
          key={artist.id}
          href={`/artist/${artist.username}`}
          name={artist.name}
          image={artist.image}
          detail={`${artist.trackCount} published ${artist.trackCount === 1 ? 'track' : 'tracks'}`}
          tags={artist.genres}
        />
      ))}
    </DiscoveryShelf>
  )
}
