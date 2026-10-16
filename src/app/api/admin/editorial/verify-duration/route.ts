import { NextResponse } from 'next/server'
import { audit, can, editorialIdentity, editorialUrl, serviceHeaders } from '@/lib/editorial-server'

type TrackDurationRow = {
  id?: string
  duration_sec?: number | string | null
}

const MAX_TRACK_DURATION_SECONDS = 12 * 60 * 60

async function trackDuration(trackId: string): Promise<TrackDurationRow | null> {
  const response = await fetch(
    editorialUrl(`tracks?id=eq.${encodeURIComponent(trackId)}&select=id,duration_sec&limit=1`),
    { headers: serviceHeaders, cache: 'no-store' },
  )
  if (!response.ok) throw new Error(await response.text())
  const rows = await response.json().catch(() => [])
  return Array.isArray(rows) ? (rows[0] as TrackDurationRow | undefined) || null : null
}

function parsedDuration(value: unknown) {
  const seconds = Number(value)
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > MAX_TRACK_DURATION_SECONDS) return null
  return Math.max(1, Math.round(seconds))
}

async function identityWithRotationAccess(request: Request) {
  const identity = await editorialIdentity(request)
  if (!identity || !can(identity, 'manage_rotation')) return null
  return identity
}

export async function GET(request: Request) {
  const identity = await identityWithRotationAccess(request)
  if (!identity) return NextResponse.json({ error: 'Rotation access required.' }, { status: 403 })

  const trackId = new URL(request.url).searchParams.get('trackId')?.trim() || ''
  if (!trackId) return NextResponse.json({ error: 'Track is required.' }, { status: 400 })

  try {
    const track = await trackDuration(trackId)
    if (!track?.id) return NextResponse.json({ error: 'Track not found.' }, { status: 404 })
    const durationSec = parsedDuration(track.duration_sec)
    return NextResponse.json({ verified: Boolean(durationSec), durationSec })
  } catch (error) {
    console.error('Track duration lookup failed:', error)
    return NextResponse.json({ error: 'Could not check the track duration.' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const identity = await identityWithRotationAccess(request)
  if (!identity) return NextResponse.json({ error: 'Rotation access required.' }, { status: 403 })

  const body = await request.json().catch(() => ({})) as { trackId?: unknown; durationSec?: unknown }
  const trackId = String(body.trackId || '').trim()
  const measuredDuration = parsedDuration(body.durationSec)
  if (!trackId) return NextResponse.json({ error: 'Track is required.' }, { status: 400 })
  if (!measuredDuration) {
    return NextResponse.json({ error: 'BVS could not read a valid duration from this audio file.' }, { status: 400 })
  }

  try {
    const track = await trackDuration(trackId)
    if (!track?.id) return NextResponse.json({ error: 'Track not found.' }, { status: 404 })

    const existingDuration = parsedDuration(track.duration_sec)
    if (existingDuration) {
      return NextResponse.json({ verified: true, durationSec: existingDuration, repaired: false })
    }

    const response = await fetch(editorialUrl(`tracks?id=eq.${encodeURIComponent(trackId)}`), {
      method: 'PATCH',
      headers: { ...serviceHeaders, Prefer: 'return=representation' },
      body: JSON.stringify({ duration_sec: measuredDuration }),
    })
    if (!response.ok) throw new Error(await response.text())
    const rows = await response.json().catch(() => [])
    if (!Array.isArray(rows) || !rows[0]?.id) {
      return NextResponse.json({ error: 'Track duration could not be saved.' }, { status: 409 })
    }

    await audit(identity.user.id, 'track_duration_verified', 'track', trackId, {
      duration_sec: measuredDuration,
      source: 'editorial_browser_metadata',
    })

    return NextResponse.json({ verified: true, durationSec: measuredDuration, repaired: true })
  } catch (error) {
    console.error('Track duration repair failed:', error)
    return NextResponse.json({ error: 'Could not save the verified audio duration.' }, { status: 500 })
  }
}
