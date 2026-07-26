import { NextResponse } from 'next/server'
import { creatorIdentity } from '@/lib/creator-server'
import { isAllowedAudioFile } from '@/lib/audio-formats'
import { createSignedUploadSlot } from '@/lib/storage-upload'

export const runtime = 'nodejs'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const bucket = 'show-episodes'

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
  const ext = String(body.name || '').toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || 'mp3'
  const path = `${identity.user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`
  const slot = await createSignedUploadSlot(url, service, path, bucket)
  if (!slot) return NextResponse.json({ error: 'Could not prepare episode upload.' }, { status: 503 })
  return NextResponse.json({ bucket, slot })
}
