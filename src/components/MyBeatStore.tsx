'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient, isSupabaseConfigured } from '@/lib/supabase'
import { isAllowedAudioFile } from '@/lib/audio-formats'

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
  beat_review_messages?: Array<{
    id: string
    author_kind: 'producer' | 'editor'
    message: string
    created_at: string
  }>
}

type BeatEntitlements = {
  planId?: string
  tier?: string
  beatLiveLimit?: number | null
  liveCount?: number
  remaining?: number | null
  softWarn?: boolean
  canGoLive?: boolean
  marketplaceCommissionBps?: number
}

const field =
  'w-full rounded-xl border border-white/10 bg-black/20 p-3 outline-none focus:border-brand'

function validateArtwork(file: File) {
  if (!/\.(jpe?g|png|webp)$/i.test(file.name)) return 'Cover art must be JPG, PNG, or WebP.'
  if (!file.size) return 'The selected cover art is empty.'
  if (file.size > 8 * 1024 * 1024) return 'Cover art must be 8MB or smaller.'
  return ''
}

async function putSigned(slot: { signedUrl: string; path: string; contentType?: string }, file: File, onProgress: (percent: number) => void) {
  const contentType = file.type || (file.name.match(/\.png$/i) ? 'image/png' : file.name.match(/\.webp$/i) ? 'image/webp' : file.name.match(/\.(jpe?g)$/i) ? 'image/jpeg' : 'application/octet-stream')
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', slot.signedUrl)
    xhr.setRequestHeader('Content-Type', slot.contentType || contentType)
    xhr.upload.onprogress = event => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100))
    }
    xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed for ${file.name}.`))
    xhr.onerror = () => reject(new Error(`Upload failed for ${file.name}. Check your connection and retry.`))
    xhr.send(file)
  })
  return slot.path
}

export default function MyBeatStore({ creationOnly = false }: { creationOnly?: boolean }) {
  const supabaseReady = isSupabaseConfigured()
  const [token, setToken] = useState('')
  const [beats, setBeats] = useState<Beat[]>([])
  const [entitlements, setEntitlements] = useState<BeatEntitlements | null>(null)
  const [error, setError] = useState(supabaseReady ? '' : 'Supabase is not configured.')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
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
  const [reviewReplies, setReviewReplies] = useState<Record<string, string>>({})

  const load = useCallback(async (accessToken: string) => {
    const res = await fetch('/api/beats?scope=mine', {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    })
    const payload = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(payload.error || 'Could not load BeatStore.')
    setBeats(payload.beats || [])
    setEntitlements(payload.entitlements || null)
  }, [])

  useEffect(() => {
    if (!supabaseReady) return
    createClient()
      .auth.getSession()
      .then(({ data }) => {
        const t = data.session?.access_token
        if (!t) {
          setError('Sign in with an artist/producer account to open My BeatStore.')
          return
        }
        setToken(t)
        if (!creationOnly) {
          load(t).catch((e) => setError(e instanceof Error ? e.message : 'Load failed'))
        }
      })
  }, [creationOnly, load, supabaseReady])

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
      for (const file of [preview, master].filter((value): value is File => Boolean(value))) {
        const check = isAllowedAudioFile(file)
        if (!check.ok) throw new Error(check.error)
      }
      if (artwork) {
        const artworkError = validateArtwork(artwork)
        if (artworkError) throw new Error(artworkError)
      }

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
        if (preview && slots.preview) previewPath = await putSigned(slots.preview, preview, percent => setUploadProgress(`Tagged preview · ${preview.name}: ${percent}%`))
        if (master && slots.master) masterPath = await putSigned(slots.master, master, percent => setUploadProgress(`Master · ${master.name}: ${percent}%`))
        if (artwork && slots.artwork) artworkPath = await putSigned(slots.artwork, artwork, percent => setUploadProgress(`Cover · ${artwork.name}: ${percent}%`))
      }

      setUploadProgress(submit ? 'Submitting for editorial review…' : 'Saving draft…')
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
      if (!creationOnly) await load(token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.')
    } finally {
      setBusy(false)
      setUploadProgress('')
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

  const sendReviewMessage = async (beatId: string) => {
    if (!token) return
    const reviewMessage = (reviewReplies[beatId] || '').trim()
    if (!reviewMessage) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/beats/${beatId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'message', message: reviewMessage }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.error || 'Could not send message.')
      setReviewReplies(current => ({ ...current, [beatId]: '' }))
      setMessage('Message sent to BVS editorial.')
      await load(token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send message.')
    } finally {
      setBusy(false)
    }
  }

  if (error && !token) {
    return (
      <section className="mt-10 rounded-2xl border border-white/10 p-6">
        <h2 className="text-2xl">My BeatStore</h2>
        <p className="mt-3 text-text-secondary">{error}</p>
        <Link href={`/auth/login?next=${creationOnly ? '/upload' : '/creator/studio'}`} className="mt-4 inline-block text-brand">
          Sign in →
        </Link>
      </section>
    )
  }

  return (
    <section className={creationOnly ? '' : 'mt-10'}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-brand">Producer</p>
          <h2 className="mt-1 text-2xl">{creationOnly ? 'Upload a single beat' : 'My BeatStore'}</h2>
          <p className="mt-2 max-w-2xl text-sm text-text-secondary">
            Upload a tagged preview, set a Standard lease price, and submit for editorial. Published
            beats appear in Beats / BeatStore. Live limits only apply when a beat goes public for sale
            — drafts and in-review do not count.
          </p>
          {entitlements && (
            <div
              className={`mt-3 rounded-xl border px-4 py-3 text-sm ${
                entitlements.canGoLive === false
                  ? 'border-amber-400/40 bg-amber-500/10 text-amber-50'
                  : entitlements.softWarn
                    ? 'border-brand/40 bg-brand/10 text-brand'
                    : 'border-white/10 bg-white/[0.03] text-text-secondary'
              }`}
            >
              <p className="font-medium text-white">
                Live for sale:{' '}
                {entitlements.beatLiveLimit == null
                  ? `${entitlements.liveCount ?? 0} (fair-use / unlimited)`
                  : `${entitlements.liveCount ?? 0} / ${entitlements.beatLiveLimit}`}
              </p>
              <p className="mt-1 text-xs opacity-90">
                Tier: {entitlements.tier || 'free'}
                {typeof entitlements.marketplaceCommissionBps === 'number'
                  ? ` · platform fee ${(entitlements.marketplaceCommissionBps / 100).toFixed(0)}%`
                  : ''}
                {entitlements.canGoLive === false
                  ? ' · Limit reached — archive a live beat or upgrade on Premium before new go-live.'
                  : entitlements.softWarn
                    ? ' · Near your live limit — upgrade anytime on /premium.'
                    : ' · Growth-era free tier allows up to 25 live beats.'}
              </p>
            </div>
          )}
        </div>
        {creationOnly ? (
          <Link href="/creator/studio" className="text-sm text-brand">
            Manage my beats →
          </Link>
        ) : (
          <Link href="/catalogue?type=beat#beatstore" className="text-sm text-brand">
            View public BeatStore →
          </Link>
        )}
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
        {uploadProgress && <p className="text-sm text-brand" role="status">{uploadProgress}</p>}
        <p className="text-xs text-text-secondary">
          MVP uses one Standard lease tier. Full legal licence copy is finalized by BVS before
          multi-tier commerce.
        </p>
      </form>

      {!creationOnly && <div className="mt-8 space-y-3">
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
                  <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-brand">Review conversation</p>
                    <div className="mt-2 space-y-2">
                      {(beat.beat_review_messages || []).map(item => (
                        <p key={item.id} className="rounded-lg bg-white/5 p-2 text-xs">
                          <span className="font-semibold capitalize">{item.author_kind}:</span> {item.message}
                          <span className="ml-2 text-text-secondary">{new Date(item.created_at).toLocaleString()}</span>
                        </p>
                      ))}
                      {!beat.beat_review_messages?.length && <p className="text-xs text-text-secondary">Editorial messages will appear here.</p>}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <input value={reviewReplies[beat.id] || ''} onChange={event => setReviewReplies(current => ({ ...current, [beat.id]: event.target.value }))} placeholder="Reply to editorial…" className={`${field} py-2 text-sm`} />
                      <button type="button" disabled={busy || !(reviewReplies[beat.id] || '').trim()} onClick={() => void sendReviewMessage(beat.id)} className="rounded-full border border-brand px-4 py-2 text-xs text-brand disabled:opacity-40">Send</button>
                    </div>
                  </div>
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
      </div>}
    </section>
  )
}
