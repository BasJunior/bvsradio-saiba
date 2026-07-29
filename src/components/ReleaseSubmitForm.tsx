'use client'

import { useState } from 'react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase'
import { isAllowedAudioFile } from '@/lib/audio-formats'
import { trackEvent } from '@/lib/analytics'

type Slot = { path: string; signedUrl: string; contentType: string; index?: number }

async function putToSignedSlot(slot: Slot, file: File) {
  const res = await fetch(slot.signedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': slot.contentType || file.type || 'application/octet-stream' },
    body: file,
  })
  if (!res.ok) throw new Error(`Upload failed (${res.status})`)
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
  const [explicitDeclared, setExplicitDeclared] = useState(false)
  const [copyrightYear, setCopyrightYear] = useState(String(new Date().getFullYear()))
  const [masterOwner, setMasterOwner] = useState('')
  const [compositionOwners, setCompositionOwners] = useState('')
  const [songwriters, setSongwriters] = useState('')
  const [producers, setProducers] = useState('')
  const [featuredArtists, setFeaturedArtists] = useState('')
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
    if (!title.trim() || !genre || !files.length || !cover || !rights || !explicitDeclared) {
      setError('Title, genre, cover art, tracks, rights confirmation and explicit-status declaration are required.')
      return
    }
    if (!masterOwner.trim() || !compositionOwners.trim() || !songwriters.trim() || !producers.trim()) {
      setError('Name the master owner, composition owner, songwriter and producer before submitting.')
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
          explicitDeclared: true,
          copyrightYear: Number(copyrightYear),
          masterOwnerName: masterOwner.trim(),
          compositionOwnerNames: compositionOwners.split(',').map((value) => value.trim()).filter(Boolean),
          territories: ['WORLD'],
          songwriters: songwriters.split(',').map((value) => value.trim()).filter(Boolean),
          producers: producers.split(',').map((value) => value.trim()).filter(Boolean),
          featuredArtists: featuredArtists.split(',').map((value) => value.trim()).filter(Boolean),
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
      setExplicitDeclared(false)
      setMasterOwner('')
      setCompositionOwners('')
      setSongwriters('')
      setProducers('')
      setFeaturedArtists('')
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

      <section className="space-y-4 rounded-2xl border border-brand/20 bg-brand/[.03] p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand">Rights Passport</p>
          <h3 className="mt-1 text-lg font-semibold">Ownership and contributor details</h3>
          <p className="mt-1 text-xs text-text-secondary">Use legal or professionally credited names. Separate multiple names with commas.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm">Copyright year *
            <input value={copyrightYear} onChange={(e) => setCopyrightYear(e.target.value)} inputMode="numeric" className="mt-1.5 w-full rounded-xl border border-white/10 bg-bg-primary px-4 py-3" />
          </label>
          <label className="text-sm">Master recording owner *
            <input value={masterOwner} onChange={(e) => setMasterOwner(e.target.value)} placeholder="Person or company" className="mt-1.5 w-full rounded-xl border border-white/10 bg-bg-primary px-4 py-3" />
          </label>
        </div>
        <label className="block text-sm">Composition / publishing owner(s) *
          <input value={compositionOwners} onChange={(e) => setCompositionOwners(e.target.value)} placeholder="Names, separated by commas" className="mt-1.5 w-full rounded-xl border border-white/10 bg-bg-primary px-4 py-3" />
        </label>
        <label className="block text-sm">Songwriter(s) / composer(s) *
          <input value={songwriters} onChange={(e) => setSongwriters(e.target.value)} placeholder="Names, separated by commas" className="mt-1.5 w-full rounded-xl border border-white/10 bg-bg-primary px-4 py-3" />
        </label>
        <label className="block text-sm">Producer(s) *
          <input value={producers} onChange={(e) => setProducers(e.target.value)} placeholder="Names, separated by commas" className="mt-1.5 w-full rounded-xl border border-white/10 bg-bg-primary px-4 py-3" />
        </label>
        <label className="block text-sm">Featured artist(s)
          <input value={featuredArtists} onChange={(e) => setFeaturedArtists(e.target.value)} placeholder="Optional; names separated by commas" className="mt-1.5 w-full rounded-xl border border-white/10 bg-bg-primary px-4 py-3" />
        </label>
        <p className="text-xs text-text-secondary">Territory: worldwide for BVS review. Editorial must request changes before any narrower territory is published.</p>
      </section>

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
        <label className="mb-1.5 block text-sm font-medium">Cover art *</label>
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
        <input type="checkbox" checked={explicitDeclared} onChange={(e) => setExplicitDeclared(e.target.checked)} className="mt-1 accent-brand" />
        <span>
          <strong className="block">Explicit status declared *</strong>
          <span className="text-text-secondary">I reviewed every track and the explicit-content choice below is accurate.</span>
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
