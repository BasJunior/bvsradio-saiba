'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient, isSupabaseConfigured } from '@/lib/supabase'
import { trackEvent } from '@/lib/analytics'

type Playlist = { id: string; title: string; trackCount?: number }

export default function PlaylistQuickAdd({ trackId, compact = false }: { trackId: string; compact?: boolean }) {
  const canonicalTrackId = trackId.replace(/^track-/, '')
  const [token, setToken] = useState('')
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!isSupabaseConfigured()) return
    let active = true
    createClient().auth.getSession().then(async ({ data }) => {
      if (!active) return
      const accessToken = data.session?.access_token || ''
      setToken(accessToken)
      if (!accessToken) return
      const response = await fetch('/api/playlists', { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' }).catch(() => null)
      if (!active || !response?.ok) return
      const payload = await response.json() as { playlists?: Playlist[] }
      setPlaylists(payload.playlists || [])
    })
    return () => { active = false }
  }, [])

  const add = async (playlist: Playlist) => {
    if (!token) return
    setBusy(playlist.id)
    setMessage('')
    const response = await fetch(`/api/playlists/${playlist.id}/tracks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ trackId: canonicalTrackId }),
    }).catch(() => null)
    if (response?.ok) {
      setMessage(`Added to ${playlist.title}`)
      trackEvent('playlist_track_added', { playlist_id: playlist.id, track_id: canonicalTrackId })
      window.dispatchEvent(new CustomEvent('bvs:playlists-change'))
      setOpen(false)
    } else {
      const payload = await response?.json().catch(() => ({})) as { error?: string } | undefined
      setMessage(payload?.error || 'Could not add track.')
    }
    setBusy('')
  }

  if (!token) return null

  return <div className="relative">
    <button type="button" onClick={() => { setOpen(value => !value); setMessage('') }} className={compact ? 'rounded-full border border-white/20 px-3 py-1 text-xs text-text-secondary hover:border-brand hover:text-white' : 'rounded-full border border-white/20 px-5 py-3 text-sm font-semibold hover:border-brand hover:text-brand'}>+ Playlist</button>
    {open ? <div className="absolute bottom-[calc(100%+8px)] right-0 z-30 w-64 rounded-2xl border border-white/15 bg-bg-primary p-3 shadow-2xl">
      <p className="px-1 text-xs font-semibold uppercase tracking-[.16em] text-brand">Add to playlist</p>
      <div className="mt-2 max-h-52 space-y-1 overflow-y-auto">
        {playlists.map(playlist => <button key={playlist.id} type="button" disabled={busy === playlist.id} onClick={() => void add(playlist)} className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm hover:bg-white/5 disabled:opacity-50"><span className="truncate">{playlist.title}</span><span className="text-xs text-text-secondary">{playlist.trackCount || 0}</span></button>)}
      </div>
      {!playlists.length ? <div className="mt-2 rounded-xl border border-dashed border-white/10 p-3 text-sm text-text-secondary">No playlists yet. <Link href="/library#playlists" className="text-brand">Create one →</Link></div> : null}
    </div> : null}
    {message ? <p className="mt-2 text-xs text-brand">{message}</p> : null}
  </div>
}
