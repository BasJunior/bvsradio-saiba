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
} from '@/lib/beatstore-server'
import { ensureBeatArtworkPath } from '@/lib/beat-cover-autogen'
import { creatorPublicName } from '@/lib/public-name'
import { r2Configured } from '@/lib/r2-storage'
import { assertCanPublishLiveBeat } from '@/lib/producer-entitlements'

export const runtime = 'nodejs'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const beatId = cleanText(id, 80)
    if (!beatId) return NextResponse.json({ error: 'Missing beat id.' }, { status: 400 })

    const identity = await beatIdentity(request)
    if (!identity?.user?.id) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
    let profile = await loadProducerProfile(identity.user.id)
    if (!profile) return NextResponse.json({ error: 'Profile not found.' }, { status: 403 })
    profile = (await ensureProducerFlag(identity.user.id, profile)) as typeof profile
    if (!(await isProducerCapable(profile))) {
      return NextResponse.json({ error: 'Producer access required.' }, { status: 403 })
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const action = cleanText(body.action, 40) || 'update'
    const uid = identity.user.id

    if (action === 'message') {
      const message = cleanText(body.message, 2000)
      if (!message) return NextResponse.json({ error: 'Write a message first.' }, { status: 400 })
      const ownership = await fetch(
        beatUrl(`beats?id=eq.${encodeURIComponent(beatId)}&producer_user_id=eq.${uid}&select=id&limit=1`),
        { headers: beatHeaders, cache: 'no-store' },
      )
      const owned = ownership.ok ? await ownership.json() : []
      if (!owned?.[0]) return NextResponse.json({ error: 'Beat not found.' }, { status: 404 })
      const response = await fetch(beatUrl('beat_review_messages'), {
        method: 'POST',
        headers: { ...beatHeaders, Prefer: 'return=representation' },
        body: JSON.stringify({
          beat_id: beatId,
          author_user_id: uid,
          author_kind: 'producer',
          message,
        }),
      })
      if (!response.ok) {
        console.error('producer beat message failed', response.status, await response.text())
        return NextResponse.json({ error: 'Could not send message.' }, { status: 503 })
      }
      return NextResponse.json({ ok: true, message: (await response.json())[0] })
    }

    if (action === 'submit') {
      // Load current beat so we can fill missing artwork before submit.
      const currentRes = await fetch(
        beatUrl(
          `beats?id=eq.${encodeURIComponent(beatId)}&producer_user_id=eq.${uid}&status=in.(draft,changes_requested,rejected)&select=id,title,artwork_path&limit=1`,
        ),
        { headers: beatHeaders, cache: 'no-store' },
      )
      const currentRows = currentRes.ok ? await currentRes.json() : []
      const current = currentRows?.[0] as
        | { id: string; title?: string; artwork_path?: string | null }
        | undefined
      if (!current?.id) {
        return NextResponse.json(
          { error: 'Only draft / changes-requested / rejected beats can be submitted.' },
          { status: 409 },
        )
      }

      const patch: Record<string, unknown> = {
        status: 'submitted',
        is_public: false,
        updated_at: new Date().toISOString(),
      }
      let artworkGenerated = false
      if (!String(current.artwork_path || '').trim() && r2Configured()) {
        const producerLabel =
          creatorPublicName({
            publicName: (profile as { creator_public_name?: string }).creator_public_name,
            username: profile.username,
          }) ||
          profile.display_name ||
          profile.username ||
          'BVS producer'
        const ensured = await ensureBeatArtworkPath({
          producerUserId: uid,
          title: String(current.title || 'Untitled beat'),
          producerName: producerLabel,
          artworkPath: null,
        })
        if (ensured.path) {
          patch.artwork_path = ensured.path
          artworkGenerated = ensured.generated
        }
      }

      const res = await fetch(
        beatUrl(
          `beats?id=eq.${encodeURIComponent(beatId)}&producer_user_id=eq.${uid}&status=in.(draft,changes_requested,rejected)`,
        ),
        {
          method: 'PATCH',
          headers: { ...beatHeaders, Prefer: 'return=representation' },
          body: JSON.stringify(patch),
        },
      )
      const rows = res.ok ? await res.json() : []
      if (!rows?.[0]) {
        return NextResponse.json(
          { error: 'Only draft / changes-requested / rejected beats can be submitted.' },
          { status: 409 },
        )
      }
      return NextResponse.json({ ok: true, beat: rows[0], artworkGenerated })
    }

    if (body.is_public === true || String(body.status || '') === 'published') {
      const currentRes = await fetch(
        beatUrl(`beats?id=eq.${encodeURIComponent(beatId)}&producer_user_id=eq.${uid}&select=id,is_public,status&limit=1`),
        { headers: beatHeaders, cache: 'no-store' },
      )
      const current = currentRes.ok ? (await currentRes.json())[0] : null
      const alreadyLive = Boolean(current?.is_public) && String(current?.status) === 'published'
      const gate = await assertCanPublishLiveBeat({
        producerUserId: uid,
        beatId,
        alreadyLive,
      })
      if (!gate.ok) {
        return NextResponse.json({ error: gate.error, entitlements: gate.entitlements }, { status: 409 })
      }
    }

    // metadata + optional licence price update while editable
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.title !== undefined) patch.title = cleanText(body.title, 160)
    if (body.description !== undefined) patch.description = cleanText(body.description, 4000)
    if (body.genre !== undefined) patch.genre = cleanText(body.genre, 80)
    if (body.mood !== undefined) patch.mood = cleanText(body.mood, 120)
    if (body.bpm !== undefined) patch.bpm = Number(body.bpm) > 0 ? Math.round(Number(body.bpm)) : null
    if (body.musicalKey !== undefined) patch.musical_key = cleanText(body.musicalKey, 20) || null
    if (body.previewPath !== undefined) patch.preview_path = cleanText(body.previewPath, 500) || null
    if (body.masterPath !== undefined) patch.master_path = cleanText(body.masterPath, 500) || null
    if (body.artworkPath !== undefined) patch.artwork_path = cleanText(body.artworkPath, 500) || null
    if (body.stemsPath !== undefined) patch.stems_path = cleanText(body.stemsPath, 500) || null
    if (body.explicit !== undefined) patch.explicit = body.explicit === true

    const res = await fetch(
      beatUrl(
        `beats?id=eq.${encodeURIComponent(beatId)}&producer_user_id=eq.${uid}&status=in.(draft,changes_requested,rejected,submitted)`,
      ),
      {
        method: 'PATCH',
        headers: { ...beatHeaders, Prefer: 'return=representation' },
        body: JSON.stringify(patch),
      },
    )
    const rows = res.ok ? await res.json() : []
    if (!rows?.[0]) {
      return NextResponse.json({ error: 'Beat not editable in its current status.' }, { status: 409 })
    }

    if (body.priceUsd !== undefined) {
      const price = minBeatPrice(body.priceUsd)
      if (price === null) {
        return NextResponse.json({ error: 'Price must be at least $1 USD.' }, { status: 400 })
      }
      await fetch(
        beatUrl(
          `beat_licence_options?beat_id=eq.${encodeURIComponent(beatId)}&licence_code=eq.standard_lease`,
        ),
        {
          method: 'PATCH',
          headers: { ...beatHeaders, Prefer: 'return=minimal' },
          body: JSON.stringify({ price_usd: price, updated_at: new Date().toISOString() }),
        },
      )
    }

    return NextResponse.json({ ok: true, beat: rows[0] })
  } catch (error) {
    console.error('beat PATCH', error)
    return NextResponse.json({ error: 'Could not update beat.' }, { status: 500 })
  }
}
