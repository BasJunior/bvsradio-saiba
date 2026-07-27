import { NextResponse } from 'next/server'
import { creatorIdentity } from '@/lib/creator-server'
import { isAllowedAudioFile } from '@/lib/audio-formats'
import { r2Configured, signedR2UploadUrl } from '@/lib/r2-storage'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const identity = await creatorIdentity(request)
  if (!identity?.profile || !['show_creator', 'admin'].includes(identity.profile.role)) {
    return NextResponse.json({ error: 'Show creator access required.' }, { status: identity ? 403 : 401 })
  }
  const body = await request.json().catch(() => ({})) as { name?: string; type?: string; size?: number }
  const check = isAllowedAudioFile({
    name: String(body.name || ''),
    type: String(body.type || ''),
    size: Number(body.size || 0),
    maxBytes: 250 * 1024 * 1024,
  })
  if (!check.ok) return NextResponse.json({ error: check.error || 'Use supported audio up to 250 MB.' }, { status: 400 })
  if (!r2Configured()) return NextResponse.json({ error: 'Upload service unavailable.' }, { status: 503 })
  const ext = String(body.name || '').toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || 'mp3'
  const path = `show-episodes/${identity.user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`
  const contentType = String(body.type || '') || (ext === 'mp3' ? 'audio/mpeg' : `audio/${ext}`)
  const slot = { path, contentType, signedUrl: await signedR2UploadUrl(path, contentType) }
  return NextResponse.json({ provider: 'r2', slot })
}
