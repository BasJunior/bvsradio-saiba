'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient, isSupabaseConfigured } from '@/lib/supabase'
import { trackEvent } from '@/lib/analytics'

type Playlist = {
  id: string
  title: string
  description?: string | null
  is_public?: boolean
  trackCount?: number
}

export default function WebPlaylists() {
  const [token, setToken] = useState('')
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async (accessToken: string) => {
    if (!accessToken) {
      setPlaylists([])
      setLoaded(true)
      return
    }
    const response = await fetch('/api/playlists', { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' }).catch(() => null)
    if (!response?.ok) {
      setLoaded(true)
      return
    }
    const payload = await response.json() as { playlists?: Playlist[] }
    setPlaylists(payload.playlists || [])
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured()) return setLoaded(true)
    let active = true
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      const nextToken = data.session?.access_token || ''
      setToken(nextToken)
      void load(nextToken)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return
      const nextToken = session?.access_token || ''
      setToken(nextToken)
      void load(nextToken)
    })
    const refresh = () => token && void load(token)
    window.addEventListener('bvs:playlists-change', refresh)
    return () => {
      active = false
      listener.subscription.unsubscribe()
      window.removeEventListener('bvs:playlists-change', refresh)
    }
  }, [load, token])

  const create = async () => {
    if (!token || !title.trim()) return
    setBusy(true)
    setError('')
    const response = await fetch('/api/playlists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title: title.trim(), description: description.trim(), isPublic }),
    }).catch(() => null)
    if (!response?.ok) {
      const payload = await response?.json().catch(() => ({})) as { error?: string } | undefined
      setError(payload?.error || 'Could not create playlist.')
      setBusy(false)
      return
    }
    setTitle('')
    setDescription('')
    setIsPublic(false)
    setShowCreate(false)
    trackEvent('playlist_created', {})
    await load(token)
    window.dispatchEvent(new CustomEvent('bvs:playlists-change'))
    setBusy(false)
  }

  return (
    <section id="playlists" className="mx-auto max-w-5xl px-4 pb-14 sm:px-6">
      <div className="rounded-[1.7rem] border border-white/10 bg-white/[.025] p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-brand">Playlists</p>
            <h2 className="mt-2 text-3xl font-semibold">Put the music together your way.</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">Build listening sessions from BVS tracks. Playlists start private; make one public only when you want to share it.</p>
          </div>
          {token ? <button type="button" onClick={() => setShowCreate(value => !value)} className="min-h-10 rounded-full border border-brand/30 px-4 text-sm font-semibold text-brand hover:bg-brand/10">{showCreate ? 'Cancel' : '+ New playlist'}</button> : null}
        </div>

        {!loaded ? <p className="mt-5 text-sm text-text-secondary">Loading playlists…</p> : null}
        {loaded && !token ? <div className="mt-5 rounded-2xl border border-dashed border-white/15 p-5"><p className="text-sm text-text-secondary">Sign in to create playlists that stay with your BVS account.</p><Link href="/auth/login?next=%2Flibrary%23playlists" className="mt-3 inline-flex rounded-full bg-brand px-4 py-2 text-sm font-semibold text-black">Sign in</Link></div> : null}

        {showCreate && token ? <div className="mt-5 grid gap-3 rounded-2xl border border-white/10 bg-black/10 p-4">
          <input value={title} onChange={event => setTitle(event.target.value)} maxLength={100} placeholder="Playlist name" className="min-h-11 rounded-xl border border-white/10 bg-black/20 px-4 outline-none focus:border-brand/40" />
          <textarea value={description} onChange={event => setDescription(event.target.value)} maxLength={500} rows={2} placeholder="Optional description" className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-brand/40" />
          <label className="flex items-center justify-between gap-4 rounded-xl border border-white/10 p-3"><span><span className="block text-sm font-semibold">Public playlist</span><span className="text-xs text-text-secondary">Anyone with the BVS link can open it.</span></span><input type="checkbox" checked={isPublic} onChange={event => setIsPublic(event.target.checked)} className="h-5 w-5 accent-brand" /></label>
          <div><button type="button" disabled={busy || !title.trim()} onClick={() => void create()} className="min-h-11 rounded-full bg-brand px-5 text-sm font-semibold text-black disabled:opacity-40">{busy ? 'Creating…' : 'Create playlist'}</button></div>
        </div> : null}

        {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}

        {token && playlists.length ? <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {playlists.map(playlist => <Link key={playlist.id} href={`/playlist/${playlist.id}`} className="rounded-2xl border border-white/10 bg-black/10 p-4 transition hover:border-brand/30 hover:bg-white/[.03]"><div className="flex items-center justify-between gap-3"><h3 className="truncate font-semibold">{playlist.title}</h3><span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-text-secondary">{playlist.is_public ? 'Public' : 'Private'}</span></div>{playlist.description ? <p className="mt-2 line-clamp-2 text-sm text-text-secondary">{playlist.description}</p> : null}<div className="mt-3 flex items-center justify-between text-sm"><span className="text-text-secondary">{playlist.trackCount || 0} track{playlist.trackCount === 1 ? '' : 's'}</span><span className="font-semibold text-brand">Open →</span></div></Link>)}
        </div> : null}

        {token && loaded && !playlists.length && !showCreate ? <p className="mt-5 rounded-2xl border border-dashed border-white/15 p-5 text-sm text-text-secondary">Create your first playlist, then add tracks while you discover music on BVS.</p> : null}
      </div>
    </section>
  )
}
