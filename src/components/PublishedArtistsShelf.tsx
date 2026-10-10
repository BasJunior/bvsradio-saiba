'use client'

import { useEffect, useState } from 'react'
import CreatorPortraitRail from '@/components/home/CreatorPortraitRail'
import type { PublishedArtistSummary } from '@/lib/artist-content'

export default function PublishedArtistsShelf({ limit = 0 }: { limit?: number }) {
  const [artists, setArtists] = useState<PublishedArtistSummary[]>([])

  useEffect(() => {
    let active = true
    fetch(`/api/artists?limit=${limit}`)
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((payload: { artists?: PublishedArtistSummary[] }) => {
        if (active) setArtists(payload.artists || [])
      })
      .catch(() => undefined)
    return () => { active = false }
  }, [limit])

  if (!artists.length) return null

  return <CreatorPortraitRail title="Artists" tone="charcoal" allHref="/music/artists" kicker="The people behind the sound" items={(limit ? artists.slice(0, limit) : artists).map(artist => ({
    id: artist.id, name: artist.name, image: artist.image, href: `/artist/${artist.username}`,
    detail: `${artist.trackCount} published ${artist.trackCount === 1 ? 'track' : 'tracks'}`,
  }))} />
}
