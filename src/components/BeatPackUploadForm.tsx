'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient, isSupabaseConfigured } from '@/lib/supabase'
import { isAllowedAudioFile } from '@/lib/audio-formats'

type Slot = { signedUrl: string; path: string; contentType?: string }
type PackBeat = {
  id: string
  title: string
  mood: string
  bpm: string
  musicalKey: string
  price: string
  preview: File | null
  master: File | null
  previewPath: string | null
  masterPath: string | null
}
type DraftPack = {
  id: string
  title: string
  description: string
  genre: string
  artworkPath: string | null
  createdAt: string | null
  updatedAt: string | null
  rightsConfirmed: boolean
  items: Array<{
    id: string
    title: string
    mood: string
    bpm: number | null
    musicalKey: string
    priceUsd: number
    previewPath: string | null
    masterPath: string | null
    rightsConfirmed: boolean
  }>
}

const field = 'w-full rounded-xl border border-white/10 bg-black/20 p-3 outline-none focus:border-brand'
const newBeat = (): PackBeat => ({
  id: crypto.randomUUID(),
  title: '',
  mood: '',
  bpm: '',
  musicalKey: '',
  price: '29',
  preview: null,
  master: null,
  previewPath: null,
  masterPath: null,
})

function validateArtwork(file: File) {
  if (!/\.(jpe?g|png|webp)$/i.test(file.name)) return 'Cover art must be JPG, PNG, or WebP.'
  if (!file.size) return 'The selected cover art is empty.'
  if (file.size > 8 * 1024 * 1024) return 'Cover art must be 8MB or smaller.'
  return ''
}

async function putSigned(slot: Slot, file: File, onProgress: (percent: number) => void) {
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', slot.signedUrl)
    xhr.setRequestHeader('Content-Type', slot.contentType || file.type || 'application/octet-stream')
    xhr.upload.onprogress = event => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100))
    }
    xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed for ${file.name}.`))
    xhr.onerror = () => reject(new Error(`Upload failed for ${file.name}. Check your connection and retry.`))
    xhr.send(file)
  })
  return slot.path
}

async function putArtworkViaServer(token: string, slot: Slot, file: File) {
  const body = new FormData()
  body.set('path', slot.path)
  body.set('file', file)
  const res = await fetch('/api/beats/upload/artwork', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body,
  })
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(payload.error || `Upload failed for ${file.name}.`)
  return String(payload.path || slot.path)
}

async function uploadFiles(token: string, files: { preview?: File | null; master?: File | null; artwork?: File | null }, onProgress: (label: string) => void) {
  const prepRes = await fetch('/api/beats/upload/prepare', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(Object.fromEntries(Object.entries(files).filter(([, file]) => file).map(([kind, file]) => [kind, {
      name: file?.name,
      type: file?.type,
      size: file?.size,
    }]))),
  })
  const prep = await prepRes.json().catch(() => ({}))
  if (!prepRes.ok) throw new Error(prep.error || 'Could not prepare pack uploads.')
  const paths: Record<string, string | null> = { preview: null, master: null, artwork: null }
  for (const kind of ['preview', 'master', 'artwork'] as const) {
    const file = files[kind]
    if (file && prep.slots?.[kind]) {
      try {
        paths[kind] = await putSigned(prep.slots[kind], file, percent => onProgress(`${file.name}: ${percent}%`))
      } catch (error) {
        if (kind !== 'artwork') throw error
        onProgress(`Finishing ${file.name} through BVS...`)
        paths[kind] = await putArtworkViaServer(token, prep.slots[kind], file)
      }
    }
  }
  return paths
}

export default function BeatPackUploadForm() {
  const supabaseReady = isSupabaseConfigured()
  const [token, setToken] = useState('')
  const [authReady, setAuthReady] = useState(!supabaseReady)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [genre, setGenre] = useState('Hip-Hop')
  const [artwork, setArtwork] = useState<File | null>(null)
  const [existingArtworkPath, setExistingArtworkPath] = useState<string | null>(null)
  const [beats, setBeats] = useState<PackBeat[]>([newBeat(), newBeat()])
  const [rights, setRights] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState(supabaseReady ? '' : 'Account service is not configured.')
  const [message, setMessage] = useState('')
  const [drafts, setDrafts] = useState<DraftPack[]>([])
  const [draftsOpen, setDraftsOpen] = useState(false)
  const [draftsLoading, setDraftsLoading] = useState(false)
  const [activeDraftId, setActiveDraftId] = useState('')

  const loadDrafts = useCallback(async (accessToken: string) => {
    setDraftsLoading(true)
    try {
      const res = await fetch('/api/beat-packs', {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.error || 'Could not load beat pack drafts.')
      setDrafts(Array.isArray(payload.drafts) ? payload.drafts : [])
    } finally {
      setDraftsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!supabaseReady) return
    createClient().auth.getSession().then(({ data }) => {
      setToken(data.session?.access_token || '')
      setAuthReady(true)
    })
  }, [supabaseReady])

  useEffect(() => {
    if (!token) return
    loadDrafts(token).catch(err => setError(err instanceof Error ? err.message : 'Could not load beat pack drafts.'))
  }, [loadDrafts, token])

  const updateBeat = (id: string, patch: Partial<PackBeat>) => {
    setBeats(current => current.map(beat => beat.id === id ? { ...beat, ...patch } : beat))
  }

  const resetForm = () => {
    setTitle('')
    setDescription('')
    setGenre('Hip-Hop')
    setArtwork(null)
    setExistingArtworkPath(null)
    setBeats([newBeat(), newBeat()])
    setRights(false)
    setActiveDraftId('')
  }

  const openDraft = (draft: DraftPack) => {
    const restored: PackBeat[] = draft.items.map(item => ({
      id: crypto.randomUUID(),
      title: item.title,
      mood: item.mood || '',
      bpm: item.bpm ? String(item.bpm) : '',
      musicalKey: item.musicalKey || '',
      price: String(item.priceUsd || 29),
      preview: null,
      master: null,
      previewPath: item.previewPath || null,
      masterPath: item.masterPath || null,
    }))
    while (restored.length < 2) restored.push(newBeat())
    setTitle(draft.title)
    setDescription(draft.description || '')
    setGenre(draft.genre || 'Hip-Hop')
    setArtwork(null)
    setExistingArtworkPath(draft.artworkPath || null)
    setBeats(restored)
    setRights(draft.rightsConfirmed)
    setActiveDraftId(draft.id)
    setDraftsOpen(false)
    setError('')
    setMessage(`Editing draft “${draft.title}”. Existing uploads will be kept unless you replace them.`)
  }

  const submit = async (event: FormEvent, submitForReview: boolean) => {
    event.preventDefault()
    setError('')
    setMessage('')
    if (!token) return setError('Sign in with an artist/producer account before uploading a pack.')
    if (!title.trim()) return setError('Enter a pack title.')
    if (submitForReview && !rights) return setError('Confirm that you control the rights to every beat in the pack.')
    if (beats.length < 2) return setError('A pack needs at least two beats.')
    if (beats.some(beat => !beat.title.trim() || Number(beat.price) < 1)) {
      return setError('Every beat needs a title and Standard lease price of at least $1.')
    }
    if (submitForReview && beats.some(beat => !beat.preview && !beat.previewPath)) {
      return setError('Every beat needs a tagged preview before the pack can be submitted.')
    }
    for (const beat of beats) {
      for (const file of [beat.preview, beat.master].filter((value): value is File => Boolean(value))) {
        const check = isAllowedAudioFile(file)
        if (!check.ok) return setError(`${beat.title}: ${check.error}`)
      }
    }
    if (artwork) {
      const artworkError = validateArtwork(artwork)
      if (artworkError) return setError(artworkError)
    }

    setBusy(true)
    try {
      let artworkPath: string | null = existingArtworkPath
      if (artwork) {
        setProgress('Uploading pack artwork…')
        artworkPath = (await uploadFiles(token, { artwork }, setProgress)).artwork
      }
      const items = []
      for (let index = 0; index < beats.length; index += 1) {
        const beat = beats[index]
        setProgress(`Preparing beat ${index + 1} of ${beats.length}: ${beat.title}…`)
        const paths = beat.preview || beat.master
          ? await uploadFiles(token, { preview: beat.preview, master: beat.master }, label => setProgress(`Beat ${index + 1}/${beats.length} · ${label}`))
          : { preview: null, master: null, artwork: null }
        items.push({
          title: beat.title.trim(),
          mood: beat.mood.trim(),
          bpm: beat.bpm || null,
          musicalKey: beat.musicalKey.trim(),
          priceUsd: Number(beat.price),
          previewPath: paths.preview || beat.previewPath,
          masterPath: paths.master || beat.masterPath,
        })
      }
      setProgress(submitForReview ? 'Submitting the ordered pack for editorial review…' : activeDraftId ? 'Updating the pack draft…' : 'Saving the pack draft…')
      const response = await fetch('/api/beat-packs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          genre,
          artworkPath,
          items,
          rightsConfirmed: rights,
          submit: submitForReview,
          replacePackId: activeDraftId || undefined,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Could not submit beat pack.')
      setMessage(
        submitForReview
          ? `${payload.count} beats submitted together as “${title.trim()}” for editorial review.`
          : `Draft “${title.trim()}” saved with ${payload.count} beats.`,
      )
      resetForm()
      await loadDrafts(token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Beat pack upload failed.')
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  if (authReady && !token) {
    return <div className="rounded-2xl border border-white/10 p-6">
      <h2 className="text-2xl">Upload a beat pack</h2>
      <p className="mt-3 text-sm text-text-secondary">Sign in with an artist/producer account to upload two or more ordered beats together.</p>
      <Link href="/auth/login?next=/upload" className="mt-4 inline-block text-brand">Sign in →</Link>
    </div>
  }

  return <form onSubmit={event => void submit(event, true)} noValidate className="grid gap-4 rounded-2xl border border-white/10 p-6">
    <div>
      <p className="text-xs uppercase tracking-[0.22em] text-brand">Producer</p>
      <h2 className="mt-1 text-2xl">Upload a beat pack</h2>
      <p className="mt-2 text-sm text-text-secondary">Upload 2–20 ordered beats under one pack identity. Every beat receives its own preview, master and lease price.</p>
    </div>
    {activeDraftId && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand/30 bg-brand/10 px-4 py-3 text-sm">
      <span className="text-brand">Editing saved draft: {title || 'Untitled pack'}</span>
      <button type="button" disabled={busy} onClick={() => { resetForm(); setMessage('Started a new beat pack.'); }} className="rounded-full border border-brand/40 px-3 py-1.5 text-xs text-brand disabled:opacity-40">Start new pack</button>
    </div>}
    {error && <p className="rounded-xl bg-red-500/10 p-4 text-sm text-red-200">{error}</p>}
    {message && <p className="rounded-xl bg-brand/10 p-4 text-sm text-brand">{message}</p>}
    <input value={title} onChange={event => setTitle(event.target.value)} placeholder="Pack title *" className={field} />
    <textarea value={description} onChange={event => setDescription(event.target.value)} placeholder="Pack description" className={`${field} min-h-20`} />
    <div className="grid gap-3 sm:grid-cols-2">
      <input value={genre} onChange={event => setGenre(event.target.value)} placeholder="Genre" className={field} />
      <label className="text-sm text-text-secondary">Shared pack cover art
        <input type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" onChange={event => setArtwork(event.target.files?.[0] || null)} className={`${field} mt-1`} />
        {existingArtworkPath && !artwork && <span className="mt-1 block text-xs text-brand">Existing cover saved — choose a file only to replace it.</span>}
      </label>
    </div>
    <div className="space-y-4">
      {beats.map((beat, index) => <fieldset key={beat.id} className="rounded-xl border border-white/10 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <legend className="font-semibold">Beat {index + 1}</legend>
          {beats.length > 2 && <button type="button" onClick={() => setBeats(current => current.filter(item => item.id !== beat.id))} className="text-xs text-red-200">Remove</button>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <input value={beat.title} onChange={event => updateBeat(beat.id, { title: event.target.value })} placeholder="Beat title *" className={field} />
          <input value={beat.price} onChange={event => updateBeat(beat.id, { price: event.target.value })} type="number" min={1} step="0.01" placeholder="Lease price USD *" className={field} />
          <input value={beat.mood} onChange={event => updateBeat(beat.id, { mood: event.target.value })} placeholder="Mood tags" className={field} />
          <input value={beat.bpm} onChange={event => updateBeat(beat.id, { bpm: event.target.value })} inputMode="numeric" placeholder="BPM" className={field} />
          <input value={beat.musicalKey} onChange={event => updateBeat(beat.id, { musicalKey: event.target.value })} placeholder="Key (for example C minor)" className={field} />
          <label className="text-sm text-text-secondary">Tagged preview *
            <input type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg,.aac,.flac" onChange={event => updateBeat(beat.id, { preview: event.target.files?.[0] || null })} className={`${field} mt-1`} />
            {beat.previewPath && !beat.preview && <span className="mt-1 block text-xs text-brand">Existing preview saved.</span>}
          </label>
          <label className="text-sm text-text-secondary">WAV / master (private)
            <input type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg,.aac,.flac" onChange={event => updateBeat(beat.id, { master: event.target.files?.[0] || null })} className={`${field} mt-1`} />
            {beat.masterPath && !beat.master && <span className="mt-1 block text-xs text-brand">Existing master saved.</span>}
          </label>
        </div>
      </fieldset>)}
    </div>
    <button type="button" disabled={beats.length >= 20 || busy} onClick={() => setBeats(current => [...current, newBeat()])} className="rounded-full border border-white/20 px-5 py-2 text-sm disabled:opacity-40">+ Add another beat</button>
    <label className="flex items-start gap-3 text-sm text-text-secondary">
      <input type="checkbox" checked={rights} onChange={event => setRights(event.target.checked)} className="mt-1" />
      I own or control the rights to every beat in this pack and can offer Standard leases on BVS.
    </label>
    {progress && <p className="text-sm text-brand">{progress}</p>}
    <div className="flex flex-wrap gap-3">
      <button type="button" disabled={busy} onClick={event => void submit(event as unknown as FormEvent, false)} className="rounded-full border border-white/20 px-5 py-3 disabled:opacity-40">{busy ? 'Working…' : activeDraftId ? 'Update draft' : 'Save draft'}</button>
      <button type="submit" disabled={busy} className="rounded-full bg-brand px-5 py-3 font-semibold text-black disabled:opacity-40">{busy ? 'Uploading pack…' : 'Submit beat pack for review'}</button>
      <button type="button" disabled={busy} onClick={() => setDraftsOpen(open => !open)} className="rounded-full border border-brand/50 px-5 py-3 text-brand disabled:opacity-40">{draftsLoading ? 'Loading drafts…' : `View drafts${drafts.length ? ` (${drafts.length})` : ''}`}</button>
    </div>
    {draftsOpen && <section className="rounded-2xl border border-brand/25 bg-brand/[.05] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-brand">Saved work</p>
          <h3 className="mt-1 text-lg">Beat pack drafts</h3>
        </div>
        <button type="button" onClick={() => setDraftsOpen(false)} className="text-sm text-text-secondary">Close</button>
      </div>
      {draftsLoading ? <p className="mt-4 text-sm text-text-secondary">Loading your drafts…</p> : drafts.length === 0 ? <p className="mt-4 text-sm text-text-secondary">No saved beat pack drafts yet.</p> : <div className="mt-4 grid gap-3">
        {drafts.map(draft => <button key={draft.id} type="button" onClick={() => openDraft(draft)} className="flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 p-4 text-left hover:border-brand/50">
          <span>
            <span className="block font-semibold text-white">{draft.title}</span>
            <span className="mt-1 block text-xs text-text-secondary">{draft.items.length} beats{draft.updatedAt ? ` · Edited ${new Date(draft.updatedAt).toLocaleDateString()}` : ''}</span>
          </span>
          <span className="text-sm font-semibold text-brand">Continue editing →</span>
        </button>)}
      </div>}
    </section>}
  </form>
}
