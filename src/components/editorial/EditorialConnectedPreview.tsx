
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useStationPlayer } from '@/components/StationPlayer'
import { createClient } from '@/lib/supabase'

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const whole = Math.floor(seconds)
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

type ReviewTarget = { kind: 'track' | 'beat' | 'release-track'; id: string }
type ReviewAudioSource = 'full' | 'master' | 'preview'

function reviewTarget(previewId: string): ReviewTarget | null {
  const parts = String(previewId || '').split(':').filter(Boolean)
  if (!parts.length) return null
  if ((parts[0] === 'single' || parts[0] === 'track') && parts[1]) return { kind: 'track', id: parts[1] }
  if (parts[0] === 'beat' && parts[1]) return { kind: 'beat', id: parts[1] }
  if (parts[0] === 'release-track' && parts[1]) return { kind: 'release-track', id: parts[1] }
  if (parts[0] === 'release' && parts.length >= 3) return { kind: 'release-track', id: parts[parts.length - 1] }
  if (parts[0] === 'work' && parts[1] === 'track' && parts[2]) return { kind: 'track', id: parts[2] }
  if (parts[0] === 'work' && parts[1] === 'beat' && parts[2]) return { kind: 'beat', id: parts[2] }
  return null
}

/**
 * Canonical Editorial review-audio surface.
 *
 * Known Editorial objects resolve their audio again through the authenticated
 * review-audio endpoint at play time. The server stays authoritative for private
 * media access. Beat masters are preferred; when only the producer's uploaded
 * preview exists, Editorial may review it with an explicit preview-only label.
 * Playback itself stays in the persistent BVS player.
 */
export default function EditorialConnectedPreview({
  previewId,
  title,
  artist,
  src,
  artwork,
  project = 'Editorial · full submission',
  genre,
  compact = false,
}: {
  previewId: string
  title: string
  artist: string
  src?: string | null
  artwork?: string | null
  project?: string
  genre?: string
  compact?: boolean
}) {
  const player = useStationPlayer()
  const target = useMemo(() => reviewTarget(previewId), [previewId])
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null)
  const [resolvedAudioSource, setResolvedAudioSource] = useState<ReviewAudioSource | null>(null)
  const [resolving, setResolving] = useState(false)
  const [resolveError, setResolveError] = useState('')

  useEffect(() => {
    setResolvedSrc(null)
    setResolvedAudioSource(null)
    setResolveError('')
    setResolving(false)
  }, [previewId])

  // For recognized Editorial objects, never trust a caller-provided URL as the
  // playable source. Unknown legacy objects may still use an already-signed
  // source supplied by their authenticated Editorial API.
  const playableSrc = target ? resolvedSrc : (src || null)
  const playbackProject = target?.kind === 'beat' && resolvedAudioSource === 'preview'
    ? 'Editorial · uploaded preview'
    : project
  const active = Boolean(playableSrc) && player.current?.src === playableSrc && player.playingFrom === playbackProject
  const elapsed = active ? player.elapsed : 0
  const duration = active ? player.duration : 0
  const progress = duration > 0 ? Math.min(1, Math.max(0, elapsed / duration)) : 0

  const playSource = (audioSrc: string, audioSource: ReviewAudioSource | null = resolvedAudioSource) => {
    const sourceProject = target?.kind === 'beat' && audioSource === 'preview'
      ? 'Editorial · uploaded preview'
      : project
    player.playNow({
      id: target?.id || previewId,
      title,
      artist,
      src: audioSrc,
      artwork: artwork || undefined,
      project: sourceProject,
      genre,
      kind: target?.kind === 'beat' ? 'beat' : 'track',
      isDownloadable: false,
      licenceType: 'not_for_sale',
    }, { from: sourceProject, related: [], review: true })
  }

  const resolveAndPlay = async () => {
    if (!target) {
      if (src) playSource(src)
      return
    }
    if (resolvedSrc) {
      playSource(resolvedSrc)
      return
    }
    if (resolving) return
    setResolving(true)
    setResolveError('')
    try {
      const { data } = await createClient().auth.getSession()
      const token = data.session?.access_token
      if (!token) throw new Error('Your Editorial session expired. Sign in again.')
      const params = new URLSearchParams({ kind: target.kind, id: target.id })
      const response = await fetch(`/api/admin/editorial/review-audio?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      const body = await response.json().catch(() => ({})) as {
        audioUrl?: string
        audioSource?: ReviewAudioSource
        error?: string
      }
      if (!response.ok || !body.audioUrl) throw new Error(body.error || 'Submission audio is unavailable.')
      const audioSource = body.audioSource || (target.kind === 'beat' ? 'master' : 'full')
      setResolvedSrc(body.audioUrl)
      setResolvedAudioSource(audioSource)
      playSource(body.audioUrl, audioSource)
    } catch (error) {
      setResolveError(error instanceof Error ? error.message : 'Submission audio is unavailable.')
    } finally {
      setResolving(false)
    }
  }

  const toggle = () => {
    if (active) {
      player.toggle()
      return
    }
    void resolveAndPlay()
  }

  if (!target && !src) {
    return <div className="rounded-xl border border-dashed border-white/10 px-3 py-2 text-xs text-text-secondary">Submission audio is not available.</div>
  }

  return (
    <div>
      <div
        data-editorial-connected-preview={previewId}
        data-editorial-review-audio={previewId}
        data-editorial-audio-source={resolvedAudioSource || undefined}
        className={`flex min-w-0 items-center gap-3 rounded-xl border border-white/10 bg-white/[.055] ${compact ? 'px-2.5 py-1.5' : 'px-3 py-2'}`}
      >
        <button
          type="button"
          onClick={toggle}
          disabled={resolving}
          className={`${compact ? 'h-9 w-9' : 'h-10 w-10'} grid shrink-0 place-items-center rounded-full bg-white text-sm font-black text-black disabled:opacity-60`}
          aria-label={`${active && player.isPlaying ? 'Pause' : 'Play review audio'} ${title}`}
        >
          {resolving ? '…' : active && player.isPlaying ? 'Ⅱ' : '▶'}
        </button>
        <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-text-secondary">{formatTime(elapsed)}</span>
        <input
          type="range"
          min="0"
          max="1000"
          value={Math.round(progress * 1000)}
          disabled={!active || duration <= 0}
          onChange={(event) => player.seek(Number(event.target.value) / 1000)}
          className="min-w-20 flex-1 accent-brand disabled:opacity-45"
          aria-label={`Seek review audio for ${title}`}
        />
        <span className="w-10 shrink-0 text-[11px] tabular-nums text-text-secondary">{duration > 0 ? `-${formatTime(Math.max(0, duration - elapsed))}` : '0:00'}</span>
      </div>
      {target?.kind === 'beat' && resolvedAudioSource === 'preview' ? (
        <p className="mt-1 text-[11px] text-amber-200" data-editorial-preview-fallback>
          Playing the producer&apos;s uploaded preview — a full master is not attached.
        </p>
      ) : null}
      {resolveError ? <p className="mt-1 text-[11px] text-amber-200">{resolveError}</p> : null}
    </div>
  )
}
