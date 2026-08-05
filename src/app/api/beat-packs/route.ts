import { NextResponse } from 'next/server'
import {
  beatHeaders,
  beatIdentity,
  beatUrl,
  cleanText,
  ensureProducerFlag,
  isProducerCapable,
  loadProducerProfile,
  minBeatPrice,
  slugifyBeat,
} from '@/lib/beatstore-server'
import { r2Configured, r2ObjectExists } from '@/lib/r2-storage'

export const runtime = 'nodejs'

type PackItem = {
  title?: unknown
  description?: unknown
  mood?: unknown
  bpm?: unknown
  musicalKey?: unknown
  priceUsd?: unknown
  previewPath?: unknown
  masterPath?: unknown
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
    if (!r2Configured()) return NextResponse.json({ error: 'Media storage is unavailable.' }, { status: 503 })

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const title = cleanText(body.title, 160)
    const description = cleanText(body.description, 4000)
    const genre = cleanText(body.genre, 80)
    const artworkPath = cleanText(body.artworkPath, 500) || null
    const items = Array.isArray(body.items) ? (body.items as PackItem[]) : []
    const submit = body.submit === true
    if (!title) return NextResponse.json({ error: 'Pack title is required.' }, { status: 400 })
    if (submit && body.rightsConfirmed !== true) return NextResponse.json({ error: 'Confirm rights before submitting.' }, { status: 400 })
    if (items.length < 2 || items.length > 20) {
      return NextResponse.json({ error: 'A beat pack must contain 2 to 20 beats.' }, { status: 400 })
    }

    const normalized = items.map((item, index) => ({
      title: cleanText(item.title, 160),
      description: cleanText(item.description, 2000),
      mood: cleanText(item.mood, 120),
      bpm: Number(item.bpm) > 0 ? Math.round(Number(item.bpm)) : null,
      musicalKey: cleanText(item.musicalKey, 20) || null,
      price: minBeatPrice(item.priceUsd),
      previewPath: cleanText(item.previewPath, 500),
      masterPath: cleanText(item.masterPath, 500) || null,
      position: index + 1,
    }))
    if (normalized.some(item => !item.title || item.price === null)) {
      return NextResponse.json({ error: 'Every beat needs a title and price of at least $1.' }, { status: 400 })
    }
    if (submit && normalized.some(item => !item.previewPath)) {
      return NextResponse.json({ error: 'Every beat needs a tagged preview before submission.' }, { status: 400 })
    }
    const paths = [artworkPath, ...normalized.flatMap(item => [item.previewPath, item.masterPath])]
      .filter((path): path is string => Boolean(path))
    if (paths.some(path => !path.startsWith(`beats/${identity.user.id}/`))) {
      return NextResponse.json({ error: 'Invalid beat pack upload path.' }, { status: 400 })
    }
    const exists = await Promise.all(paths.map(path => r2ObjectExists(path)))
    if (exists.some(value => !value)) {
      return NextResponse.json({ error: 'One or more pack files did not finish uploading. Please retry.' }, { status: 400 })
    }

    const packRes = await fetch(beatUrl('beat_packs'), {
      method: 'POST',
      headers: { ...beatHeaders, Prefer: 'return=representation' },
      body: JSON.stringify({
        producer_user_id: identity.user.id,
        title,
        description,
        genre,
        artwork_path: artworkPath,
        status: submit ? 'submitted' : 'draft',
        is_public: false,
      }),
    })
    const packText = await packRes.text()
    if (!packRes.ok) {
      console.error('beat pack create failed', packRes.status, packText)
      return NextResponse.json({ error: 'Could not create the beat pack. Try again.' }, { status: 503 })
    }
    const packId = (JSON.parse(packText || '[]') as Array<{ id?: string }>)[0]?.id
    if (!packId) return NextResponse.json({ error: 'Beat pack create returned empty.' }, { status: 500 })

    const nonce = Math.random().toString(36).slice(2, 7)
    const beatPayload = normalized.map(item => ({
      producer_user_id: identity.user.id,
      pack_id: packId,
      pack_position: item.position,
      title: item.title,
      slug: `${slugifyBeat(item.title) || 'beat'}-${nonce}-${item.position}`,
      description: item.description,
      genre,
      mood: item.mood,
      bpm: item.bpm,
      musical_key: item.musicalKey,
      artwork_path: artworkPath,
      preview_path: item.previewPath,
      master_path: item.masterPath,
      rights_confirmed: body.rightsConfirmed === true,
      status: submit ? 'submitted' : 'draft',
      is_public: false,
    }))
    const beatsRes = await fetch(beatUrl('beats'), {
      method: 'POST',
      headers: { ...beatHeaders, Prefer: 'return=representation' },
      body: JSON.stringify(beatPayload),
    })
    const beatsText = await beatsRes.text()
    if (!beatsRes.ok) {
      console.error('beat pack items create failed', beatsRes.status, beatsText)
      await fetch(beatUrl(`beat_packs?id=eq.${packId}`), { method: 'DELETE', headers: beatHeaders })
      return NextResponse.json({ error: 'Could not register the beats in this pack.' }, { status: 503 })
    }
    const created = JSON.parse(beatsText || '[]') as Array<{ id: string }>
    const licences = created.map((beat, index) => ({
      beat_id: beat.id,
      licence_code: 'standard_lease',
      licence_name: 'Standard lease',
      price_usd: normalized[index].price,
      currency: 'usd',
      included_files: ['preview', 'master'],
      is_active: true,
      terms_version: 'mvp-v1',
      terms_summary: 'Personal / non-exclusive lease. Full legal terms are finalized by BVS before purchase.',
    }))
    const licenceRes = await fetch(beatUrl('beat_licence_options'), {
      method: 'POST',
      headers: { ...beatHeaders, Prefer: 'return=minimal' },
      body: JSON.stringify(licences),
    })
    if (!licenceRes.ok) {
      console.error('beat pack licences create failed', licenceRes.status, await licenceRes.text())
      await fetch(beatUrl(`beats?pack_id=eq.${packId}`), { method: 'DELETE', headers: beatHeaders })
      await fetch(beatUrl(`beat_packs?id=eq.${packId}`), { method: 'DELETE', headers: beatHeaders })
      return NextResponse.json({ error: 'Could not create lease prices for this pack. Please retry.' }, { status: 503 })
    }

    return NextResponse.json({ ok: true, packId, count: created.length, status: submit ? 'submitted' : 'draft' })
  } catch (error) {
    console.error('beat packs POST', error)
    return NextResponse.json({ error: 'Could not submit beat pack.' }, { status: 500 })
  }
}
