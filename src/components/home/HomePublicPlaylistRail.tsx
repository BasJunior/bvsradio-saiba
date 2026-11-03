'use client'

import { useEffect, useMemo, useState } from 'react'
import CreatorPortraitRail from './CreatorPortraitRail'

type PublicPlaylist = { id: string; title: string; creator: string; coverUrl?: string | null; trackCount: number }

const OFFICIAL_GENRES = new Set([
  'afrobeats', 'amapiano', 'dancehall', 'electronic', 'gospel', 'hip-hop', 'jazz', 'lofi', 'other', 'pop', 'r&b', 'trap', 'zimdancehall',
])

function normalizeTitle(value: string) {
  return value.trim().toLowerCase()
}

function playlistPriority(playlist: PublicPlaylist) {
  const title = normalizeTitle(playlist.title)
  if (title.startsWith('bvs favorite')) return 0
  if (!OFFICIAL_GENRES.has(title)) return 1
  if (title === 'jazz') return 3
  if (title === 'gospel') return 4
  return 2
}

export default function HomePublicPlaylistRail() {
  const [playlists, setPlaylists] = useState<PublicPlaylist[]>([])
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/playlists/public?limit=24', { signal: controller.signal, cache: 'no-store' })
      .then(response => response.ok ? response.json() : Promise.reject())
      .then((payload: { playlists?: PublicPlaylist[] }) => { if (!controller.signal.aborted) setPlaylists(payload.playlists || []) })
      .catch(() => undefined)
    return () => controller.abort()
  }, [])

  const orderedPlaylists = useMemo(() => playlists
    .map((playlist, index) => ({ playlist, index }))
    .sort((a, b) => playlistPriority(a.playlist) - playlistPriority(b.playlist) || a.index - b.index)
    .map(({ playlist }) => playlist), [playlists])

  return <CreatorPortraitRail data-home-accent="feed" title="Playlists" kicker="Made by BVS listeners and creators" tone="charcoal" allHref="/search?mode=playlists" items={orderedPlaylists.map(playlist => ({
    id: playlist.id, name: playlist.title, image: playlist.coverUrl || '/branding/bvs-share-logo.png', href: `/playlist/${playlist.id}`, detail: `${playlist.creator} · ${playlist.trackCount} ${playlist.trackCount === 1 ? 'track' : 'tracks'}`,
  }))} />
}
