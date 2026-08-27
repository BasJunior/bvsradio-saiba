'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient, isSupabaseConfigured } from '@/lib/supabase'
import { isAllowedAudioFile } from '@/lib/audio-formats'

type Slot = { signedUrl: string; path: string; contentType?: string }
type PackBeat = { id: string; title: string; mood: string; bpm: string; musicalKey: string; price: string; preview: File | null; master: File | null }

const field = 'w-full rounded-xl border border-white/10 bg-black/20 p-3 outline-none focus:border-brand'
const MAX_PACK_BEATS = 20
const newBeat = (): PackBeat => ({ id: crypto.randomUUID(), title: '', mood: '', bpm: '', musicalKey: '', price: '29', preview: null, master: null })

function titleFromAudioName(name: string) {
  const base = name.replace(/\.[^.]+$/, '')
  return base
    .replace(/[_]+/g, ' ')
    .replace(/\s*-\s*/g, ' - ')
    .replace(/\s+/g, ' ')
    .replace(/^\d{1,2}[\.\-_\s]+/, '')
    .trim()
    .slice(0, 160)
}

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
    if (file && prep.slots?.[kind]) paths[kind] = await putSigned(prep.slots[kind], file, percent => onProgress(`${file.name}: ${percent}%`))
  }
  return paths
}

export default function BeatPackUploadForm({ loginNext = '/upload' }: { loginNext?: string }) {
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

  const importPreviewFiles = (fileList: FileList | null) => {
    if (!fileList?.length) return
    setError('')
    const files = Array.from(fileList)
    const next: PackBeat[] = []
    const rejected: string[] = []
    for (const file of files) {
      if (next.length >= MAX_PACK_BEATS) {
        rejected.push(`${file.name} (pack full at ${MAX_PACK_BEATS})`)
        continue
      }
      const check = isAllowedAudioFile(file)
      if (!check.ok) {
        rejected.push(`${file.name}: ${check.error}`)
        continue
      }
      next.push({
        ...newBeat(),
        title: titleFromAudioName(file.name) || `Beat ${next.length + 1}`,
        preview: file,
      })
    }
    if (next.length < 2 && next.length > 0) {
      // Keep at least two pack slots so the producer can still finish the EP.
      while (next.length < 2) next.push(newBeat())
    }
    if (!next.length) {
      setError(rejected[0] || 'No valid audio files selected.')
      return
    }
    setBeats(next)
    if (!title.trim() && next[0]?.title) {
      const guessed = titleFromAudioName(files[0]?.name || next[0].title)
      if (guessed) setTitle(`${guessed} Pack`.slice(0, 160))
    }
    if (rejected.length) {
      setMessage(`Imported ${next.filter(b => b.preview).length} previews. Skipped: ${rejected.slice(0, 3).join(' · ')}${rejected.length > 3 ? '…' : ''}`)
    } else {
      setMessage(`Imported ${next.filter(b => b.preview).length} previews as an ordered pack. Edit titles/prices, then submit for editorial review.`)
    }
  }

  const submit = async (event: FormEvent, submitForReview: boolean) => {
    event.preventDefault()
    setError('')
    setMessage('')
    if (!token) return setError('Sign in with an artist/producer account before uploading a pack.')
    if (!title.trim()) return setError('Enter a pack title.')
    if (submitForReview && !rights) return setError('Confirm that you control the rights to every beat in the pack.')
    if (beats.length < 2) return setError('A pack needs at least two beats (for example a 10-pack EP).')
    if (beats.length > MAX_PACK_BEATS) return setError(`A pack can include at most ${MAX_PACK_BEATS} beats.`)
    if (beats.some(beat => !beat.title.trim() || Number(beat.price) < 1)) {
      return setError('Every beat needs a title and Standard lease price of at least $1.')
    }
    if (submitForReview && beats.some(beat => !beat.preview)) {
      return setError('Every beat needs a tagged preview before the pack can be submitted. Use “Import previews” to drop a whole pack at once.')
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
      let artworkPath: string | null = null
      if (artwork) {
        setProgress('Uploading pack artwork…')
        artworkPath = (await uploadFiles(token, { artwork }, setProgress)).artwork
      }
      const items = []
      for (let index = 0; index < beats.length; index += 1) {
        const beat = beats[index]
        setProgress(`Uploading beat ${index + 1} of ${beats.length}: ${beat.title}…`)
        const paths = beat.preview || beat.master
          ? await uploadFiles(token, { preview: beat.preview, master: beat.master }, label => setProgress(`Beat ${index + 1}/${beats.length} · ${label}`))
          : { preview: null, master: null, artwork: null }
        items.push({
          title: beat.title.trim(), mood: beat.mood.trim(), bpm: beat.bpm || null, musicalKey: beat.musicalKey.trim(),
          priceUsd: Number(beat.price), previewPath: paths.preview, masterPath: paths.master,
        })
      }
      setProgress(submitForReview ? 'Submitting the ordered pack for editorial review…' : 'Saving the pack draft…')
      const response = await fetch('/api/beat-packs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: title.trim(), description: description.trim(), genre, artworkPath, items, rightsConfirmed: rights, submit: submitForReview }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Could not submit beat pack.')
      setMessage(submitForReview ? `${payload.count} beats submitted together as “${title.trim()}” for editorial review.` : `Draft “${title.trim()}” saved with ${payload.count} beats.`)
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
      <Link href={`/auth/login?next=${encodeURIComponent(loginNext)}`} className="mt-4 inline-block text-brand">Sign in →</Link>
    </div>
  }

  return <form onSubmit={event => void submit(event, true)} noValidate className="grid gap-4 rounded-2xl border border-white/10 p-6">
    <div>
      <p className="text-xs uppercase tracking-[0.22em] text-brand">Producer</p>
      <h2 className="mt-1 text-2xl">Upload a beat pack / EP</h2>
      <p className="mt-2 text-sm text-text-secondary">
        Drop 2–{MAX_PACK_BEATS} tagged previews as one ordered pack (for example a 10-pack). Files go to private BVS storage, then the whole pack waits in editorial until staff approve and publish. Live BeatStore limits apply per public beat, not only the pack shell.
      </p>
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-xs text-text-secondary">
        <li>Import previews (multi-select) or add beats one by one</li>
        <li>Set pack title, shared cover, and each lease price</li>
        <li>Submit pack → editorial reviews the set → publish opens each beat in BeatStore</li>
      </ol>
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
    <label className="rounded-2xl border border-dashed border-brand/40 bg-brand/5 p-4 text-sm text-text-secondary">
      <span className="block font-medium text-text-primary">Import pack previews (multi-select)</span>
      <span className="mt-1 block text-xs">Select many audio files at once — order is kept from your selection. Titles are guessed from filenames; you can edit before submit.</span>
      <input
        type="file"
        multiple
        accept="audio/*,.mp3,.wav,.m4a,.ogg,.aac,.flac"
        disabled={busy}
        onChange={event => {
          importPreviewFiles(event.target.files)
          event.currentTarget.value = ''
        }}
        className={`${field} mt-3`}
      />
    </label>
    <p className="text-xs text-text-secondary">{beats.filter(b => b.preview).length} of {beats.length} slots have previews · max {MAX_PACK_BEATS}</p>
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
          </label>
          <label className="text-sm text-text-secondary">WAV / master (private)
            <input type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg,.aac,.flac" onChange={event => updateBeat(beat.id, { master: event.target.files?.[0] || null })} className={`${field} mt-1`} />
          </label>
        </div>
      </fieldset>)}
    </div>
    <button type="button" disabled={beats.length >= MAX_PACK_BEATS || busy} onClick={() => setBeats(current => current.length >= MAX_PACK_BEATS ? current : [...current, newBeat()])} className="rounded-full border border-white/20 px-5 py-2 text-sm disabled:opacity-40">+ Add another beat</button>
    <label className="flex items-start gap-3 text-sm text-text-secondary">
      <input type="checkbox" checked={rights} onChange={event => setRights(event.target.checked)} className="mt-1" />
      I own or control the rights to every beat in this pack and can offer Standard leases on BVS.
    </label>
    {progress && <p className="text-sm text-brand">{progress}</p>}
    <div className="flex flex-wrap gap-3">
      <button type="button" disabled={busy} onClick={event => void submit(event as unknown as FormEvent, false)} className="rounded-full border border-white/20 px-5 py-3 disabled:opacity-40">{busy ? 'Working…' : 'Save draft'}</button>
      <button type="submit" disabled={busy} className="rounded-full bg-brand px-5 py-3 font-semibold text-black disabled:opacity-40">{busy ? 'Uploading pack…' : 'Submit beat pack for review'}</button>
    </div>
  </form>
}
