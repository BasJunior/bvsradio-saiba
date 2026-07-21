'use client'

import { useState } from 'react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase'
import { isAllowedAudioFile } from '@/lib/audio-formats'
import { trackEvent } from '@/lib/analytics'

type Slot = { path: string; token: string; signedUrl: string; contentType: string; index?: number }

async function putToSignedSlot(slot: Slot, file: File) {
  const supabase = createClient()
  const { error } = await supabase.storage.from('bvsradio-audio').uploadToSignedUrl(slot.path, slot.token, file, {
    contentType: slot.contentType || file.type || 'application/octet-stream',
    upsert: true,
  })
  if (error) {
    const url = new URL(slot.signedUrl)
    if (!url.searchParams.get('token')) url.searchParams.set('token', slot.token)
    const body = new FormData()
    body.append('cacheControl', '3600')
    body.append('', file)
    const res = await fetch(url.toString(), { method: 'PUT', headers: { 'x-upsert': 'true' }, body })
    if (!res.ok) throw new Error(error.message || `Upload failed (${res.status})`)
  }
}

const genres = [
  'Hip-Hop', 'Trap', 'Afrobeats', 'Amapiano', 'R&B', 'Dancehall', 'Electronic', 'Lofi',
  'Gospel', 'Jazz', 'Pop', 'Sungura', 'Zimdancehall', 'Chimurenga', 'Other',
]

export default function ReleaseSubmitForm({ onSuccess }: { onSuccess?: () => void }) {
  const [title, setTitle] = useState('')
  const [genre, setGenre] = useState('')
  const [description, setDescription] = useState('')
  const [releaseType, setReleaseType] = useState('album')
  const [files, setFiles] = useState<File[]>([])
  const [trackTitles, setTrackTitles] = useState<string[]>([])
  const [cover, setCover] = useState<File | null>(null)
  const [rights, setRights] = useState(false)
  const [explicit, setExplicit] = useState(false)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState<string | null>(null)

  const onFiles = (list: FileList | null) => {
    setError(null)
    if (!list?.length) {
      setFiles([])
      setTrackTitles([])
      return
    }
    const next: File[] = []
    for (const file of Array.from(list)) {
      const check = isAllowedAudioFile(file)
      if (!check.ok) {
        setError(check.error || 'Unsupported file')
        return
      }
      next.push(file)
    }
    if (next.length > 30) {
      setError('Maximum 30 tracks per release.')
      return
    }
    setFiles(next)
    setTrackTitles(next.map((f) => f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ')))
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!title.trim() || !genre || !files.length || !rights) {
      setError('Title, genre, at least one track, and rights confirmation are required.')
      return
    }
    if (!isSupabaseConfigured()) {
      setError('Account service not configured.')
      return
    }
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: userData } = await supabase.auth.getUser()
      const { data: { session } } = await supabase.auth.getSession()
      if (!userData.user || !session?.access_token) throw new Error('Sign in before submitting a release.')

      const headers = {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      }

      setProgress('Preparing secure upload slots…')
      const prepRes = await fetch('/api/releases/prepare', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          tracks: files.map((f) => ({ name: f.name, type: f.type, size: f.size })),
          cover: cover ? { name: cover.name, type: cover.type, size: cover.size } : null,
        }),
      })
      const prep = await prepRes.json()
      if (!prepRes.ok) throw new Error(prep.error || 'Prepare failed')

      for (let i = 0; i < files.length; i++) {
        setProgress(`Uploading track ${i + 1} of ${files.length}…`)
        const slot = prep.tracks[i] as Slot
        await putToSignedSlot(slot, files[i])
      }
      if (cover && prep.cover) {
        setProgress('Uploading cover…')
        await putToSignedSlot(prep.cover as Slot, cover)
      }

      setProgress('Registering release for review…')
      const finRes = await fetch('/api/releases', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title: title.trim(),
          genre,
          description: description.trim(),
          releaseType,
          rightsConfirmed: true,
          explicit,
          coverPath: prep.cover?.path || null,
          tracks: files.map((_, i) => ({
            title: (trackTitles[i] || `Track ${i + 1}`).trim(),
            audioPath: prep.tracks[i].path,
            position: i + 1,
          })),
        }),
      })
      const fin = await finRes.json()
      if (!finRes.ok) throw new Error(fin.error || 'Submit failed')

      trackEvent('upload_complete', { genre, track_count: files.length, release_type: releaseType })
      setProgress('')
      setTitle('')
      setGenre('')
      setDescription('')
      setFiles([])
      setTrackTitles([])
      setCover(null)
      setRights(false)
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed')
    } finally {
      setLoading(false)
      setProgress('')
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <p className="rounded-xl border border-brand/20 bg-brand/5 px-4 py-3 text-sm text-text-secondary">
        Submit an <strong className="text-text-primary">album, EP or multi-track project</strong> (cover + ordered
        songs). After editorial approve &amp; publish, tracks can enter continuous rotation. Premium is separate —
        for multi-platform distribution when a partner is configured.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          Release title *
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-bg-primary px-4 py-3 outline-none focus:border-brand"
            placeholder="Album / EP title"
          />
        </label>
        <label className="block text-sm">
          Type
          <select
            value={releaseType}
            onChange={(e) => setReleaseType(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-bg-primary px-4 py-3 outline-none focus:border-brand"
          >
            <option value="single">Single</option>
            <option value="ep">EP</option>
            <option value="album">Album</option>
            <option value="mixtape">Mixtape</option>
            <option value="compilation">Compilation</option>
          </select>
        </label>
      </div>

      <label className="block text-sm">
        Genre *
        <select
          value={genre}
          onChange={(e) => setGenre(e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-white/10 bg-bg-primary px-4 py-3 outline-none focus:border-brand"
        >
          <option value="">Select genre</option>
          {genres.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        Description
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="mt-1.5 w-full rounded-xl border border-white/10 bg-bg-primary px-4 py-3 outline-none focus:border-brand"
          placeholder="Story, features, language, city…"
        />
      </label>

      <div>
        <label className="mb-1.5 block text-sm font-medium">Audio tracks * (1–30)</label>
        <input type="file" multiple onChange={(e) => onFiles(e.target.files)} className="text-sm" />
        {files.length > 0 && (
          <ul className="mt-3 space-y-2">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm">
                <span className="text-xs text-brand">{i + 1}</span>
                <input
                  value={trackTitles[i] || ''}
                  onChange={(e) => {
                    const next = [...trackTitles]
                    next[i] = e.target.value
                    setTrackTitles(next)
                  }}
                  className="min-w-[12rem] flex-1 rounded-lg border border-white/10 bg-black/20 px-2 py-1"
                />
                <span className="text-xs text-text-secondary">{(f.size / (1024 * 1024)).toFixed(1)} MB</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium">Cover art (recommended)</label>
        <input type="file" accept="image/*" onChange={(e) => setCover(e.target.files?.[0] || null)} className="text-sm" />
        {cover && <p className="mt-1 text-xs text-text-secondary">{cover.name}</p>}
      </div>

      <label className="flex gap-3 rounded-xl border border-white/10 p-4 text-sm">
        <input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} className="mt-1 accent-brand" />
        <span>
          <strong className="block">I control the necessary rights</strong>
          <span className="text-text-secondary">
            I have permission for every recording and composition on this release for BVS streaming and, if I join
            Premium later, multi-platform distribution packaging.
          </span>
        </span>
      </label>

      <label className="flex gap-3 rounded-xl border border-white/10 p-4 text-sm">
        <input type="checkbox" checked={explicit} onChange={(e) => setExplicit(e.target.checked)} className="mt-1 accent-brand" />
        <span>
          <strong className="block">Explicit content</strong>
          <span className="text-text-secondary">Mark if any track contains explicit language or themes.</span>
        </span>
      </label>

      {error && <div role="alert" className="rounded-xl bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
      {loading && progress && <p className="text-center text-sm text-brand" aria-live="polite">{progress}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-full bg-brand py-4 text-lg font-semibold text-black hover:bg-brand-dark disabled:opacity-60"
      >
        {loading ? progress || 'Submitting…' : 'Submit release for review'}
      </button>
    </form>
  )
}
