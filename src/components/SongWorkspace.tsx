'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase'

type Workspace = {
  id: string
  songTitle: string
  lyrics: string
  notes: string
  status: string
  releaseId?: string | null
  orderReference: string
  beatId: string
  beatTitle: string
  producerName: string
  licenceCode: string
  licenceSummary: string
  licenceTermsVersion?: string | null
  bpm?: number | null
  musicalKey?: string | null
  genre?: string | null
  audioUrl?: string | null
}

const sections = ['Intro', 'Verse', 'Pre-Chorus', 'Chorus', 'Bridge', 'Outro']

export default function SongWorkspace({ id }: { id: string }) {
  const [token, setToken] = useState('')
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [songTitle, setSongTitle] = useState('')
  const [lyrics, setLyrics] = useState('')
  const [notes, setNotes] = useState('')
  const [dirty, setDirty] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isSupabaseConfigured()) return setError('Account service is unavailable.')
    createClient().auth.getSession().then(async ({ data }) => {
      const accessToken = data.session?.access_token
      if (!accessToken) return setError('Sign in to open your Song Workspace.')
      setToken(accessToken)
      const response = await fetch(`/api/creator/song-workspaces/${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store',
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) return setError(payload.error || 'Could not open Song Workspace.')
      const next = payload.workspace as Workspace
      setWorkspace(next)
      setSongTitle(next.songTitle || '')
      setLyrics(next.lyrics || '')
      setNotes(next.notes || '')
      setSaveState('saved')
    }).catch(() => setError('Could not open Song Workspace.'))
  }, [id])

  const save = useCallback(async (status?: 'draft' | 'ready_to_release') => {
    if (!token || !workspace) return false
    setSaveState('saving')
    const response = await fetch(`/api/creator/song-workspaces/${encodeURIComponent(workspace.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ songTitle, lyrics, notes, ...(status ? { status } : {}) }),
    })
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      setError(payload.error || 'Could not save your writing.')
      setSaveState('error')
      return false
    }
    setDirty(false)
    setSaveState('saved')
    return true
  }, [lyrics, notes, songTitle, token, workspace])

  useEffect(() => {
    if (!dirty || !workspace || !token) return
    const timer = window.setTimeout(() => void save(), 900)
    return () => window.clearTimeout(timer)
  }, [dirty, save, token, workspace])

  const markDirty = () => { setDirty(true); setSaveState('idle') }
  const appendSection = (label: string) => {
    setLyrics(`${lyrics}${lyrics.trim() ? '\n\n' : ''}[${label}]\n`)
    markDirty()
  }

  async function prepareRelease() {
    if (await save('ready_to_release')) {
      window.location.href = `/creator/studio/create/release?songWorkspace=${encodeURIComponent(id)}`
    }
  }

  if (error && !workspace) return (
    <main className="mx-auto min-h-[65vh] max-w-xl px-6 py-20 text-center">
      <p className="text-xs font-semibold uppercase tracking-[.22em] text-brand">Song Workspace</p>
      <h1 className="mt-3 text-3xl font-semibold">Workspace unavailable</h1>
      <p className="mt-4 text-text-secondary">{error}</p>
      <Link href="/creator/studio" className="mt-6 inline-flex rounded-full border border-white/15 px-5 py-2.5 text-sm">Back to Studio</Link>
    </main>
  )
  if (!workspace) return <main className="min-h-[65vh] p-20 text-center text-text-secondary">Opening your song…</main>

  return (
    <main className="mx-auto max-w-6xl px-5 pb-24 pt-8 sm:px-6 sm:pt-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/creator/studio" className="text-sm text-brand">← Studio</Link>
        <div className="flex items-center gap-3 text-xs text-text-secondary">
          <span>{saveState === 'saving' ? 'Saving…' : saveState === 'error' ? 'Save needs attention' : dirty ? 'Unsaved changes' : 'Saved to BVS'}</span>
          <span className="rounded-full border border-white/10 px-3 py-1">Private</span>
        </div>
      </div>

      <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[.22em] text-brand">Song Workspace · Lyrics Pad</p>
          <input value={songTitle} onChange={(e) => { setSongTitle(e.target.value); markDirty() }} placeholder="Name your song" className="mt-3 w-full border-0 bg-transparent p-0 text-3xl font-semibold outline-none placeholder:text-white/25 sm:text-4xl" />
          <p className="mt-3 text-sm text-text-secondary">Writing to <strong className="text-text-primary">{workspace.beatTitle}</strong> by {workspace.producerName}</p>

          {workspace.audioUrl ? (
            <div className="mt-6 rounded-3xl border border-brand/20 bg-brand/[.05] p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><p className="text-sm font-semibold">Your licensed beat</p><p className="mt-1 text-xs text-text-secondary">{[workspace.genre, workspace.bpm ? `${workspace.bpm} BPM` : null, workspace.musicalKey].filter(Boolean).join(' · ') || workspace.beatTitle}</p></div>
                <span className="rounded-full border border-brand/30 px-3 py-1 text-xs text-brand">{workspace.licenceCode.replaceAll('_', ' ')}</span>
              </div>
              <audio controls preload="metadata" src={workspace.audioUrl} className="mt-4 w-full" />
            </div>
          ) : null}

          <section className="mt-6 rounded-3xl border border-white/10 bg-white/[.02] p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="text-xs font-semibold uppercase tracking-[.18em] text-text-secondary">Lyrics</p><h2 className="mt-1 text-xl font-semibold">Write while the beat plays</h2></div>
              <div className="flex flex-wrap gap-1.5">{sections.map((s) => <button key={s} type="button" onClick={() => appendSection(s)} className="rounded-full border border-white/10 px-3 py-1.5 text-xs hover:border-brand/40 hover:text-brand">+ {s}</button>)}</div>
            </div>
            <textarea value={lyrics} onChange={(e) => { setLyrics(e.target.value); markDirty() }} placeholder={'[Verse]\nStart writing here…'} spellCheck className="mt-5 min-h-[52vh] w-full resize-y rounded-2xl border border-white/10 bg-black/20 p-5 text-base leading-8 outline-none focus:border-brand sm:text-lg" />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-text-secondary"><span>{lyrics.trim() ? lyrics.trim().split(/\s+/).length : 0} words</span><button type="button" onClick={() => void save()} className="text-brand hover:underline">Save now</button></div>
          </section>

          <details className="mt-5 rounded-3xl border border-white/10 bg-white/[.015] p-5">
            <summary className="cursor-pointer font-semibold">Song notes <span className="font-normal text-text-secondary">(private)</span></summary>
            <textarea value={notes} onChange={(e) => { setNotes(e.target.value); markDirty() }} placeholder="Melody ideas, recording notes, ad-libs, reference tracks…" className="mt-4 min-h-36 w-full rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 outline-none focus:border-brand" />
          </details>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <section className="rounded-3xl border border-white/10 bg-white/[.02] p-5">
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-brand">Licence attached</p>
            <h2 className="mt-2 font-semibold">{workspace.beatTitle}</h2><p className="mt-1 text-sm text-text-secondary">{workspace.producerName}</p>
            <p className="mt-4 text-sm leading-6 text-text-secondary">{workspace.licenceSummary}</p>
            {workspace.licenceTermsVersion ? <p className="mt-3 text-xs text-text-secondary">Terms {workspace.licenceTermsVersion}</p> : null}
            <Link href={`/account/orders/${encodeURIComponent(workspace.orderReference)}`} className="mt-4 inline-flex text-sm text-brand">View purchase & licence →</Link>
          </section>
          <section className="rounded-3xl border border-brand/25 bg-brand/[.055] p-5">
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-brand">When the song is ready</p><h2 className="mt-2 text-xl font-semibold">Turn this into a release</h2>
            <p className="mt-2 text-sm leading-6 text-text-secondary">BVS carries this purchased beat licence into Rights Passport as leased-beat clearance.</p>
            {workspace.releaseId ? <Link href="/creator/studio/manage#releases" className="mt-5 inline-flex rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-black">View release</Link> : <button type="button" onClick={() => void prepareRelease()} className="mt-5 w-full rounded-full bg-brand px-5 py-3 text-sm font-semibold text-black">Prepare release →</button>}
          </section>
        </aside>
      </section>
      {error ? <p className="mt-5 rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-100">{error}</p> : null}
    </main>
  )
}
