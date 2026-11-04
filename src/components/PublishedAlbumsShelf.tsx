'use client'

import { useEffect, useState } from 'react'
import type { PublicRelease } from '@/lib/public-releases'
import CreatorPortraitRail from '@/components/home/CreatorPortraitRail'
import type { MobileSurface } from '@/lib/station-library'

export default function PublishedAlbumsShelf({ surface }: { surface?: MobileSurface } = {}) {
  const [releases, setReleases] = useState<PublicRelease[]>([])
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/releases/public?limit=6', { signal: controller.signal })
      .then(response => response.ok ? response.json() : Promise.reject())
      .then((payload: { releases?: PublicRelease[] }) => { if (!controller.signal.aborted) setReleases(payload.releases || []) })
      .catch(() => undefined)
    return () => controller.abort()
  }, [])
  return <CreatorPortraitRail autoScroll retainBrowseLink title="Releases" kicker="Albums, EPs and new arrivals" tone="charcoal" allHref={surface ? `/app/${surface}/explore?mode=fresh` : "/search?mode=fresh"} items={releases.map(release => ({
    id: release.id, name: release.title, image: release.cover, href: surface ? `/app/${surface}/album/${encodeURIComponent(release.id)}` : `/album/${release.id}`, detail: `${release.artist} · ${release.releaseType} · ${release.tracks.length} tracks`,
  }))} />
}
