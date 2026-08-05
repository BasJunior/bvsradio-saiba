'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient, isSupabaseConfigured } from '@/lib/supabase'

type Slot = { signedUrl: string; path: string; contentType?: string }
type PackBeat = { id: string; title: string; mood: string; bpm: string; price: string; preview: File | null; master: File | null }

const field = 'w-full rounded-xl border border-white/10 bg-black/20 p-3 outline-none focus:border-brand'
const newBeat = (): PackBeat => ({ id: crypto.randomUUID(), title: '', mood: '', bpm: '', price: '29', preview: null, master: null })

async function putSigned(slot: Slot, file: File) {
  const res = await fetch(slot.signedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': slot.contentType || file.type || 'application/octet-stream' },
    body: file,
  })
  if (!res.ok) throw new Error(`Upload failed for ${file.name}.`)
  return slot.path
}

async function uploadFiles(token: string, files: { preview?: File | null; master?: File | null; artwork?: File | null }) {
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
    if (file && prep.slots?.[kind]) paths[kind] = await putSigned(prep.slots[kind], file)
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
  const [beats, setBeats] = useState<PackBeat[]>([newBeat(), newBeat()])
  const [rights, setRights] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState(supabaseReady ? '' : 'Account service is not configured.')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!supabaseReady) return
    createClient().auth.getSession().then(({ data }) => {
      setToken(data.session?.access_token || '')
      setAuthReady(true)
    })
  }, [supabaseReady])

  const updateBeat = (id: string, patch: Partial<PackBeat>) => {
    setBeats(current => current.map(beat => beat.id === id ? { ...beat, ...patch } : beat))
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setMessage('')
    if (!token) return setError('Sign in with an artist/producer account before uploading a pack.')
    if (!title.trim()) return setError('Enter a pack title.')
    if (!rights) return setError('Confirm that you control the rights to every beat in the pack.')
    if (beats.length < 2) return setError('A pack needs at least two beats.')
    if (beats.some(beat => !beat.title.trim() || !beat.preview || Number(beat.price) < 1)) {
      return setError('Every beat needs a title, tagged preview and Standard lease price of at least $1.')
    }

    setBusy(true)
    try {
      let artworkPath: string | null = null
      if (artwork) {
        setProgress('Uploading pack artwork…')
        artworkPath = (await uploadFiles(token, { artwork })).artwork
      }
      const items = []
      for (let index = 0; index < beats.length; index += 1) {
        const beat = beats[index]
        setProgress(`Uploading beat ${index + 1} of ${beats.length}: ${beat.title}…`)
        const paths = await uploadFiles(token, { preview: beat.preview, master: beat.master })
        items.push({
          title: beat.title.trim(), mood: beat.mood.trim(), bpm: beat.bpm || null,
          priceUsd: Number(beat.price), previewPath: paths.preview, masterPath: paths.master,
        })
      }
      setProgress('Submitting the ordered pack for editorial review…')
      const response = await fetch('/api/beat-packs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: title.trim(), description: description.trim(), genre, artworkPath, items, rightsConfirmed: true }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Could not submit beat pack.')
      setMessage(`${payload.count} beats submitted together as “${title.trim()}” for editorial review.`)
      setTitle('')
      setDescription('')
      setArtwork(null)
      setBeats([newBeat(), newBeat()])
      setRights(false)
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

  return <form onSubmit={submit} noValidate className="grid gap-4 rounded-2xl border border-white/10 p-6">
    <div>
      <p className="text-xs uppercase tracking-[0.22em] text-brand">Producer</p>
      <h2 className="mt-1 text-2xl">Upload a beat pack</h2>
      <p className="mt-2 text-sm text-text-secondary">Upload 2–20 ordered beats under one pack identity. Every beat receives its own preview, master and lease price.</p>
    </div>
    {error && <p className="rounded-xl bg-red-500/10 p-4 text-sm text-red-200">{error}</p>}
    {message && <p className="rounded-xl bg-brand/10 p-4 text-sm text-brand">{message}</p>}
    <input value={title} onChange={event => setTitle(event.target.value)} placeholder="Pack title *" className={field} />
    <textarea value={description} onChange={event => setDescription(event.target.value)} placeholder="Pack description" className={`${field} min-h-20`} />
    <div className="grid gap-3 sm:grid-cols-2">
      <input value={genre} onChange={event => setGenre(event.target.value)} placeholder="Genre" className={field} />
      <label className="text-sm text-text-secondary">Shared pack cover art
        <input type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" onChange={event => setArtwork(event.target.files?.[0] || null)} className={`${field} mt-1`} />
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
          <label className="text-sm text-text-secondary">Tagged preview *
            <input type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg,.aac,.flac" onChange={event => updateBeat(beat.id, { preview: event.target.files?.[0] || null })} className={`${field} mt-1`} />
          </label>
          <label className="text-sm text-text-secondary">WAV / master (private)
            <input type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg,.aac,.flac" onChange={event => updateBeat(beat.id, { master: event.target.files?.[0] || null })} className={`${field} mt-1`} />
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
    <button type="submit" disabled={busy} className="rounded-full bg-brand px-5 py-3 font-semibold text-black disabled:opacity-40">{busy ? 'Uploading pack…' : 'Submit beat pack for review'}</button>
  </form>
}
