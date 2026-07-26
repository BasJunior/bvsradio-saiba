import { NextResponse } from 'next/server'
import { authUserId, createSignedUploadSlot, publicObjectUrl, storageBucket } from '@/lib/storage-upload'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export async function POST(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token || !url || !service) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
  const user = await authUserId(url, service, token)
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
  const body = await request.json().catch(() => ({})) as { name?: string; type?: string; size?: number }
  const name = String(body.name || '')
  const ext = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || ''
  if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
    return NextResponse.json({ error: 'Profile picture must be JPG, PNG, or WebP.' }, { status: 400 })
  }
  if (Number(body.size || 0) <= 0 || Number(body.size) > 8 * 1024 * 1024) {
    return NextResponse.json({ error: 'Profile picture must be smaller than 8 MB.' }, { status: 400 })
  }
  const path = `avatars/${user.id}/${Date.now()}.${ext}`
  const slot = await createSignedUploadSlot(url, service, path)
  if (!slot) return NextResponse.json({ error: 'Could not prepare profile-picture upload.' }, { status: 503 })
  return NextResponse.json({ bucket: storageBucket(), slot, publicUrl: publicObjectUrl(url, path) })
}
