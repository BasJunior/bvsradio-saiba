import { NextResponse } from 'next/server'
import { editorialIdentity, editorialUrl, serviceHeaders } from '@/lib/editorial-server'
import { r2KeyFromMediaUrl, safeR2Key, signedR2DownloadUrl } from '@/lib/r2-storage'

type ReviewKind = 'track' | 'beat' | 'release-track'
type ReviewAudioSource = 'full' | 'master' | 'preview'
type JsonRow = Record<string, unknown>

async function rows(path: string): Promise<JsonRow[]> {
  const response = await fetch(editorialUrl(path), { headers: serviceHeaders, cache: 'no-store' })
  if (!response.ok) throw new Error(await response.text())
  const body = await response.json()
  return Array.isArray(body) ? body as JsonRow[] : []
}

async function signedReviewAudio(value: unknown) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const key = r2KeyFromMediaUrl(raw) || (safeR2Key(raw) && !/^https?:/i.test(raw) ? raw : null)
  return key ? signedR2DownloadUrl(key, 6 * 60 * 60) : raw
}

export async function GET(request: Request) {
  const identity = await editorialIdentity(request)
  if (!identity) return NextResponse.json({ error: 'Editorial access required.' }, { status: 403 })

  const url = new URL(request.url)
  const kind = String(url.searchParams.get('kind') || '') as ReviewKind
  const id = String(url.searchParams.get('id') || '').trim()
  if (!id || !['track', 'beat', 'release-track'].includes(kind)) {
    return NextResponse.json({ error: 'A valid Editorial audio target is required.' }, { status: 400 })
  }

  try {
    let stored = ''
    let audioSource: ReviewAudioSource = 'full'

    if (kind === 'track') {
      const row = (await rows(`tracks?id=eq.${encodeURIComponent(id)}&select=id,file_url&limit=1`))[0]
      stored = String(row?.file_url || '')
    } else if (kind === 'beat') {
      // Prefer the private/full master. If the producer only uploaded the tagged
      // BeatStore preview, Editorial may still review that exact submitted file,
      // but the response marks it explicitly so the UI never presents it as a master.
      const row = (await rows(`beats?id=eq.${encodeURIComponent(id)}&select=id,master_path,preview_path&limit=1`))[0]
      const master = String(row?.master_path || '').trim()
      const preview = String(row?.preview_path || '').trim()
      stored = master || preview
      audioSource = master ? 'master' : 'preview'
    } else {
      const row = (await rows(`release_tracks?id=eq.${encodeURIComponent(id)}&select=id,file_url,audio_path&limit=1`))[0]
      stored = String(row?.file_url || row?.audio_path || '')
    }

    if (!stored) {
      return NextResponse.json({ error: 'Submission audio is not attached to this item.' }, { status: 404 })
    }

    const audioUrl = await signedReviewAudio(stored)
    if (!audioUrl) {
      return NextResponse.json({ error: 'Submission audio is unavailable.' }, { status: 404 })
    }
    return NextResponse.json({
      audioUrl,
      audioSource,
      previewFallback: kind === 'beat' && audioSource === 'preview',
      kind,
      id,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not open Editorial audio.' },
      { status: 500 },
    )
  }
}
