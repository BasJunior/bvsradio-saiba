import { NextResponse } from 'next/server'
import { editorialIdentity, editorialUrl, serviceHeaders } from '@/lib/editorial-server'
import { r2KeyFromMediaUrl, safeR2Key, signedR2DownloadUrl } from '@/lib/r2-storage'

type ReviewKind = 'track' | 'beat' | 'release-track'
type JsonRow = Record<string, unknown>

async function rows(path: string): Promise<JsonRow[]> {
  const response = await fetch(editorialUrl(path), { headers: serviceHeaders, cache: 'no-store' })
  if (!response.ok) throw new Error(await response.text())
  const body = await response.json()
  return Array.isArray(body) ? body as JsonRow[] : []
}

async function signedFullAudio(value: unknown) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const key = r2KeyFromMediaUrl(raw) || (safeR2Key(raw) && !/^https?:/i.test(raw) ? raw : null)
  return key ? signedR2DownloadUrl(key, 900) : raw
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
    if (kind === 'track') {
      const row = (await rows(`tracks?id=eq.${encodeURIComponent(id)}&select=id,file_url&limit=1`))[0]
      stored = String(row?.file_url || '')
    } else if (kind === 'beat') {
      // Editorial must review the submitted master. Never substitute the public/clipped preview.
      const row = (await rows(`beats?id=eq.${encodeURIComponent(id)}&select=id,master_path&limit=1`))[0]
      stored = String(row?.master_path || '')
    } else {
      const row = (await rows(`release_tracks?id=eq.${encodeURIComponent(id)}&select=id,file_url,audio_path&limit=1`))[0]
      stored = String(row?.file_url || row?.audio_path || '')
    }

    if (!stored) {
      return NextResponse.json({ error: 'Full submission audio is not attached to this item.' }, { status: 404 })
    }

    const audioUrl = await signedFullAudio(stored)
    if (!audioUrl) {
      return NextResponse.json({ error: 'Full submission audio is unavailable.' }, { status: 404 })
    }
    return NextResponse.json({ audioUrl, kind, id })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not open full Editorial audio.' },
      { status: 500 },
    )
  }
}
