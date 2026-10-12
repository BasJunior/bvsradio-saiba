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
import { licenceOptionSeed } from '@/lib/beat-licences'

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

type DraftPackRow = {
  id: string
  title: string
  description?: string
  genre?: string
  artwork_path?: string | null
  status: string
  created_at?: string
  updated_at?: string
}

type DraftBeatRow = {
  id: string
  pack_id?: string | null
  pack_position?: number | null
  title: string
  mood?: string
  bpm?: number | null
  musical_key?: string | null
  preview_path?: string | null
  master_path?: string | null
  rights_confirmed?: boolean
  beat_licence_options?: Array<{
    licence_code?: string
    price_usd?: number
    is_active?: boolean
  }>
}

async function requireProducer(request: Request) {
  const identity = await beatIdentity(request)
  if (!identity?.user?.id) {
    return { error: NextResponse.json({ error: 'Sign in required.' }, { status: 401 }) }
  }
  let profile = await loadProducerProfile(identity.user.id)
  if (!profile) {
    return { error: NextResponse.json({ error: 'Profile not found.' }, { status: 403 }) }
  }
  profile = (await ensureProducerFlag(identity.user.id, profile)) as typeof profile
  if (!(await isProducerCapable(profile))) {
    return { error: NextResponse.json({ error: 'Producer access required.' }, { status: 403 }) }
  }
  return { identity, profile }
}

export async function GET(request: Request) {
  try {
    const access = await requireProducer(request)
    if ('error' in access) return access.error
    const userId = access.identity.user.id

    const packsRes = await fetch(
      beatUrl(
        `beat_packs?producer_user_id=eq.${userId}&status=eq.draft&select=id,title,description,genre,artwork_path,status,created_at,updated_at&order=updated_at.desc&limit=50`,
      ),
      { headers: beatHeaders, cache: 'no-store' },
    )
    if (!packsRes.ok) {
      console.error('beat pack drafts load failed', packsRes.status, await packsRes.text().catch(() => ''))
      return NextResponse.json({ error: 'Could not load beat pack drafts.' }, { status: 503 })
    }

    const packs = (await packsRes.json()) as DraftPackRow[]
    if (!packs.length) return NextResponse.json({ drafts: [], count: 0 })

    const packIds = packs.map(pack => pack.id)
    const beatsRes = await fetch(
      beatUrl(
        `beats?producer_user_id=eq.${userId}&pack_id=in.(${packIds.join(',')})&select=id,pack_id,pack_position,title,mood,bpm,musical_key,preview_path,master_path,rights_confirmed,beat_licence_options(licence_code,price_usd,is_active)&order=pack_position.asc`,
      ),
      { headers: beatHeaders, cache: 'no-store' },
    )
    if (!beatsRes.ok) {
      console.error('beat pack draft items load failed', beatsRes.status, await beatsRes.text().catch(() => ''))
      return NextResponse.json({ error: 'Could not load beat pack draft items.' }, { status: 503 })
    }
    const beats = (await beatsRes.json()) as DraftBeatRow[]

    const drafts = packs.map(pack => {
      const items = beats
        .filter(beat => beat.pack_id === pack.id)
        .sort((a, b) => Number(a.pack_position || 0) - Number(b.pack_position || 0))
        .map(beat => {
          const licence = (beat.beat_licence_options || []).find(
            option => option.licence_code === 'standard_lease' && option.is_active !== false,
          ) || (beat.beat_licence_options || [])[0]
          return {
            id: beat.id,
            title: beat.title,
            mood: beat.mood || '',
            bpm: beat.bpm,
            musicalKey: beat.musical_key || '',
            priceUsd: Number(licence?.price_usd || 29),
            previewPath: beat.preview_path || null,
            masterPath: beat.master_path || null,
            rightsConfirmed: beat.rights_confirmed === true,
          }
        })
      return {
        id: pack.id,
        title: pack.title,
        description: pack.description || '',
        genre: pack.genre || 'Hip-Hop',
        artworkPath: pack.artwork_path || null,
        createdAt: pack.created_at || null,
        updatedAt: pack.updated_at || pack.created_at || null,
        rightsConfirmed: items.length > 0 && items.every(item => item.rightsConfirmed),
        items,
      }
    })

    return NextResponse.json({ drafts, count: drafts.length })
  } catch (error) {
    console.error('beat packs GET', error)
    return NextResponse.json({ error: 'Could not load beat pack drafts.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const access = await requireProducer(request)
    if ('error' in access) return access.error
    const identity = access.identity
    if (!r2Configured()) return NextResponse.json({ error: 'Media storage is unavailable.' }, { status: 503 })

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const title = cleanText(body.title, 160)
    const description = cleanText(body.description, 4000)
    const genre = cleanText(body.genre, 80)
    const artworkPath = cleanText(body.artworkPath, 500) || null
    const items = Array.isArray(body.items) ? (body.items as PackItem[]) : []
    const submit = body.submit === true
    const replacePackId = cleanText(body.replacePackId, 64) || null
    if (!title) return NextResponse.json({ error: 'Pack title is required.' }, { status: 400 })
    if (submit && body.rightsConfirmed !== true) return NextResponse.json({ error: 'Confirm rights before submitting.' }, { status: 400 })
    if (items.length < 2 || items.length > 20) {
      return NextResponse.json({ error: 'A beat pack must contain 2 to 20 beats.' }, { status: 400 })
    }

    if (replacePackId) {
      const existingRes = await fetch(
        beatUrl(
          `beat_packs?id=eq.${encodeURIComponent(replacePackId)}&producer_user_id=eq.${identity.user.id}&status=eq.draft&select=id&limit=1`,
        ),
        { headers: beatHeaders, cache: 'no-store' },
      )
      const existing = existingRes.ok ? await existingRes.json() as Array<{ id: string }> : []
      if (!existingRes.ok || !existing[0]?.id) {
        return NextResponse.json({ error: 'That beat pack draft could not be reopened. Refresh drafts and try again.' }, { status: 404 })
      }
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
    const licences = created.map((beat, index) => {
      const seed = licenceOptionSeed('standard_lease', normalized[index].price)
      return {
        beat_id: beat.id,
        licence_code: seed.licence_code,
        licence_name: seed.licence_name,
        price_usd: seed.price_usd,
        currency: seed.currency,
        included_files: seed.included_files,
        is_active: seed.is_active,
        terms_version: seed.terms_version,
        terms_summary: seed.terms_summary,
      }
    })
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

    let replaced = false
    if (replacePackId && replacePackId !== packId) {
      const hideOldBeats = await fetch(
        beatUrl(`beats?producer_user_id=eq.${identity.user.id}&pack_id=eq.${encodeURIComponent(replacePackId)}&status=eq.draft`),
        {
          method: 'PATCH',
          headers: { ...beatHeaders, Prefer: 'return=minimal' },
          body: JSON.stringify({ status: 'suspended', is_public: false, updated_at: new Date().toISOString() }),
        },
      )
      const hideOldPack = await fetch(
        beatUrl(`beat_packs?id=eq.${encodeURIComponent(replacePackId)}&producer_user_id=eq.${identity.user.id}&status=eq.draft`),
        {
          method: 'PATCH',
          headers: { ...beatHeaders, Prefer: 'return=minimal' },
          body: JSON.stringify({ status: 'suspended', is_public: false, updated_at: new Date().toISOString() }),
        },
      )
      if (hideOldBeats.ok && hideOldPack.ok) {
        const removeOldBeats = await fetch(
          beatUrl(`beats?producer_user_id=eq.${identity.user.id}&pack_id=eq.${encodeURIComponent(replacePackId)}&status=eq.suspended`),
          { method: 'DELETE', headers: beatHeaders },
        )
        const removeOldPack = await fetch(
          beatUrl(`beat_packs?id=eq.${encodeURIComponent(replacePackId)}&producer_user_id=eq.${identity.user.id}&status=eq.suspended`),
          { method: 'DELETE', headers: beatHeaders },
        )
        replaced = removeOldBeats.ok && removeOldPack.ok
        if (!replaced) {
          console.warn('beat pack draft replacement cleanup incomplete', replacePackId)
        }
      } else {
        console.warn('beat pack draft replacement could not hide old draft', replacePackId)
      }
    }

    return NextResponse.json({
      ok: true,
      packId,
      count: created.length,
      status: submit ? 'submitted' : 'draft',
      replacedDraft: Boolean(replacePackId),
      replacementCleanupComplete: replacePackId ? replaced : undefined,
    })
  } catch (error) {
    console.error('beat packs POST', error)
    return NextResponse.json({ error: 'Could not submit beat pack.' }, { status: 500 })
  }
}
