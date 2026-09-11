import { NextResponse } from 'next/server'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import {
  beatIdentity,
  ensureProducerFlag,
  isProducerCapable,
  loadProducerProfile,
} from '@/lib/beatstore-server'
import { r2Bucket, r2Client, r2Configured } from '@/lib/r2-storage'

export const runtime = 'nodejs'

const MAX_ARTWORK_BYTES = 8 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

function extOf(name: string) {
  return name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || ''
}

export async function POST(request: Request) {
  try {
    const identity = await beatIdentity(request)
    if (!identity?.user?.id) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })

    let profile = await loadProducerProfile(identity.user.id)
    if (!profile) return NextResponse.json({ error: 'Profile not found.' }, { status: 403 })
    profile = (await ensureProducerFlag(identity.user.id, profile)) as typeof profile
    if (!(await isProducerCapable(profile))) {
      return NextResponse.json({ error: 'Producer access required.' }, { status: 403 })
    }
    if (!r2Configured()) return NextResponse.json({ error: 'Upload service unavailable.' }, { status: 503 })

    const form = await request.formData()
    const path = String(form.get('path') || '')
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Cover artwork file is required.' }, { status: 400 })
    }

    const ext = extOf(file.name)
    const contentType = file.type || (ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext ? `image/${ext}` : '')
    if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext) || !ALLOWED_TYPES.has(contentType)) {
      return NextResponse.json({ error: 'Cover artwork must be JPG, PNG, or WebP.' }, { status: 400 })
    }
    if (file.size <= 0 || file.size > MAX_ARTWORK_BYTES) {
      return NextResponse.json({ error: 'Cover artwork must be 8MB or smaller.' }, { status: 400 })
    }
    if (!path.startsWith(`beats/${identity.user.id}/`) || !/-artwork\.(jpe?g|png|webp)$/i.test(path)) {
      return NextResponse.json({ error: 'Invalid cover artwork upload path.' }, { status: 400 })
    }

    await r2Client().send(new PutObjectCommand({
      Bucket: r2Bucket(),
      Key: path,
      Body: new Uint8Array(await file.arrayBuffer()),
      ContentType: contentType,
      CacheControl: 'private, max-age=3600',
    }))

    return NextResponse.json({ ok: true, path })
  } catch (error) {
    console.error('beat artwork upload failed', error)
    return NextResponse.json({ error: 'Could not upload cover artwork. Please retry.' }, { status: 500 })
  }
}
