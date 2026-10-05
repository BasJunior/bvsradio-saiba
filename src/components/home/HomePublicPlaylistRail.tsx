'use client'

import { useEffect, useState } from 'react'
import CreatorPortraitRail from './CreatorPortraitRail'

type PublicPlaylist = { id: string; title: string; creator: string; coverUrl?: string | null; trackCount: number }

export default function HomePublicPlaylistRail() {
  const [playlists, setPlaylists] = useState<PublicPlaylist[]>([])
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/playlists/public?limit=6', { signal: controller.signal })
      .then(response => response.ok ? response.json() : Promise.reject())
      .then((payload: { playlists?: PublicPlaylist[] }) => { if (!controller.signal.aborted) setPlaylists(payload.playlists || []) })
      .catch(() => undefined)
    return () => controller.abort()
  }, [])
  return <CreatorPortraitRail data-home-accent="feed" title="Playlists" kicker="Made by BVS listeners and creators" tone="charcoal" allHref="/search?mode=playlists" items={playlists.map(playlist => ({
    id: playlist.id, name: playlist.title, image: playlist.coverUrl || '/branding/bvs-share-logo.png', href: `/playlist/${playlist.id}`, detail: `${playlist.creator} · ${playlist.trackCount} ${playlist.trackCount === 1 ? 'track' : 'tracks'}`,
  }))} />
}
