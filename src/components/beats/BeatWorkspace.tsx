'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import LibraryAction from '@/components/LibraryAction'
import { createClient, isSupabaseConfigured } from '@/lib/supabase'
import { trackEvent } from '@/lib/analytics'

type Licence = {
  id: string
  code: string
  name: string
  price: number
  currency: string
  includedFiles: string[]
  summary?: string | null
  termsVersion?: string | null
}

type Beat = {
  id: string
  title: string
  description?: string | null
  genre?: string | null
  mood?: string | null
  bpm?: number | null
  musicalKey?: string | null
  producer: string
  artworkUrl?: string | null
  previewUrl?: string | null
  startingPrice?: number | null
  licences: Licence[]
}

type Entitlement = {
  owned: true
  orderReference: string
  licenceCode: string
  licenceSummary: string
  workspaceId?: string | null
  songTitle?: string | null
  fullAudioUrl?: string | null
}

type Workspace = {
  id: string
  songTitle: string
  lyrics: string
  notes: string
  status: 'draft' | 'ready_to_release' | 'released'
  orderReference: string
  beatId: string
  beatTitle: string
  producerName: string
  licenceCode: string
  licenceSummary: string
  audioUrl?: string | null
}

const lyricSections = ['Verse', 'Pre-Chorus', 'Chorus', 'Bridge', 'Outro']

function money(value: number, currency: string) {
  if (!Number.isFinite(value)) return ''
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: String(currency || 'USD').toUpperCase(), maximumFractionDigits: 0 }).format(value)
  } catch {
    return `$${value}`
  }
}

export default function BeatWorkspace({ beatId }: { beatId: string }) {
  const [token, setToken] = useState('')
  const [sessionReady, setSessionReady] = useState(false)
  const [beat, setBeat] = useState<Beat | null>(null)
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null)
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [songTitle, setSongTitle] = useState('')
  const [lyrics, setLyrics] = useState('')
  const [notes, setNotes] = useState('')
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(true)
  const [opening, setOpening] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
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
    if (!sessionReady) return
    let cancelled = false
    setLoading(true)
    setError('')
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined
    fetch(`/api/beat-workspace/${encodeURIComponent(beatId)}`, { headers, cache: 'no-store' })
      .then(async response => {
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload.error || 'Could not open this beat.')
        if (cancelled) return
        const nextBeat = payload.beat as Beat
        const nextEntitlement = (payload.entitlement || null) as Entitlement | null
        setBeat(nextBeat)
        setEntitlement(nextEntitlement)
        trackEvent('engagement_action_open', { activity: 'beat_workspace', beat_id: beatId, licensed: Boolean(nextEntitlement) })
        if (nextEntitlement?.workspaceId && token) {
          const workspaceResponse = await fetch(`/api/creator/song-workspaces/${encodeURIComponent(nextEntitlement.workspaceId)}`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store',
          })
          const workspacePayload = await workspaceResponse.json().catch(() => ({}))
          if (workspaceResponse.ok && workspacePayload.workspace && !cancelled) {
            const nextWorkspace = workspacePayload.workspace as Workspace
            setWorkspace(nextWorkspace)
            setSongTitle(nextWorkspace.songTitle || '')
            setLyrics(nextWorkspace.lyrics || '')
            setNotes(nextWorkspace.notes || '')
            setSaveState('saved')
          }
        }
      })
      .catch(caught => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Could not open this beat.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [beatId, sessionReady, token])

  const audioUrl = entitlement?.fullAudioUrl || workspace?.audioUrl || beat?.previewUrl || ''
  const fullPlayback = Boolean(entitlement && (entitlement.fullAudioUrl || workspace?.audioUrl))
  const metadata = useMemo(() => [beat?.genre, beat?.mood, beat?.bpm ? `${beat.bpm} BPM` : null, beat?.musicalKey].filter(Boolean) as string[], [beat])

  const save = useCallback(async () => {
    if (!workspace || !token) return false
    setSaveState('saving')
    setError('')
    const response = await fetch(`/api/creator/song-workspaces/${encodeURIComponent(workspace.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ songTitle, lyrics, notes }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      setError(payload.error || 'Could not save your writing.')
      setSaveState('error')
      return false
    }
    setWorkspace(current => current ? { ...current, ...(payload.workspace || {}), audioUrl: current.audioUrl } : current)
    setDirty(false)
    setSaveState('saved')
    return true
  }, [lyrics, notes, songTitle, token, workspace])

  useEffect(() => {
    if (!dirty || !workspace || !token) return
    const timer = window.setTimeout(() => void save(), 700)
    return () => window.clearTimeout(timer)
  }, [dirty, save, token, workspace])

  const markDirty = () => {
    setDirty(true)
    setSaveState('idle')
  }

  const appendSection = (section: string) => {
    setLyrics(current => `${current}${current.trim() ? '\n\n' : ''}[${section}]\n`)
    markDirty()
  }

  async function startWriting() {
    if (!entitlement || !token || opening) return
    setOpening(true)
    setError('')
    try {
      const response = await fetch('/api/creator/song-workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ orderReference: entitlement.orderReference, beatId }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload.workspace?.id) throw new Error(payload.error || 'Could not start writing.')
      const next = payload.workspace as Workspace
      setWorkspace(next)
      setEntitlement(current => current ? { ...current, workspaceId: next.id, fullAudioUrl: current.fullAudioUrl || next.audioUrl } : current)
      setSongTitle(next.songTitle || '')
      setLyrics(next.lyrics || '')
      setNotes(next.notes || '')
      setSaveState('saved')
      trackEvent('lyrics_pad_open', { workspace: true, source: 'beat_workspace', kind: 'licensed', beat_id: beatId })
      window.requestAnimationFrame(() => document.getElementById('beat-writing')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not start writing.')
    } finally {
      setOpening(false)
    }
  }

  if (loading) return <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6"><div className="h-[32rem] animate-pulse rounded-[2rem] bg-white/[.03]" /></main>

  if (error && !beat) return <main className="mx-auto min-h-[60vh] max-w-xl px-6 py-20 text-center"><p className="text-xs font-semibold uppercase tracking-[.2em] text-brand">BeatStore</p><h1 className="mt-3 text-3xl font-semibold">Beat unavailable</h1><p className="mt-4 text-text-secondary">{error}</p><Link href="/library?section=saved-beats" className="mt-6 inline-flex rounded-full border border-white/15 px-5 py-2.5 text-sm">Back to Library</Link></main>
  if (!beat) return null

  const saveLabel = saveState === 'saving' ? 'Saving…' : saveState === 'error' ? 'Save needs attention' : dirty ? 'Unsaved changes' : 'Saved privately'
  const nextUrl = encodeURIComponent(`/beat/${beat.id}`)

  return <main className="mx-auto max-w-7xl px-4 pb-24 pt-7 sm:px-6 sm:pt-10">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Link href="/library?section=saved-beats" className="text-sm font-semibold text-brand">← Library</Link>
      <LibraryAction item={{ id: `beat-${beat.id}`, kind: 'beat', title: beat.title, subtitle: beat.producer, href: `/beat/${beat.id}`, image: beat.artworkUrl || undefined, tags: metadata }} section="favourites" compact />
    </div>

    <section className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,430px)_minmax(0,1fr)] lg:items-start">
      <div className="lg:sticky lg:top-24">
        <div className="overflow-hidden rounded-[1.8rem] border border-white/10 bg-white/[.025]">
          <div className="relative aspect-square bg-white/[.03]">
            {beat.artworkUrl ? <Image src={beat.artworkUrl} alt={`${beat.title} artwork`} fill unoptimized className="object-cover" priority /> : <div className="grid h-full place-items-center text-6xl text-brand/50">♪</div>}
            <span className={`absolute left-4 top-4 rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[.13em] backdrop-blur ${entitlement ? 'border-brand/35 bg-black/65 text-brand' : 'border-white/15 bg-black/65 text-white/70'}`}>{entitlement ? 'Licensed · yours' : 'BeatStore preview'}</span>
          </div>
          <div className="p-5 sm:p-6">
            <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-brand">{entitlement ? 'Your beat workspace' : 'Beat details'}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{beat.title}</h1>
            <p className="mt-1 text-base text-text-secondary">{beat.producer}</p>
            {metadata.length ? <div className="mt-4 flex flex-wrap gap-2">{metadata.map(item => <span key={item} className="rounded-full border border-white/10 px-3 py-1 text-xs text-text-secondary">{item}</span>)}</div> : null}
            {beat.description ? <p className="mt-4 text-sm leading-6 text-text-secondary">{beat.description}</p> : null}

            <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center justify-between gap-3"><div><p className="font-semibold">{fullPlayback ? 'Full beat' : 'Preview'}</p><p className="mt-1 text-xs text-text-secondary">{fullPlayback ? 'Unlocked by your BVS licence.' : 'Hear the beat before deciding what comes next.'}</p></div>{entitlement ? <span className="text-xs font-semibold text-brand">{entitlement.licenceCode.replaceAll('_', ' ')}</span> : null}</div>
              {audioUrl ? <audio key={audioUrl} controls preload="metadata" src={audioUrl} className="mt-4 w-full" /> : <p className="mt-4 text-sm text-text-secondary">Audio is not available for this beat yet.</p>}
            </div>

            {entitlement ? <div className="mt-4 rounded-2xl border border-brand/20 bg-brand/[.045] p-4"><p className="text-xs font-semibold uppercase tracking-[.15em] text-brand">Licence attached</p><p className="mt-2 text-sm leading-6 text-text-secondary">{entitlement.licenceSummary}</p><Link href={`/account/orders/${encodeURIComponent(entitlement.orderReference)}`} className="mt-3 inline-flex text-sm font-semibold text-brand">View licence →</Link></div> : null}
          </div>
        </div>
      </div>

      <div className="min-w-0 space-y-5">
        {entitlement ? <section id="beat-writing" className="scroll-mt-24 rounded-[1.8rem] border border-brand/20 bg-white/[.025] p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-brand">Write to this beat</p><h2 className="mt-2 text-2xl font-semibold sm:text-3xl">Keep the music and the words together.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">Full playback, lyrics and private notes stay on this beat screen so you can work without bouncing between pages.</p></div>
            {workspace ? <span className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-text-secondary" aria-live="polite">{saveLabel}</span> : null}
          </div>

          {!workspace ? <div className="mt-6 rounded-2xl border border-dashed border-white/15 p-7 text-center"><h3 className="text-xl font-semibold">Start the song here</h3><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-text-secondary">Your licence is already connected. Start writing and BVS will create the private song workspace behind this beat without taking you somewhere else.</p><button type="button" onClick={() => void startWriting()} disabled={!token || opening} className="mt-5 min-h-11 rounded-full bg-brand px-6 text-sm font-semibold text-black disabled:opacity-50">{opening ? 'Opening…' : token ? 'Start writing' : 'Sign in to write'}</button>{!token ? <Link href={`/auth/login?next=${nextUrl}`} className="mt-3 block text-sm text-brand">Sign in to this beat →</Link> : null}</div> : <>
            <input value={songTitle} onChange={event => { setSongTitle(event.target.value); markDirty() }} placeholder="Name your song" className="mt-6 w-full border-0 bg-transparent p-0 text-2xl font-semibold outline-none placeholder:text-white/25 sm:text-3xl" />
            <div className="mt-4 flex flex-wrap gap-1.5">{lyricSections.map(section => <button key={section} type="button" onClick={() => appendSection(section)} className="min-h-9 rounded-full border border-white/10 px-3 text-xs text-text-secondary transition hover:border-brand/40 hover:text-brand">+ {section}</button>)}</div>
            <textarea value={lyrics} onChange={event => { setLyrics(event.target.value); markDirty() }} placeholder={'[Verse]\nStart writing here…'} spellCheck className="mt-4 min-h-[46vh] w-full resize-y rounded-2xl border border-white/10 bg-black/20 p-5 text-base leading-8 outline-none focus:border-brand sm:text-lg" />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-text-secondary"><span>{lyrics.trim() ? lyrics.trim().split(/\s+/).length : 0} words</span><button type="button" onClick={() => void save()} className="min-h-10 px-2 font-semibold text-brand">Save now</button></div>
            <details className="mt-4 rounded-2xl border border-white/10 bg-black/10 p-4"><summary className="min-h-9 cursor-pointer font-semibold">Private song notes</summary><textarea value={notes} onChange={event => { setNotes(event.target.value); markDirty() }} placeholder="Melody ideas, recording notes, ad-libs…" className="mt-3 min-h-32 w-full rounded-xl border border-white/10 bg-black/20 p-4 text-sm leading-6 outline-none focus:border-brand" /></details>
            <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-white/10 pt-4 text-sm"><Link href="/lyrics" className="text-text-secondary hover:text-brand">All writing</Link><Link href="/creator/studio" className="text-text-secondary hover:text-brand">Creator Studio</Link></div>
          </>}
        </section> : <section className="rounded-[1.8rem] border border-white/10 bg-white/[.02] p-5 sm:p-7">
          <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-brand">From idea to song</p>
          <h2 className="mt-2 text-2xl font-semibold sm:text-3xl">Preview first. Write here when it is yours.</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary">Saving a beat keeps the idea close. Licensing it unlocks the full beat and an attached private writing space on this same page.</p>
          {!token ? <p className="mt-4 text-sm text-text-secondary">Already licensed this beat? <Link href={`/auth/login?next=${nextUrl}`} className="font-semibold text-brand">Sign in</Link> and BVS will unlock your purchase here.</p> : null}
          {beat.licences.length ? <div className="mt-6 grid gap-3 sm:grid-cols-2">{beat.licences.map(option => <div key={option.id} className="rounded-2xl border border-white/10 bg-black/10 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{option.name}</h3><p className="mt-1 text-xs text-text-secondary">{option.includedFiles.length ? option.includedFiles.join(' · ') : option.code.replaceAll('_', ' ')}</p></div><span className="text-sm font-semibold text-brand">{money(option.price, option.currency)}</span></div>{option.summary ? <p className="mt-3 line-clamp-3 text-xs leading-5 text-text-secondary">{option.summary}</p> : null}</div>)}</div> : null}
          <Link href={`/catalogue?type=beat&beat=${encodeURIComponent(beat.id)}#beatstore`} className="mt-6 inline-flex min-h-11 items-center rounded-full bg-brand px-5 text-sm font-semibold text-black">Licence this beat</Link>
        </section>}

        {error ? <p className="rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-100" role="alert">{error}</p> : null}
      </div>
    </section>
  </main>
}
