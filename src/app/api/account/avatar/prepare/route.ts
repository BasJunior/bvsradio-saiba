import { NextResponse } from 'next/server'
import { authUserId } from '@/lib/storage-upload'
import { r2Configured, r2MediaUrl, signedR2UploadUrl } from '@/lib/r2-storage'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export async function POST(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token || !url || !service) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
  if (!r2Configured()) return NextResponse.json({ error: 'Upload service unavailable.' }, { status: 503 })
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
  const contentType = String(body.type || '') || `image/${ext === 'jpg' ? 'jpeg' : ext}`
  const slot = { path, contentType, signedUrl: await signedR2UploadUrl(path, contentType) }
  return NextResponse.json({ provider: 'r2', slot, publicUrl: r2MediaUrl(path) })
}
