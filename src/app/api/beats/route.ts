import { NextResponse } from 'next/server'
import {
  beatHeaders,
  beatIdentity,
  beatUrl,
  cleanText,
  ensureProducerFlag,
  isProducerCapable,
  listBeatsForProducer,
  listPublishedBeats,
  loadProducerProfile,
  minBeatPrice,
  publicStorageUrl,
  slugifyBeat,
} from '@/lib/beatstore-server'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const scope = searchParams.get('scope') || 'public'

  if (scope === 'mine') {
    const identity = await beatIdentity(request)
    if (!identity?.user?.id) {
      return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
    }
    let profile = await loadProducerProfile(identity.user.id)
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found.' }, { status: 403 })
    }
    profile = (await ensureProducerFlag(identity.user.id, profile)) as typeof profile
    if (!(await isProducerCapable(profile))) {
      return NextResponse.json(
        { error: 'Producer access required. Use an artist account or ask BVS to enable BeatStore.' },
        { status: 403 },
      )
    }
    const beats = await listBeatsForProducer(identity.user.id)
    return NextResponse.json({ beats, profile })
  }

  // public published beats for catalogue / BeatStore
  const beats = await listPublishedBeats(60)
  const shaped = beats.map((b) => {
    const licences = (b.beat_licence_options || []).filter((l) => l.is_active !== false && !l.is_sold_out)
    const priced = licences
      .map((l) => Number(l.price_usd))
      .filter((n) => Number.isFinite(n) && n > 0)
    // Keep published beats visible even if licence row is missing/misconfigured
    const starting = priced.length ? Math.min(...priced) : 29
    return {
      id: b.id,
      title: b.title,
      slug: b.slug,
      description: b.description,
      genre: b.genre,
      mood: b.mood,
      bpm: b.bpm,
      musical_key: b.musical_key,
      producer_user_id: b.producer_user_id,
      artworkUrl: publicStorageUrl(b.artwork_path),
      previewUrl: publicStorageUrl(b.preview_path),
      startingPrice: starting,
      licences,
      published_at: b.published_at,
      created_at: b.created_at,
    }
  })
  return NextResponse.json({ beats: shaped, count: shaped.length })
}

export async function POST(request: Request) {
  try {
    const identity = await beatIdentity(request)
    if (!identity?.user?.id) {
      return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
    }
    let profile = await loadProducerProfile(identity.user.id)
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found.' }, { status: 403 })
    }
    profile = (await ensureProducerFlag(identity.user.id, profile)) as typeof profile
    if (!(await isProducerCapable(profile))) {
      return NextResponse.json(
        { error: 'Producer access required. Artist accounts can open My BeatStore.' },
        { status: 403 },
      )
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const title = cleanText(body.title, 160)
    if (!title) {
      return NextResponse.json({ error: 'Beat title is required.' }, { status: 400 })
    }
    const rightsConfirmed = body.rightsConfirmed === true
    if (!rightsConfirmed) {
      return NextResponse.json(
        { error: 'Confirm you own or control the rights to this beat.' },
        { status: 400 },
      )
    }

    const price = minBeatPrice(body.priceUsd)
    if (price === null) {
      return NextResponse.json(
        { error: 'Set a Standard lease price of at least $1 USD.' },
        { status: 400 },
      )
    }

    const submit = body.submit === true
    const slugBase = slugifyBeat(cleanText(body.slug, 80) || title) || `beat-${Date.now()}`
    const payload = {
      producer_user_id: identity.user.id,
      title,
      slug: `${slugBase}-${Math.random().toString(36).slice(2, 6)}`,
      description: cleanText(body.description, 4000),
      genre: cleanText(body.genre, 80),
      mood: cleanText(body.mood, 120),
      bpm: Number(body.bpm) > 0 ? Math.round(Number(body.bpm)) : null,
      musical_key: cleanText(body.musicalKey, 20) || null,
      artwork_path: cleanText(body.artworkPath, 500) || null,
      preview_path: cleanText(body.previewPath, 500) || null,
      master_path: cleanText(body.masterPath, 500) || null,
      stems_path: cleanText(body.stemsPath, 500) || null,
      rights_confirmed: true,
      explicit: body.explicit === true,
      status: submit ? 'submitted' : 'draft',
      is_public: false,
      updated_at: new Date().toISOString(),
    }

    if (submit && !payload.preview_path) {
      return NextResponse.json(
        { error: 'Upload a tagged preview audio before submitting for review.' },
        { status: 400 },
      )
    }

    const createRes = await fetch(beatUrl('beats'), {
      method: 'POST',
      headers: { ...beatHeaders, Prefer: 'return=representation' },
      body: JSON.stringify(payload),
    })
    const createdText = await createRes.text()
    if (!createRes.ok) {
      console.error('beat create failed', createRes.status, createdText)
      return NextResponse.json(
        {
          error:
            createRes.status === 404 || createdText.includes('beats')
              ? 'BeatStore tables are not ready. Run SQL pack 10-beatstore-mvp.sql in Supabase.'
              : 'Could not save beat. Try again.',
        },
        { status: 503 },
      )
    }
    const rows = JSON.parse(createdText || '[]') as Array<{ id: string }>
    const beat = rows[0]
    if (!beat?.id) {
      return NextResponse.json({ error: 'Beat create returned empty.' }, { status: 500 })
    }

    const licenceRes = await fetch(beatUrl('beat_licence_options'), {
      method: 'POST',
      headers: { ...beatHeaders, Prefer: 'return=representation' },
      body: JSON.stringify({
        beat_id: beat.id,
        licence_code: 'standard_lease',
        licence_name: 'Standard lease',
        price_usd: price,
        currency: 'usd',
        included_files: ['preview', 'master'],
        is_active: true,
        terms_version: 'mvp-v1',
        terms_summary:
          'Personal / non-exclusive lease. Full legal terms to be finalized by BVS; purchase will snapshot the version shown at checkout.',
      }),
    })
    if (!licenceRes.ok) {
      console.error('licence create failed', await licenceRes.text())
    }

    return NextResponse.json({ ok: true, beatId: beat.id, status: payload.status })
  } catch (error) {
    console.error('beats POST', error)
    return NextResponse.json({ error: 'Could not save beat.' }, { status: 500 })
  }
}
