import { NextResponse } from 'next/server'
import { isAllowedAudioFile } from '@/lib/audio-formats'
import {
  beatIdentity,
  ensureProducerFlag,
  isProducerCapable,
  loadProducerProfile,
} from '@/lib/beatstore-server'
import { r2Bucket, r2Configured, signedR2UploadUrl } from '@/lib/r2-storage'

export const runtime = 'nodejs'

type SlotInput = { name?: string; type?: string; size?: number }

function extOf(name: string) {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/)
  return m?.[1] || 'bin'
}

export async function POST(req: Request) {
  try {
    const identity = await beatIdentity(req)
    if (!identity?.user?.id) {
      return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
    }
    let profile = await loadProducerProfile(identity.user.id)
    if (!profile) return NextResponse.json({ error: 'Profile not found.' }, { status: 403 })
    profile = (await ensureProducerFlag(identity.user.id, profile)) as typeof profile
    if (!(await isProducerCapable(profile))) {
      return NextResponse.json({ error: 'Producer access required.' }, { status: 403 })
    }
    if (!r2Configured()) {
      return NextResponse.json({ error: 'Upload service unavailable.' }, { status: 503 })
    }

    const body = (await req.json().catch(() => ({}))) as {
      preview?: SlotInput
      master?: SlotInput
      artwork?: SlotInput
      stems?: SlotInput
    }

    const uid = identity.user.id
    const ts = Date.now()
    const slots: Record<string, { path: string; signedUrl: string; contentType: string } | null> = {
      preview: null,
      master: null,
      artwork: null,
      stems: null,
    }

    async function make(kind: 'preview' | 'master' | 'artwork' | 'stems', file?: SlotInput) {
      if (!file?.name) return null
      const name = String(file.name)
      if (kind === 'preview' || kind === 'master') {
        const check = isAllowedAudioFile({
          name,
          type: String(file.type || ''),
          size: Number(file.size || 0),
        })
        if (!check.ok) {
          throw new Error(check.error || `Unsupported ${kind} audio type. Use MP3/WAV/M4A/OGG.`)
        }
      }
      if (kind === 'artwork') {
        const ext = extOf(name)
        if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
          throw new Error('Artwork must be JPG, PNG, or WebP.')
        }
      }
      const ext = extOf(name)
      const path = `beats/${uid}/${ts}-${kind}.${ext}`
      const contentType = String(file?.type || '') || (kind === 'artwork' ? `image/${ext === 'jpg' ? 'jpeg' : ext}` : 'application/octet-stream')
      return {
        path,
        signedUrl: await signedR2UploadUrl(path, contentType),
        contentType,
      }
    }

    try {
      slots.preview = await make('preview', body.preview)
      slots.master = await make('master', body.master)
      slots.artwork = await make('artwork', body.artwork)
      slots.stems = await make('stems', body.stems)
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : 'Upload prepare failed.' },
        { status: 400 },
      )
    }

    if (!slots.preview && !slots.master && !slots.artwork && !slots.stems) {
      return NextResponse.json({ error: 'Provide at least one file to upload.' }, { status: 400 })
    }

    return NextResponse.json({
      ok: true,
      provider: 'r2',
      bucket: r2Bucket(),
      slots,
    })
  } catch (error) {
    console.error('beat upload prepare', error)
    return NextResponse.json({ error: 'Could not prepare beat uploads.' }, { status: 500 })
  }
}
