'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient, isSupabaseConfigured } from '@/lib/supabase'
import { useStationPlayer } from '@/components/StationPlayer'
import { trackEvent } from '@/lib/analytics'
import { canonicalBvsShareUrl } from '@/lib/share-url'
import type { StationTrack } from '@/lib/station'

type Playlist = {
  id: string
  title: string
  description?: string | null
  is_public?: boolean
  owner?: boolean
}

type PlaylistTrackRow = {
  id: string
  title: string
  artist_name?: string
  genre?: string
  artwork_url?: string
  file_url?: string
  position?: number
}

function stationTrack(row: PlaylistTrackRow): StationTrack | null {
  if (!row.file_url) return null
  return {
    id: row.id,
    title: row.title,
    artist: row.artist_name || 'BVS artist',
    src: row.file_url,
    artwork: row.artwork_url,
    genre: row.genre,
    project: 'BVS Playlist',
  }
}

export default function PlaylistDetailView({ id }: { id: string }) {
  const player = useStationPlayer()
  const [token, setToken] = useState('')
  const [playlist, setPlaylist] = useState<Playlist | null>(null)
  const [tracks, setTracks] = useState<PlaylistTrackRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')

  const load = useCallback(async (accessToken = '') => {
    setLoading(true)
    const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined
    const [playlistResponse, tracksResponse] = await Promise.all([
      fetch(`/api/playlists/${id}`, { headers, cache: 'no-store' }).catch(() => null),
      fetch(`/api/playlists/${id}/tracks`, { headers, cache: 'no-store' }).catch(() => null),
    ])
    if (!playlistResponse?.ok) {
      setPlaylist(null)
      setTracks([])
      setLoading(false)
      return
    }
    const playlistPayload = await playlistResponse.json() as { playlist?: Playlist }
    const tracksPayload = tracksResponse?.ok ? await tracksResponse.json() as { tracks?: PlaylistTrackRow[] } : { tracks: [] }
    setPlaylist(playlistPayload.playlist || null)
    setTracks(tracksPayload.tracks || [])
    setLoading(false)
  }, [id])

  useEffect(() => {
    let active = true
    if (!isSupabaseConfigured()) {
      void load('')
      return
    }
    createClient().auth.getSession().then(({ data }) => {
      if (!active) return
      const accessToken = data.session?.access_token || ''
      setToken(accessToken)
      void load(accessToken)
    })
    return () => { active = false }
  }, [load])

  const playable = useMemo(() => tracks.map(stationTrack).filter((track): track is StationTrack => Boolean(track)), [tracks])

  const playAll = () => {
    if (!playable.length) return
    player.playAll(playable, { from: playlist?.title || 'BVS Playlist' })
    player.openNowPlaying()
    trackEvent('engagement_action_open', { activity: 'playlist_play_all', playlist_id: id })
  }

  const remove = async (trackId: string) => {
    if (!token || !playlist?.owner) return
    setBusy(trackId)
    const response = await fetch(`/api/playlists/${id}/tracks`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ trackId }),
    }).catch(() => null)
    if (response?.ok) await load(token)
    else setMessage('Could not remove that track.')
    setBusy('')
  }

  const reorder = async (index: number, direction: -1 | 1) => {
    if (!token || !playlist?.owner) return
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= tracks.length) return
    const next = [...tracks]
    ;[next[index], next[nextIndex]] = [next[nextIndex], next[index]]
    setTracks(next)
    setBusy('reorder')
    const response = await fetch(`/api/playlists/${id}/tracks`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ trackIds: next.map(track => track.id) }),
    }).catch(() => null)
    if (!response?.ok) {
      setMessage('Could not save playlist order.')
      await load(token)
    }
    setBusy('')
  }

  const togglePublic = async () => {
    if (!token || !playlist?.owner) return
    setBusy('privacy')
    const response = await fetch(`/api/playlists/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ isPublic: !playlist.is_public }),
    }).catch(() => null)
    if (response?.ok) {
      const payload = await response.json() as { playlist?: Playlist }
      setPlaylist(current => current ? { ...current, ...(payload.playlist || {}), owner: true } : current)
    } else setMessage('Could not change playlist visibility.')
    setBusy('')
  }

  const share = async () => {
    const shareUrl = canonicalBvsShareUrl(`/playlist/${id}`)
    try {
      if (navigator.share) await navigator.share({ title: playlist?.title || 'BVS Playlist', url: shareUrl })
      else await navigator.clipboard.writeText(shareUrl)
      setMessage('Playlist link ready to share.')
      trackEvent('engagement_action_open', { activity: 'playlist_share', playlist_id: id })
    } catch {}
  }

  if (loading) return <main className="mx-auto min-h-[60vh] max-w-5xl px-4 py-12 sm:px-6"><p className="text-text-secondary">Loading playlist…</p></main>
  if (!playlist) return <main className="mx-auto min-h-[60vh] max-w-5xl px-4 py-12 sm:px-6"><h1 className="text-3xl font-semibold">Playlist unavailable</h1><p className="mt-3 text-text-secondary">This playlist is private, missing or no longer available.</p><Link href="/library#playlists" className="mt-6 inline-flex rounded-full bg-brand px-5 py-2.5 font-semibold text-black">Back to Library</Link></main>

  return <main className="mx-auto min-h-[60vh] max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
    <div className="flex flex-wrap items-end justify-between gap-5">
      <div className="max-w-3xl"><p className="text-xs font-semibold uppercase tracking-[.2em] text-brand">BVS Playlist</p><h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-6xl">{playlist.title}</h1>{playlist.description ? <p className="mt-3 text-text-secondary">{playlist.description}</p> : null}<p className="mt-3 text-sm text-text-secondary">{tracks.length} track{tracks.length === 1 ? '' : 's'} · {playlist.is_public ? 'Public' : 'Private'}</p></div>
      <div className="flex flex-wrap gap-2">{playable.length ? <button type="button" onClick={playAll} className="min-h-11 rounded-full bg-brand px-5 text-sm font-semibold text-black">▶ Play all</button> : null}{playlist.is_public ? <button type="button" onClick={() => void share()} className="min-h-11 rounded-full border border-white/15 px-5 text-sm font-semibold">Share</button> : null}{playlist.owner ? <button type="button" disabled={busy === 'privacy'} onClick={() => void togglePublic()} className="min-h-11 rounded-full border border-white/15 px-5 text-sm font-semibold text-text-secondary">{playlist.is_public ? 'Make private' : 'Make public'}</button> : null}</div>
    </div>

    {message ? <p className="mt-4 text-sm text-brand">{message}</p> : null}

    <div className="mt-8 space-y-2">{tracks.map((row, index) => { const playableTrack = stationTrack(row); return <article key={row.id} className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/10 bg-white/[.02] p-3"><span className="w-6 shrink-0 text-center text-sm text-text-secondary">{index + 1}</span><button type="button" disabled={!playableTrack} onClick={() => { if (!playableTrack) return; player.playNow(playableTrack, { from: playlist.title, related: playable.filter(track => track.id !== playableTrack.id) }); player.openNowPlaying() }} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/5 text-brand disabled:opacity-30">▶</button><div className="min-w-0 flex-1"><h2 className="truncate font-semibold">{row.title}</h2><p className="truncate text-sm text-text-secondary">{row.artist_name || 'BVS artist'}{row.genre ? ` · ${row.genre}` : ''}</p></div>{playlist.owner ? <div className="flex shrink-0 items-center gap-1"><button type="button" aria-label="Move track up" disabled={index === 0 || busy === 'reorder'} onClick={() => void reorder(index, -1)} className="grid h-9 w-9 place-items-center rounded-full border border-white/10 text-text-secondary disabled:opacity-25">↑</button><button type="button" aria-label="Move track down" disabled={index === tracks.length - 1 || busy === 'reorder'} onClick={() => void reorder(index, 1)} className="grid h-9 w-9 place-items-center rounded-full border border-white/10 text-text-secondary disabled:opacity-25">↓</button><button type="button" disabled={busy === row.id} onClick={() => void remove(row.id)} className="rounded-full px-3 py-2 text-xs text-text-secondary hover:text-red-300">Remove</button></div> : null}</article> })}</div>

    {!tracks.length ? <div className="mt-8 rounded-2xl border border-dashed border-white/15 p-8 text-center"><h2 className="text-xl font-semibold">This playlist is ready for its first track.</h2><p className="mt-2 text-text-secondary">Open Discover, save a track and use Add to playlist.</p><Link href="/search" className="mt-5 inline-flex rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-black">Discover music</Link></div> : null}
  </main>
}
