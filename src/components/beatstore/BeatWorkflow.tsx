'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import LibraryAction from '@/components/LibraryAction'
import { createClient, isSupabaseConfigured } from '@/lib/supabase'
import { trackEvent } from '@/lib/analytics'

type Licence = {
  id: string
  licence_code?: string
  licence_name?: string
  price_usd?: number
  terms_summary?: string
}

type Beat = {
  id: string
  slug?: string | null
  title: string
  producerName: string
  description?: string | null
  genre?: string | null
  mood?: string | null
  bpm?: number | null
  musicalKey?: string | null
  artworkUrl?: string | null
  previewUrl?: string | null
  startingPrice?: number | null
  licences: Licence[]
}

type Access = {
  member?: boolean
  owned: boolean
  fullAudioUrl?: string | null
  fullAvailable?: boolean
  orderReference?: string
  workspaceId?: string | null
  licenceCode?: string
  licenceSummary?: string
  licenceTermsVersion?: string | null
}

type Workspace = {
  id: string
  songTitle: string
  lyrics: string
  notes: string
  status: 'draft' | 'ready_to_release' | 'released'
  beatTitle: string
  producerName: string
}

const lyricSections = ['Intro', 'Verse', 'Pre-Chorus', 'Chorus', 'Bridge', 'Outro']

function InlineLyrics({ workspaceId, token }: { workspaceId: string; token: string }) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [songTitle, setSongTitle] = useState('')
  const [lyrics, setLyrics] = useState('')
  const [notes, setNotes] = useState('')
  const [dirty, setDirty] = useState(false)
  const [saveState, setSaveState] = useState<'loading' | 'idle' | 'saving' | 'saved' | 'error'>('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setSaveState('loading')
    fetch(`/api/creator/song-workspaces/${encodeURIComponent(workspaceId)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    }).then(async (response) => {
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Could not open your Lyrics Pad.')
      if (cancelled) return
      const next = payload.workspace as Workspace
      setWorkspace(next)
      setSongTitle(next.songTitle || '')
      setLyrics(next.lyrics || '')
      setNotes(next.notes || '')
      setSaveState('saved')
      trackEvent('lyrics_pad_open', { workspace: true, source: 'beat_detail', kind: 'licensed' })
    }).catch((caught) => {
      if (!cancelled) {
        setError(caught instanceof Error ? caught.message : 'Could not open your Lyrics Pad.')
        setSaveState('error')
      }
    })
    return () => { cancelled = true }
  }, [token, workspaceId])

  const save = useCallback(async () => {
    if (!workspace || !token) return
    setSaveState('saving')
    const response = await fetch(`/api/creator/song-workspaces/${encodeURIComponent(workspace.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ songTitle, lyrics, notes }),
    })
    if (!response.ok) {
      setSaveState('error')
      setError('Your latest changes have not saved yet.')
      return
    }
    setDirty(false)
    setSaveState('saved')
    setError('')
    if (lyrics.trim()) trackEvent('lyrics_return_session', { workspace: true, source: 'beat_detail' })
  }, [lyrics, notes, songTitle, token, workspace])

  useEffect(() => {
    if (!dirty || !workspace) return
    const timer = window.setTimeout(() => void save(), 850)
    return () => window.clearTimeout(timer)
  }, [dirty, save, workspace])

  const edit = () => {
    setDirty(true)
    setSaveState('idle')
  }

  const appendSection = (label: string) => {
    setLyrics((current) => `${current}${current.trim() ? '\n\n' : ''}[${label}]\n`)
    edit()
  }

  if (saveState === 'loading') return <div className="mt-5 h-80 animate-pulse rounded-[1.5rem] bg-white/[.035]" />
  if (!workspace) return <p className="mt-5 rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-100">{error || 'Lyrics Pad is unavailable.'}</p>

  const words = lyrics.trim() ? lyrics.trim().split(/\s+/).length : 0
  const status = saveState === 'saving' ? 'Saving…' : saveState === 'error' ? 'Save needs attention' : dirty ? 'Unsaved changes' : 'Saved privately'

  return <section className="mt-5 rounded-[1.65rem] border border-brand/20 bg-brand/[.035] p-4 sm:p-6" aria-labelledby="inline-lyrics-heading">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-brand">Lyrics Pad · attached to this licence</p>
        <h2 id="inline-lyrics-heading" className="mt-2 text-2xl font-semibold">Write while the beat plays.</h2>
      </div>
      <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-text-secondary" aria-live="polite">{status}</span>
    </div>

    <input value={songTitle} onChange={(event) => { setSongTitle(event.target.value); edit() }} placeholder="Name your song" className="mt-5 w-full border-0 bg-transparent p-0 text-2xl font-semibold outline-none placeholder:text-white/25" />
    <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1">{lyricSections.map((section) => <button key={section} type="button" onClick={() => appendSection(section)} className="min-h-9 shrink-0 rounded-full border border-white/10 px-3 text-xs text-text-secondary hover:border-brand/40 hover:text-brand">+ {section}</button>)}</div>
    <textarea value={lyrics} onChange={(event) => { setLyrics(event.target.value); edit() }} placeholder={'[Verse]\nStart writing here…'} spellCheck className="mt-4 min-h-[42vh] w-full resize-y rounded-2xl border border-white/10 bg-black/25 p-5 text-base leading-8 outline-none focus:border-brand sm:text-lg" />
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-text-secondary"><span>{words} words</span><button type="button" onClick={() => void save()} className="min-h-9 text-brand hover:underline">Save now</button></div>
    <details className="mt-4 rounded-2xl border border-white/10 bg-black/10 p-4">
      <summary className="cursor-pointer font-medium">Private song notes</summary>
      <textarea value={notes} onChange={(event) => { setNotes(event.target.value); edit() }} placeholder="Melody ideas, ad-libs, recording notes…" className="mt-3 min-h-28 w-full rounded-xl border border-white/10 bg-black/20 p-4 text-sm leading-6 outline-none focus:border-brand" />
    </details>
    {error ? <p className="mt-3 text-xs text-red-200">{error}</p> : null}
  </section>
}

export default function BeatWorkflow({ beat }: { beat: Beat }) {
  const [token, setToken] = useState('')
  const [sessionReady, setSessionReady] = useState(false)
  const [access, setAccess] = useState<Access>({ member: false, owned: false })
  const [checkingAccess, setCheckingAccess] = useState(false)
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [lyricsOpen, setLyricsOpen] = useState(false)
  const [openingLyrics, setOpeningLyrics] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setSessionReady(true)
      return
    }
    const supabase = createClient()
    const sync = (next?: string) => {
      setToken(next || '')
      setSessionReady(true)
    }
    supabase.auth.getSession().then(({ data }) => sync(data.session?.access_token))
    const { data } = supabase.auth.onAuthStateChange((_event, session) => sync(session?.access_token))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!sessionReady || !token) {
      if (sessionReady) {
        setAccess({ member: false, owned: false })
        setWorkspaceId(null)
      }
      return
    }
    let cancelled = false
    setCheckingAccess(true)
    fetch(`/api/beats/${encodeURIComponent(beat.id)}/access`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    }).then(async (response) => {
      const payload = await response.json().catch(() => ({ member: false, owned: false })) as Access
      if (!cancelled && response.ok) {
        setAccess(payload)
        setWorkspaceId(payload.workspaceId || null)
      }
    }).finally(() => { if (!cancelled) setCheckingAccess(false) })
    return () => { cancelled = true }
  }, [beat.id, sessionReady, token])

  const hasMemberFullAudio = Boolean(access.member && access.fullAudioUrl)
  const audioUrl = hasMemberFullAudio ? access.fullAudioUrl : beat.previewUrl
  const audioLabel = access.owned
    ? access.fullAvailable ? 'Full beat · licensed to you' : 'Licensed access · full master unavailable'
    : hasMemberFullAudio
      ? 'Full beat · BVS member'
      : access.member
        ? 'BVS member · preview only right now'
        : 'Preview'

  const meta = useMemo(() => [beat.genre, beat.mood, beat.bpm ? `${beat.bpm} BPM` : null, beat.musicalKey].filter(Boolean).join(' · '), [beat])
  const licenceHref = `/catalogue?type=beat&beat=${encodeURIComponent(beat.slug || beat.id)}#beatstore`

  async function openLyrics() {
    if (!token) {
      window.location.href = `/auth/login?next=${encodeURIComponent(`/beat/${beat.id}`)}`
      return
    }
    if (!access.owned || !access.orderReference) return
    if (workspaceId) {
      setLyricsOpen(true)
      requestAnimationFrame(() => document.getElementById('beat-writing')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
      return
    }
    setOpeningLyrics(true)
    setError('')
    try {
      const response = await fetch('/api/creator/song-workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ orderReference: access.orderReference, beatId: beat.id }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload.workspace?.id) throw new Error(payload.error || 'Could not open Lyrics Pad.')
      setWorkspaceId(payload.workspace.id)
      setLyricsOpen(true)
      trackEvent('lyrics_pad_open', { workspace: true, source: 'beat_detail', kind: 'licensed' })
      requestAnimationFrame(() => document.getElementById('beat-writing')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not open Lyrics Pad.')
    } finally {
      setOpeningLyrics(false)
    }
  }

  return <main className="mx-auto max-w-6xl px-4 pb-24 pt-7 sm:px-6 sm:pt-10">
    <div className="flex items-center justify-between gap-4">
      <Link href="/library?section=saved-beats" className="text-sm text-text-secondary hover:text-brand">← Library</Link>
      <LibraryAction item={{ id: `beat-${beat.id}`, kind: 'beat', title: beat.title, subtitle: beat.producerName, href: `/beat/${beat.id}`, image: beat.artworkUrl || undefined, tags: [beat.genre || '', beat.mood || ''].filter(Boolean) }} section="favourites" compact />
    </div>

    <section className="mt-5 grid gap-6 lg:grid-cols-[minmax(260px,360px)_minmax(0,1fr)] lg:gap-9">
      <div className="relative aspect-square overflow-hidden rounded-[1.8rem] border border-white/10 bg-white/[.035]">{beat.artworkUrl ? <Image src={beat.artworkUrl} alt="" fill unoptimized priority className="object-cover" /> : <div className="absolute inset-0 grid place-items-center text-sm font-semibold tracking-[.18em] text-brand">BVS BEAT</div>}</div>
      <div className="min-w-0 self-center">
        <div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[.16em] text-brand">BeatStore</span>{access.owned ? <span className="rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[.14em] text-brand">Licensed to you</span> : access.member ? <span className="rounded-full border border-white/10 bg-white/[.03] px-3 py-1 text-[10px] font-semibold uppercase tracking-[.14em] text-text-secondary">Member listening</span> : null}</div>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-6xl">{beat.title}</h1>
        <p className="mt-3 text-lg text-text-secondary">{beat.producerName}</p>
        {meta ? <p className="mt-3 text-sm text-text-secondary">{meta}</p> : null}
        {beat.description ? <p className="mt-5 max-w-2xl text-sm leading-7 text-text-secondary">{beat.description}</p> : null}

        <div className="mt-6 rounded-[1.5rem] border border-brand/20 bg-brand/[.045] p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-brand">{audioLabel}</p><p className="mt-1 text-sm text-text-secondary">{access.owned ? 'Stay here, play it and write against it.' : hasMemberFullAudio ? 'Your BVS membership unlocks the full listen. A licence is still required before you use or release the beat.' : 'Hear the public preview, or sign in to BVS for member listening.'}</p></div>{checkingAccess ? <span className="text-xs text-text-secondary">Checking member access…</span> : null}</div>
          {audioUrl ? <audio key={audioUrl} controls preload="metadata" src={audioUrl} className="mt-4 w-full" /> : <p className="mt-4 text-sm text-text-secondary">Audio is temporarily unavailable.</p>}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {access.owned ? <button type="button" onClick={() => void openLyrics()} disabled={openingLyrics} className="min-h-11 rounded-full bg-brand px-5 py-3 text-sm font-semibold text-black disabled:opacity-50">{openingLyrics ? 'Opening writing…' : workspaceId ? 'Write lyrics here' : 'Start writing to this beat'}</button> : <Link href={licenceHref} className="min-h-11 rounded-full bg-brand px-5 py-3 text-sm font-semibold text-black">View licence options</Link>}
          {!access.member && sessionReady ? <Link href={`/auth/login?next=${encodeURIComponent(`/beat/${beat.id}`)}`} className="min-h-11 rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-text-secondary hover:text-white">Sign in for full beat</Link> : null}
          {access.owned && access.orderReference ? <Link href={`/account/orders/${encodeURIComponent(access.orderReference)}`} className="min-h-11 rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-text-secondary hover:text-white">Purchase & licence</Link> : null}
        </div>
        {error ? <p className="mt-4 rounded-xl border border-red-400/25 bg-red-500/10 p-3 text-sm text-red-100">{error}</p> : null}
      </div>
    </section>

    {!access.owned ? <section className="mt-10 border-t border-white/10 pt-8">
      <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-brand">Licence options</p>
      <h2 className="mt-2 text-2xl font-semibold">Choose how you want to use it.</h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{beat.licences.map((licence) => <div key={licence.id} className="rounded-2xl border border-white/10 bg-white/[.02] p-4"><h3 className="font-semibold">{licence.licence_name || licence.licence_code?.replaceAll('_', ' ') || 'Beat licence'}</h3><p className="mt-2 text-2xl font-semibold text-brand">${Number(licence.price_usd || 0).toFixed(2)}</p>{licence.terms_summary ? <p className="mt-2 text-xs leading-5 text-text-secondary">{licence.terms_summary}</p> : null}</div>)}</div>
      {!beat.licences.length ? <p className="mt-4 text-sm text-text-secondary">Licence options are temporarily unavailable.</p> : null}
    </section> : null}

    {access.owned ? <section id="beat-writing" className="scroll-mt-24 mt-10 border-t border-white/10 pt-8">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-brand">Create with it</p><h2 className="mt-2 text-3xl font-semibold">Your song, without leaving the beat.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">Your licence stays attached to this writing context. The beat can keep playing above while your lyrics autosave below.</p></div>{!lyricsOpen ? <button type="button" onClick={() => void openLyrics()} disabled={openingLyrics} className="min-h-11 rounded-full border border-brand/30 px-5 text-sm font-semibold text-brand disabled:opacity-50">{openingLyrics ? 'Opening…' : workspaceId ? 'Open writing' : 'Start writing'}</button> : null}</div>
      {lyricsOpen && workspaceId && token ? <InlineLyrics workspaceId={workspaceId} token={token} /> : <div className="mt-5 rounded-[1.5rem] border border-dashed border-white/15 p-7 text-sm text-text-secondary">Your Lyrics Pad opens here — not on another page.</div>}
    </section> : null}
  </main>
}
