'use client'

import { useEffect } from 'react'

const MAX_TRACK_DURATION_SECONDS = 12 * 60 * 60
const METADATA_TIMEOUT_MS = 15_000

type RotationPayload = {
  action?: unknown
  trackId?: unknown
  enabled?: unknown
}

type DurationStatus = {
  verified?: boolean
  durationSec?: number | null
  error?: string
}

type ReviewAudio = {
  audioUrl?: string
  error?: string
}

function requestUrl(input: RequestInfo | URL) {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  return input.url
}

function requestMethod(input: RequestInfo | URL, init?: RequestInit) {
  return String(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase()
}

function requestHeader(input: RequestInfo | URL, init: RequestInit | undefined, name: string) {
  const fromInit = new Headers(init?.headers).get(name)
  if (fromInit) return fromInit
  return input instanceof Request ? input.headers.get(name) || '' : ''
}

async function requestPayload(input: RequestInfo | URL, init?: RequestInit): Promise<RotationPayload | null> {
  let raw = ''
  if (typeof init?.body === 'string') raw = init.body
  else if (input instanceof Request) raw = await input.clone().text().catch(() => '')
  if (!raw) return null
  try {
    return JSON.parse(raw) as RotationPayload
  } catch {
    return null
  }
}

function jsonError(message: string, status = 409) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function measureAudioDuration(audioUrl: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = document.createElement('audio')
    let finished = false
    let attemptedSeek = false

    const cleanup = () => {
      window.clearTimeout(timeout)
      audio.removeEventListener('loadedmetadata', inspect)
      audio.removeEventListener('durationchange', inspect)
      audio.removeEventListener('timeupdate', inspect)
      audio.removeEventListener('error', fail)
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
    }

    const settle = (value?: number, error?: Error) => {
      if (finished) return
      finished = true
      cleanup()
      if (error) reject(error)
      else resolve(value as number)
    }

    const inspect = () => {
      const duration = Number(audio.duration)
      if (Number.isFinite(duration) && duration > 0 && duration <= MAX_TRACK_DURATION_SECONDS) {
        settle(duration)
        return
      }
      // Some streamed MP3/AAC files initially report Infinity. A metadata seek asks
      // the browser to resolve the real end time without starting playback.
      if (!attemptedSeek && duration === Infinity && audio.readyState >= HTMLMediaElement.HAVE_METADATA) {
        attemptedSeek = true
        try {
          audio.currentTime = Number.MAX_SAFE_INTEGER
        } catch {
          // Keep waiting for durationchange/error until the timeout below.
        }
      }
    }

    const fail = () => settle(undefined, new Error('The browser could not read this audio file metadata.'))
    const timeout = window.setTimeout(
      () => settle(undefined, new Error('Audio duration verification timed out.')),
      METADATA_TIMEOUT_MS,
    )

    audio.preload = 'metadata'
    audio.addEventListener('loadedmetadata', inspect)
    audio.addEventListener('durationchange', inspect)
    audio.addEventListener('timeupdate', inspect)
    audio.addEventListener('error', fail)
    audio.src = audioUrl
    audio.load()
  })
}

async function readJson<T>(response: Response): Promise<T> {
  return response.json().catch(() => ({} as T)) as Promise<T>
}

async function ensureTrackDuration(
  originalFetch: typeof window.fetch,
  trackId: string,
  authorization: string,
) {
  const authHeaders = { Authorization: authorization }
  const statusResponse = await originalFetch(
    `/api/admin/editorial/verify-duration?trackId=${encodeURIComponent(trackId)}`,
    { headers: authHeaders, cache: 'no-store' },
  )
  const status = await readJson<DurationStatus>(statusResponse)
  if (!statusResponse.ok) throw new Error(status.error || 'Could not check the audio duration.')
  if (status.verified) return

  const audioResponse = await originalFetch(
    `/api/admin/editorial/review-audio?kind=track&id=${encodeURIComponent(trackId)}`,
    { headers: authHeaders, cache: 'no-store' },
  )
  const reviewAudio = await readJson<ReviewAudio>(audioResponse)
  if (!audioResponse.ok || !reviewAudio.audioUrl) {
    throw new Error(reviewAudio.error || 'The submitted audio file is unavailable for duration verification.')
  }

  const durationSec = await measureAudioDuration(reviewAudio.audioUrl)
  const saveResponse = await originalFetch('/api/admin/editorial/verify-duration', {
    method: 'PATCH',
    headers: {
      ...authHeaders,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ trackId, durationSec }),
  })
  const saved = await readJson<DurationStatus>(saveResponse)
  if (!saveResponse.ok || !saved.verified) {
    throw new Error(saved.error || 'BVS could not save the verified audio duration.')
  }
}

/**
 * Rotation depends on an accurate duration, but legacy single-track uploads did not
 * persist one. Keep the existing Editorial UI intact and transparently repair that
 * metadata the first time an editor adds the track to rotation.
 */
export default function EditorialRotationDurationVerifier() {
  useEffect(() => {
    const originalFetch = window.fetch
    const inFlight = new Map<string, Promise<void>>()

    const patchedFetch: typeof window.fetch = async (input, init) => {
      const url = new URL(requestUrl(input), window.location.origin)
      if (url.pathname !== '/api/admin/editorial' || requestMethod(input, init) !== 'PATCH') {
        return originalFetch.call(window, input, init)
      }

      const payload = await requestPayload(input, init)
      const trackId = String(payload?.trackId || '').trim()
      if (payload?.action !== 'set_rotation' || payload.enabled !== true || !trackId) {
        return originalFetch.call(window, input, init)
      }

      const authorization = requestHeader(input, init, 'Authorization')
      if (!authorization) return originalFetch.call(window, input, init)

      try {
        let repair = inFlight.get(trackId)
        if (!repair) {
          repair = ensureTrackDuration(originalFetch.bind(window), trackId, authorization)
          inFlight.set(trackId, repair)
        }
        await repair
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not verify the audio duration.'
        return jsonError(`${message} Rotation was not changed.`)
      } finally {
        inFlight.delete(trackId)
      }

      return originalFetch.call(window, input, init)
    }

    window.fetch = patchedFetch
    return () => {
      if (window.fetch === patchedFetch) window.fetch = originalFetch
    }
  }, [])

  return null
}
