import { NextResponse } from 'next/server'
import { creatorIdentity } from '@/lib/creator-server'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const allowed = new Set(['audio/mpeg','audio/mp3','audio/mp4','audio/wav','audio/x-wav','audio/ogg','audio/flac','audio/x-m4a','audio/aac','audio/opus'])

export async function POST(request: Request) {
  const identity = await creatorIdentity(request)
  if (!identity || !identity.profile || !['show_creator','admin'].includes(identity.profile.role)) return NextResponse.json({ error: 'Show creator access required.' }, { status: identity ? 403 : 401 })
  const form = await request.formData(); const file = form.get('audio')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Choose an audio file.' }, { status: 400 })
  if (!allowed.has(file.type) || file.size > 250 * 1024 * 1024) return NextResponse.json({ error: 'Use MP3, M4A, WAV or OGG audio up to 250MB.' }, { status: 400 })
  const ext = (file.name.split('.').pop() || 'mp3').toLowerCase().replace(/[^a-z0-9]/g, '')
  const path = `${identity.user.id}/${crypto.randomUUID()}.${ext}`
  const response = await fetch(`${url}/storage/v1/object/show-episodes/${path}`, { method: 'POST', headers: { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': file.type, 'x-upsert': 'false' }, body: file })
  if (!response.ok) { console.error('Episode upload failed', await response.text()); return NextResponse.json({ error: 'BVS could not store this episode. Try again or contact support.' }, { status: 500 }) }
  return NextResponse.json({ audioPath: path })
}
