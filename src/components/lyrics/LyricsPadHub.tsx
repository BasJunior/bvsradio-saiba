'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase'
import { trackEvent } from '@/lib/analytics'

type SongWorkspace = {
  id: string
  songTitle: string
  status: 'draft' | 'ready_to_release' | 'released'
  workspaceKind: 'blank' | 'licensed'
  hasAttachedBeat: boolean
  beatTitle?: string | null
  producerName?: string | null
  updatedAt?: string | null
}

type OwnedBeat = {
  beatId: string
  orderReference: string
  title: string
  producerName: string
  licenceCode: string
  workspaceId?: string | null
}

function updatedLabel(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function LyricsPadHub() {
  const [token, setToken] = useState('')
  const [sessionReady, setSessionReady] = useState(false)
  const [workspaces, setWorkspaces] = useState<SongWorkspace[]>([])
  const [ownedBeats, setOwnedBeats] = useState<OwnedBeat[]>([])
  const [loading, setLoading] = useState(false)
  const [opening, setOpening] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setSessionReady(true)
      return
    }
    const supabase = createClient()
    const sync = (nextToken?: string) => {
      setToken(nextToken || '')
      setSessionReady(true)
    }
    supabase.auth.getSession().then(({ data }) => sync(data.session?.access_token))
    const { data } = supabase.auth.onAuthStateChange((_event, session) => sync(session?.access_token))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!sessionReady || !token) {
      if (sessionReady) {
        setWorkspaces([])
        setOwnedBeats([])
      }
      return
    }
    let cancelled = false
    setLoading(true)
    setError('')
    const headers = { Authorization: `Bearer ${token}` }
    Promise.all([
      fetch('/api/creator/song-workspaces', { headers, cache: 'no-store' }),
      fetch('/api/library/owned', { headers, cache: 'no-store' }),
    ]).then(async ([workspaceResponse, beatsResponse]) => {
      const [workspacePayload, beatsPayload] = await Promise.all([
        workspaceResponse.json().catch(() => ({})),
        beatsResponse.json().catch(() => ({})),
      ])
      if (!workspaceResponse.ok) throw new Error(workspacePayload.error || 'Could not load Lyrics Pad.')
      if (!beatsResponse.ok) throw new Error(beatsPayload.error || 'Could not load licensed beats.')
      if (!cancelled) {
        setWorkspaces(Array.isArray(workspacePayload.workspaces) ? workspacePayload.workspaces : [])
        setOwnedBeats(Array.isArray(beatsPayload.beats) ? beatsPayload.beats : [])
      }
    }).catch((caught) => {
      if (!cancelled) setError(caught instanceof Error ? caught.message : 'Could not load Lyrics Pad.')
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [sessionReady, token])

  const unattachedBeats = useMemo(() => ownedBeats.filter((beat) => !beat.workspaceId), [ownedBeats])

  async function createPad() {
    if (!token || opening) return
    setOpening('new')
    setError('')
    try {
      const response = await fetch('/api/creator/song-workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload.workspace?.id) throw new Error(payload.error || 'Could not create Lyrics Pad.')
      trackEvent('lyrics_pad_open', { workspace: true, source: 'lyrics_hub', kind: 'blank' })
      window.location.href = `/creator/studio/songs/${payload.workspace.id}`
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create Lyrics Pad.')
      setOpening('')
    }
  }

  async function writeToBeat(beat: OwnedBeat) {
    if (!token || opening) return
    if (beat.workspaceId) {
      window.location.href = `/creator/studio/songs/${beat.workspaceId}`
      return
    }
    setOpening(beat.beatId)
    setError('')
    try {
      const response = await fetch('/api/creator/song-workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ orderReference: beat.orderReference, beatId: beat.beatId }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload.workspace?.id) throw new Error(payload.error || 'Could not open Lyrics Pad.')
      trackEvent('lyrics_pad_open', { workspace: true, source: 'lyrics_hub', kind: 'licensed' })
      window.location.href = `/creator/studio/songs/${payload.workspace.id}`
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not open Lyrics Pad.')
      setOpening('')
    }
  }

  if (!sessionReady) return <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6"><div className="h-64 animate-pulse rounded-[2rem] bg-white/[.035]" /></div>

  if (!token) return <main className="mx-auto max-w-4xl px-4 pb-16 pt-10 text-center sm:px-6 sm:pt-16">
    <p className="text-xs font-semibold uppercase tracking-[.22em] text-brand">Lyrics Pad</p>
    <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">A private place to shape the song.</h1>
    <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-text-secondary sm:text-base">Sign in to start a free Lyrics Pad, return to your writing, or write against a beat already licensed to your BVS account.</p>
    <div className="mt-7 flex flex-wrap justify-center gap-2">
      <Link href="/auth/login?next=%2Flyrics" className="min-h-11 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black hover:bg-brand">Sign in</Link>
      <Link href="/auth/signup?next=%2Flyrics" className="min-h-11 rounded-full border border-white/15 px-6 py-3 text-sm font-semibold">Join BVS</Link>
    </div>
  </main>

  return <main className="mx-auto max-w-6xl px-4 pb-20 pt-8 sm:px-6 sm:pt-12">
    <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[.025] p-6 sm:p-8">
      <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-brand/[.1] blur-3xl" />
      <div className="relative flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.22em] text-brand">Private writing · Your BVS</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-6xl">Lyrics Pad</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-text-secondary sm:text-base">Start from a blank page for free, or write with a beat already licensed to your account. Your lyrics and private notes autosave to BVS.</p>
        </div>
        <button type="button" onClick={() => void createPad()} disabled={Boolean(opening)} className="min-h-11 rounded-full bg-brand px-5 py-3 text-sm font-semibold text-black disabled:opacity-50">{opening === 'new' ? 'Creating…' : '+ New Lyrics Pad'}</button>
      </div>
    </section>

    {error ? <p className="mt-5 rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-100" role="alert">{error}</p> : null}
    {loading ? <p className="mt-6 text-sm text-text-secondary">Loading your writing…</p> : null}

    {!loading && workspaces.length ? <section className="mt-9" aria-labelledby="your-writing-heading">
      <div className="flex items-end justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-brand">Your writing</p><h2 id="your-writing-heading" className="mt-2 text-2xl font-semibold sm:text-3xl">Pick up where you left off.</h2></div><span className="text-xs text-text-secondary">{workspaces.length} pad{workspaces.length === 1 ? '' : 's'}</span></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {workspaces.map((workspace) => <Link key={workspace.id} href={`/creator/studio/songs/${workspace.id}`} onClick={() => trackEvent('lyrics_pad_open', { workspace: true, source: 'lyrics_hub', kind: workspace.workspaceKind })} className="group rounded-[1.5rem] border border-white/10 bg-white/[.02] p-5 transition hover:-translate-y-0.5 hover:border-brand/30 hover:bg-white/[.04]">
          <div className="flex items-start justify-between gap-3"><span className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[.12em] text-text-secondary">{workspace.hasAttachedBeat ? 'Licensed beat' : 'Blank pad'}</span><span className="text-xs text-text-secondary">{updatedLabel(workspace.updatedAt)}</span></div>
          <h3 className="mt-4 truncate text-xl font-semibold">{workspace.songTitle || 'Untitled song'}</h3>
          <p className="mt-2 truncate text-sm text-text-secondary">{workspace.hasAttachedBeat ? `${workspace.beatTitle || 'Beat'} · ${workspace.producerName || 'BVS producer'}` : 'Private Lyrics Pad · no beat attached'}</p>
          <p className="mt-5 text-sm font-semibold text-brand">Open pad →</p>
        </Link>)}
      </div>
    </section> : null}

    {!loading && !workspaces.length ? <section className="mt-9 rounded-[1.6rem] border border-dashed border-white/15 p-8 text-center sm:p-10">
      <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-brand">Start anywhere</p>
      <h2 className="mt-3 text-2xl font-semibold">Your first Lyrics Pad can be completely blank.</h2>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-text-secondary">No beat purchase is required. Create a private pad and let the song come first.</p>
      <button type="button" onClick={() => void createPad()} disabled={Boolean(opening)} className="mt-5 min-h-11 rounded-full bg-white px-5 text-sm font-semibold text-black hover:bg-brand disabled:opacity-50">{opening === 'new' ? 'Creating…' : 'Start writing'}</button>
    </section> : null}

    {unattachedBeats.length ? <section className="mt-10" aria-labelledby="licensed-beats-heading">
      <div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-brand">Write with a beat</p><h2 id="licensed-beats-heading" className="mt-2 text-2xl font-semibold sm:text-3xl">Licensed beats ready for a song.</h2><p className="mt-2 text-sm text-text-secondary">These purchases already belong to your account. Opening one attaches its writing context to Lyrics Pad.</p></div>
      <div className="mt-5 space-y-3">{unattachedBeats.map((beat) => <article key={`${beat.orderReference}-${beat.beatId}`} className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/10 bg-white/[.02] p-4"><div className="min-w-0 flex-1"><h3 className="truncate font-semibold">{beat.title}</h3><p className="truncate text-sm text-text-secondary">{beat.producerName} · {beat.licenceCode.replaceAll('_', ' ')}</p></div><button type="button" onClick={() => void writeToBeat(beat)} disabled={Boolean(opening)} className="min-h-11 rounded-full border border-brand/30 px-4 text-sm font-semibold text-brand disabled:opacity-50">{opening === beat.beatId ? 'Opening…' : 'Write lyrics'}</button></article>)}</div>
    </section> : null}

    <div className="mt-10 flex flex-wrap gap-3 border-t border-white/10 pt-6 text-sm">
      <Link href="/library" className="text-brand hover:underline">← Back to Library</Link>
      <Link href="/catalogue?type=beat#beatstore" className="text-text-secondary hover:text-brand">Explore BeatStore →</Link>
      <Link href="/creator/studio" className="text-text-secondary hover:text-brand">Creator Studio →</Link>
    </div>
  </main>
}
