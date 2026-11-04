'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import CreatorProfileArtwork from '@/components/CreatorProfileArtwork'
import { mediaUrlForStoredValue } from '@/lib/media-url'
import { createClient, isSupabaseConfigured } from '@/lib/supabase'
import BeatCrateUploadForm from '@/components/BeatCrateUploadForm'
import FullAccessAudioPlayer from '@/components/FullAccessAudioPlayer'
import CreatorNextMoveCard from '@/components/CreatorNextMoveCard'
import CreatorNextMovePrompt from '@/components/CreatorNextMovePrompt'
import { producerBeatNextMove } from '@/lib/creator-next-move'

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
  master_path?: string | null
  artwork_path?: string | null
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

export default function MyBeatStore({ creationOnly = false, managementOnly = false }: { creationOnly?: boolean; managementOnly?: boolean }) {
  const supabaseReady = isSupabaseConfigured()
  const [token, setToken] = useState('')
  const [beats, setBeats] = useState<Beat[]>([])
  const [beatQuery, setBeatQuery] = useState('')
  const [beatPage, setBeatPage] = useState(1)
  const matchingBeats = beats.filter(beat => `${beat.title} ${beat.genre || ''} ${beat.status}`.toLowerCase().includes(beatQuery.trim().toLowerCase()))
  const beatPages = Math.max(1, Math.ceil(matchingBeats.length / 8))
  const currentBeatPage = Math.min(beatPage, beatPages)
  const [entitlements, setEntitlements] = useState<BeatEntitlements | null>(null)
  const [error, setError] = useState(supabaseReady ? '' : 'Supabase is not configured.')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
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

  if (creationOnly) return <BeatCrateUploadForm />

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

  const nextMoveForBeat = (beat: Beat) =>
    producerBeatNextMove({
      beatId: beat.id,
      title: beat.title,
      status: beat.status,
      isPublic: beat.is_public,
      tier: entitlements?.tier,
      liveCount: entitlements?.liveCount,
      beatLiveLimit: entitlements?.beatLiveLimit,
      softWarn: entitlements?.softWarn,
      canGoLive: entitlements?.canGoLive,
    })
  const promptBeat = creationOnly
    ? undefined
    : beats.find((beat) => {
        const move = nextMoveForBeat(beat)
        return Boolean(move && move.id !== 'producer-review-attention')
      })
  const promptMove = promptBeat ? nextMoveForBeat(promptBeat) : null

  return (
    <section data-studio-accent="beats" className={creationOnly ? '' : 'mt-8'}>
      <CreatorNextMovePrompt
        move={promptMove}
        storageKey={promptBeat ? `producer-beat:${promptBeat.id}` : 'producer-beat:none'}
      />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="bvs-studio-accent-label text-xs uppercase tracking-[0.22em]">Producer</p>
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
          <Link href="/creator/studio" className="bvs-studio-accent-button rounded-full border px-4 py-2 text-sm font-semibold">
            Manage my beats →
          </Link>
        ) : (
          <Link href="/catalogue?type=beat#beatstore" className="bvs-studio-accent-button rounded-full border px-4 py-2 text-sm font-semibold">
            View public BeatStore →
          </Link>
        )}
      </div>

      {error && <p className="mt-4 rounded-xl bg-red-500/10 p-4 text-red-200">{error}</p>}
      {message && <p className="mt-4 rounded-xl bg-brand/10 p-4 text-brand">{message}</p>}

      {!managementOnly && <BeatCrateUploadForm onSubmitted={() => { if (token && !creationOnly) void load(token) }} />}

      {!creationOnly && <div className="mt-8 space-y-3">
        <h3 className="text-xl">Your beats</h3>
        <div className="bvs-studio-catalogue-controls"><label><span className="sr-only">Search your beats</span><input type="search" value={beatQuery} placeholder="Find a beat or status" onChange={event => { setBeatQuery(event.target.value); setBeatPage(1) }} /></label><span role="status">{matchingBeats.length} beats</span>{beatPages > 1 ? <div><button type="button" disabled={currentBeatPage === 1} onClick={() => setBeatPage(currentBeatPage - 1)}>Previous</button><span>{currentBeatPage} / {beatPages}</span><button type="button" disabled={currentBeatPage === beatPages} onClick={() => setBeatPage(currentBeatPage + 1)}>Next</button></div> : null}</div>
        {matchingBeats.slice((currentBeatPage - 1) * 8, currentBeatPage * 8).map((beat) => {
          const priceUsd = beat.beat_licence_options?.[0]?.price_usd
          const nextMove = nextMoveForBeat(beat)
          return (
            <details key={beat.id} className="bvs-studio-compact-track bvs-studio-compact-beat">
              <summary>
                <div className="bvs-studio-cover"><CreatorProfileArtwork src={mediaUrlForStoredValue(beat.artwork_path) || undefined} name={beat.title} /></div>
                <div className="bvs-studio-track-identity"><h4>{beat.title}</h4><p>{beat.genre || 'Beat'}{beat.bpm ? ` · ${beat.bpm} BPM` : ''} · {beat.status.replaceAll('_', ' ')}{beat.is_public ? ' · Public' : ' · Private'}</p></div>
                <span className="bvs-studio-track-plays"><strong>{priceUsd != null ? `$${Number(priceUsd).toFixed(2)}` : '—'}</strong><small>{['rejected', 'changes_requested'].includes(beat.status) ? 'Review needed' : beat.status === 'draft' ? 'Draft' : beat.is_public ? 'Live' : 'In review'}</small></span>
                <span className="bvs-studio-track-expand" aria-hidden="true">⌄</span>
              </summary>
              <div className="bvs-studio-track-inspector flex flex-wrap items-start justify-between gap-3">
                <div>
                  {beat.editorial_notes && (
                    <p className="mt-2 text-sm text-text-secondary">Editor: {beat.editorial_notes}</p>
                  )}
                  <div className="mt-3">
                    <FullAccessAudioPlayer accessId={`studio-beat:${beat.id}`} title={beat.title} artist="Your BeatStore submission" src={beat.master_path || beat.preview_path} artwork={beat.artwork_path} sourceLabel="Studio · your full beat" genre={beat.genre} compact />
                  </div>
                  <CreatorNextMoveCard move={nextMove} className="mt-3" />
                  <Link href={`/creator/studio/artwork?beat=${encodeURIComponent(beat.id)}#studio-beat-cover-change`} aria-label={`Change cover for ${beat.title}`} className="bvs-studio-accent-button mt-3 inline-flex min-h-11 items-center rounded-full border px-4 py-2 text-sm font-semibold">
                    Change cover
                  </Link>
                  <div data-studio-accent="insights" className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 sm:p-4">
                    <p className="bvs-studio-accent-label text-xs font-semibold uppercase tracking-wider">Review conversation</p>
                    <div className="mt-2 max-h-48 space-y-2 overflow-y-auto">
                      {(beat.beat_review_messages || []).map(item => (
                        <p key={item.id} className="rounded-lg bg-white/5 p-2 text-xs">
                          <span className="font-semibold capitalize">{item.author_kind}:</span> {item.message}
                          <span className="ml-2 text-text-secondary">{new Date(item.created_at).toLocaleString()}</span>
                        </p>
                      ))}
                      {!beat.beat_review_messages?.length && <p className="text-xs text-text-secondary">Editorial messages will appear here.</p>}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <input aria-label={`Reply to editorial about ${beat.title}`} value={reviewReplies[beat.id] || ''} onChange={event => setReviewReplies(current => ({ ...current, [beat.id]: event.target.value }))} placeholder="Reply to editorial…" className={`${field} py-2 text-sm`} />
                      <button type="button" disabled={busy || !(reviewReplies[beat.id] || '').trim()} onClick={() => void sendReviewMessage(beat.id)} className="bvs-studio-accent-button rounded-full border px-4 py-2 text-xs font-semibold disabled:opacity-40">Send</button>
                    </div>
                  </div>
                </div>
                {['draft', 'changes_requested', 'rejected'].includes(beat.status) && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void submitExisting(beat.id)}
                    className="bvs-studio-accent-button rounded-full border px-4 py-2 text-xs font-semibold disabled:opacity-40"
                  >
                    Submit
                  </button>
                )}
              </div>
            </details>
          )
        })}
        {beats.length > 0 && !matchingBeats.length ? <p className="py-5 text-sm text-text-secondary">No beats match. <button type="button" onClick={() => setBeatQuery('')} className="min-h-11 text-brand">Clear search</button></p> : null}
        {!beats.length && (
          <p className="rounded-xl border border-dashed border-white/10 p-5 text-sm text-text-secondary">
            No beats yet. Add your first listing above.
          </p>
        )}
      </div>}
    </section>
  )
}
