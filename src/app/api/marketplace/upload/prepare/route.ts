import { NextResponse } from 'next/server'
import { creatorIdentity } from '@/lib/creator-server'
import { r2Configured, signedR2UploadUrl } from '@/lib/r2-storage'

export const runtime = 'nodejs'
const ext = (name: string) => name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || 'bin'

export async function POST(request: Request) {
  const identity = await creatorIdentity(request)
  if (!identity?.user?.id) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
  if (!r2Configured()) return NextResponse.json({ error: 'Upload service unavailable.' }, { status: 503 })
  const body = await request.json().catch(() => ({})) as { files?: Array<{ kind?: string; name?: string; type?: string; size?: number }> }
  const files = Array.isArray(body.files) ? body.files.slice(0, 3) : []
  const slots = []
  for (const file of files) {
    const kind = String(file.kind || '')
    const name = String(file.name || '')
    const size = Number(file.size || 0)
    if (!['asset','artwork','preview'].includes(kind) || !name || size <= 0 || size > 250 * 1024 * 1024) return NextResponse.json({ error: 'Invalid file. Marketplace files must be 250 MB or smaller.' }, { status: 400 })
    const extension = ext(name)
    if (kind === 'artwork' && !['jpg','jpeg','png','webp'].includes(extension)) return NextResponse.json({ error: 'Artwork must be JPG, PNG or WebP.' }, { status: 400 })
    const path = `marketplace/${identity.user.id}/${Date.now()}-${kind}-${crypto.randomUUID().slice(0, 6)}.${extension}`
    const contentType = String(file.type || '') || 'application/octet-stream'
    slots.push({ kind, path, contentType, signedUrl: await signedR2UploadUrl(path, contentType) })
  }
  return NextResponse.json({ slots })
}
