'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient, isSupabaseConfigured } from '@/lib/supabase'

type Licence = {
  id?: string
  licence_name?: string
  price_usd?: number
  is_active?: boolean
}

type Beat = {
  id: string
  title: string
  description?: string
  genre?: string
  mood?: string
  bpm?: number | null
  status: string
  is_public?: boolean
  preview_path?: string | null
  editorial_notes?: string | null
  created_at?: string
  beat_licence_options?: Licence[]
}

const field =
  'w-full rounded-xl border border-white/10 bg-black/20 p-3 outline-none focus:border-brand'

async function putSigned(slot: { signedUrl: string; token: string; path: string }, file: File) {
  // Supabase signed upload: PUT file bytes to signed URL
  const res = await fetch(slot.signedUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      'x-upsert': 'true',
    },
    body: file,
  })
  if (!res.ok) {
    throw new Error(`Upload failed for ${file.name}`)
  }
  return slot.path
}

export default function MyBeatStore() {
  const [token, setToken] = useState('')
  const [beats, setBeats] = useState<Beat[]>([])
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [genre, setGenre] = useState('Hip-Hop')
  const [mood, setMood] = useState('')
  const [bpm, setBpm] = useState('')
  const [price, setPrice] = useState('29')
  const [preview, setPreview] = useState<File | null>(null)
  const [master, setMaster] = useState<File | null>(null)
  const [artwork, setArtwork] = useState<File | null>(null)
  const [rights, setRights] = useState(false)

  const load = useCallback(async (accessToken: string) => {
    const res = await fetch('/api/beats?scope=mine', {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    })
    const payload = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(payload.error || 'Could not load BeatStore.')
    setBeats(payload.beats || [])
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setError('Supabase is not configured.')
      return
    }
    createClient()
      .auth.getSession()
      .then(({ data }) => {
        const t = data.session?.access_token
        if (!t) {
          setError('Sign in with an artist/producer account to open My BeatStore.')
          return
        }
        setToken(t)
        load(t).catch((e) => setError(e instanceof Error ? e.message : 'Load failed'))
      })
  }, [load])

  const onSubmit = async (e: FormEvent, submit: boolean) => {
    e.preventDefault()
    if (!token) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      if (!title.trim()) throw new Error('Title is required.')
      if (!rights) throw new Error('Confirm rights before saving.')
      if (submit && !preview) throw new Error('Upload a tagged preview before submitting.')

      let previewPath: string | null = null
      let masterPath: string | null = null
      let artworkPath: string | null = null

      if (preview || master || artwork) {
        const prepRes = await fetch('/api/beats/upload/prepare', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            preview: preview
              ? { name: preview.name, type: preview.type, size: preview.size }
              : undefined,
            master: master
              ? { name: master.name, type: master.type, size: master.size }
              : undefined,
            artwork: artwork
              ? { name: artwork.name, type: artwork.type, size: artwork.size }
              : undefined,
          }),
        })
        const prep = await prepRes.json().catch(() => ({}))
        if (!prepRes.ok) throw new Error(prep.error || 'Could not prepare uploads.')
        const slots = prep.slots || {}
        if (preview && slots.preview) previewPath = await putSigned(slots.preview, preview)
        if (master && slots.master) masterPath = await putSigned(slots.master, master)
        if (artwork && slots.artwork) artworkPath = await putSigned(slots.artwork, artwork)
      }

      const createRes = await fetch('/api/beats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          description,
          genre,
          mood,
          bpm: bpm ? Number(bpm) : null,
          priceUsd: Number(price),
          rightsConfirmed: true,
          previewPath,
          masterPath,
          artworkPath,
          submit,
        }),
      })
      const created = await createRes.json().catch(() => ({}))
      if (!createRes.ok) throw new Error(created.error || 'Could not save beat.')

      setMessage(submit ? 'Beat submitted for editorial review.' : 'Beat draft saved.')
      setTitle('')
      setDescription('')
      setMood('')
      setBpm('')
      setPreview(null)
      setMaster(null)
      setArtwork(null)
      setRights(false)
      await load(token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.')
    } finally {
      setBusy(false)
    }
  }

  const submitExisting = async (beatId: string) => {
    if (!token) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/beats/${beatId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'submit' }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.error || 'Submit failed.')
      setMessage('Submitted for review.')
      await load(token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed.')
    } finally {
      setBusy(false)
    }
  }

  if (error && !token) {
    return (
      <section className="mt-10 rounded-2xl border border-white/10 p-6">
        <h2 className="text-2xl">My BeatStore</h2>
        <p className="mt-3 text-text-secondary">{error}</p>
        <Link href="/auth/login?next=/creator/studio" className="mt-4 inline-block text-brand">
          Sign in →
        </Link>
      </section>
    )
  }

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-brand">Producer</p>
          <h2 className="mt-1 text-2xl">My BeatStore</h2>
          <p className="mt-2 max-w-2xl text-sm text-text-secondary">
            Upload a tagged preview, set a Standard lease price, and submit for editorial. Published
            beats appear in Beats / BeatStore.
          </p>
        </div>
        <Link href="/catalogue?type=beat#beatstore" className="text-sm text-brand">
          View public BeatStore →
        </Link>
      </div>

      {error && <p className="mt-4 rounded-xl bg-red-500/10 p-4 text-red-200">{error}</p>}
      {message && <p className="mt-4 rounded-xl bg-brand/10 p-4 text-brand">{message}</p>}

      <form
        className="mt-6 grid gap-3 rounded-2xl border border-white/10 p-6"
        onSubmit={(e) => void onSubmit(e, false)}
      >
        <h3 className="text-xl">Add beat</h3>
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Beat title"
          className={field}
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description"
          className={`${field} min-h-24`}
        />
        <div className="grid gap-3 sm:grid-cols-3">
          <input
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            placeholder="Genre"
            className={field}
          />
          <input
            value={mood}
            onChange={(e) => setMood(e.target.value)}
            placeholder="Mood tags"
            className={field}
          />
          <input
            value={bpm}
            onChange={(e) => setBpm(e.target.value)}
            placeholder="BPM"
            inputMode="numeric"
            className={field}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-text-secondary">
            Standard lease price (USD)
            <input
              required
              type="number"
              min={1}
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className={`${field} mt-1`}
            />
          </label>
          <label className="text-sm text-text-secondary">
            Tagged preview audio *
            <input
              type="file"
              accept="audio/*,.mp3,.wav,.m4a,.ogg"
              onChange={(e) => setPreview(e.target.files?.[0] || null)}
              className={`${field} mt-1`}
            />
          </label>
          <label className="text-sm text-text-secondary">
            WAV / master (private)
            <input
              type="file"
              accept="audio/*,.mp3,.wav,.m4a,.ogg"
              onChange={(e) => setMaster(e.target.files?.[0] || null)}
              className={`${field} mt-1`}
            />
          </label>
          <label className="text-sm text-text-secondary">
            Cover art
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
              onChange={(e) => setArtwork(e.target.files?.[0] || null)}
              className={`${field} mt-1`}
            />
          </label>
        </div>
        <label className="flex items-start gap-3 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={rights}
            onChange={(e) => setRights(e.target.checked)}
            className="mt-1"
          />
          I own or control the rights to this beat and can offer a Standard lease on BVS.
        </label>
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={busy}
            className="rounded-full border border-white/20 px-5 py-2 disabled:opacity-40"
          >
            {busy ? 'Saving…' : 'Save draft'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={(e) => void onSubmit(e as unknown as FormEvent, true)}
            className="rounded-full bg-brand px-5 py-2 font-semibold text-black disabled:opacity-40"
          >
            {busy ? 'Working…' : 'Submit for review'}
          </button>
        </div>
        <p className="text-xs text-text-secondary">
          MVP uses one Standard lease tier. Full legal licence copy is finalized by BVS before
          multi-tier commerce.
        </p>
      </form>

      <div className="mt-8 space-y-3">
        <h3 className="text-xl">Your beats</h3>
        {beats.map((beat) => {
          const priceUsd = beat.beat_licence_options?.[0]?.price_usd
          return (
            <article key={beat.id} className="rounded-xl border border-white/10 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h4 className="font-medium">{beat.title}</h4>
                  <p className="mt-1 text-xs capitalize text-text-secondary">
                    {beat.genre || 'Beat'} · {beat.status.replaceAll('_', ' ')}
                    {beat.is_public ? ' · public' : ' · not public'}
                    {priceUsd != null ? ` · $${Number(priceUsd).toFixed(2)}` : ''}
                  </p>
                  {beat.editorial_notes && (
                    <p className="mt-2 text-sm text-text-secondary">Editor: {beat.editorial_notes}</p>
                  )}
                </div>
                {['draft', 'changes_requested', 'rejected'].includes(beat.status) && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void submitExisting(beat.id)}
                    className="rounded-full border border-brand px-4 py-2 text-xs text-brand disabled:opacity-40"
                  >
                    Submit
                  </button>
                )}
              </div>
            </article>
          )
        })}
        {!beats.length && (
          <p className="rounded-xl border border-dashed border-white/10 p-5 text-sm text-text-secondary">
            No beats yet. Add your first listing above.
          </p>
        )}
      </div>
    </section>
  )
}
