import { NextResponse } from 'next/server'
import { editorialIdentity, editorialUrl, serviceHeaders } from '@/lib/editorial-server'

type Row = Record<string, unknown>
type AnalyticsEvent = {
  event_name: string
  session_id?: string | null
  properties?: Record<string, unknown>
  created_at: string
}

async function rows(path: string): Promise<Row[]> {
  const response = await fetch(editorialUrl(path), {
    headers: serviceHeaders,
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`Analytics source unavailable: ${response.status}`)
  return response.json()
}

function dateKey(value: string) {
  return value.slice(0, 10)
}

function numberProperty(event: AnalyticsEvent, key: string) {
  const value = Number(event.properties?.[key])
  return Number.isFinite(value) ? value : 0
}

function percentChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 100
  return Math.round(((current - previous) / previous) * 1000) / 10
}

export async function GET(request: Request) {
  const identity = await editorialIdentity(request)
  if (!identity) return NextResponse.json({ error: 'Editorial access required' }, { status: 403 })

  const requestUrl = new URL(request.url)
  const requestedDays = Number(requestUrl.searchParams.get('days') || 30)
  const days = [7, 30, 90].includes(requestedDays) ? requestedDays : 30
  const now = new Date()
  const periodStart = new Date(now)
  periodStart.setUTCDate(periodStart.getUTCDate() - days + 1)
  periodStart.setUTCHours(0, 0, 0, 0)
  const previousStart = new Date(periodStart)
  previousStart.setUTCDate(previousStart.getUTCDate() - days)
  const periodStartIso = periodStart.toISOString()
  const previousStartIso = previousStart.toISOString()

  try {
    const [profiles, events, tracks, releases, requests] = await Promise.all([
      rows(`profiles?created_at=gte.${encodeURIComponent(previousStartIso)}&select=role,created_at&order=created_at.asc&limit=5000`),
      rows(`analytics_events?created_at=gte.${encodeURIComponent(periodStartIso)}&select=event_name,session_id,properties,created_at&order=created_at.asc&limit=20000`) as Promise<AnalyticsEvent[]>,
      rows('tracks?select=id,title,artist_name,genre,play_count,like_count,editorial_status,is_public,in_rotation,created_at&order=play_count.desc&limit=2000'),
      rows('releases?select=id,editorial_status,is_public,in_rotation,created_at&limit=2000'),
      rows('track_review_requests?select=id,status,created_at&limit=2000').catch(() => []),
    ])

    const currentProfiles = profiles.filter((profile) => String(profile.created_at) >= periodStartIso)
    const previousProfiles = profiles.filter((profile) => String(profile.created_at) < periodStartIso)
    const roleBreakdown = currentProfiles.reduce<Record<string, number>>((acc, profile) => {
      const role = String(profile.role || 'listener')
      acc[role] = (acc[role] || 0) + 1
      return acc
    }, {})

    const registrations = new Map<string, number>()
    for (let index = 0; index < days; index += 1) {
      const day = new Date(periodStart)
      day.setUTCDate(day.getUTCDate() + index)
      registrations.set(dateKey(day.toISOString()), 0)
    }
    currentProfiles.forEach((profile) => {
      const day = dateKey(String(profile.created_at))
      registrations.set(day, (registrations.get(day) || 0) + 1)
    })

    const countEvent = (name: string) => events.filter((event) => event.event_name === name).length
    const uniqueSessions = new Set(events.map((event) => event.session_id).filter(Boolean)).size
    const listeningMinutes = Math.round(
      events
        .filter((event) => event.event_name === 'listening_duration')
        .reduce((sum, event) => sum + numberProperty(event, 'seconds_bucket'), 0) / 60,
    )
    const playerStarts = countEvent('player_start')
    const playbackErrors = countEvent('playback_error')
    const checkoutStarts = countEvent('checkout_started')
    const paymentErrors = countEvent('payment_error')
    const checkoutCompletions = countEvent('checkout_complete')
    const canSeeCommerce = ['founder', 'administrator', 'commerce_manager'].includes(identity.role)

    const savedByTrack = events
      .filter((event) => event.event_name === 'track_save')
      .reduce<Record<string, number>>((acc, event) => {
        const id = String(event.properties?.track_id || '')
        if (id) acc[id] = (acc[id] || 0) + 1
        return acc
      }, {})
    const trackName = new Map(tracks.map((track) => [String(track.id), `${track.title} — ${track.artist_name}`]))
    const topSaved = Object.entries(savedByTrack)
      .map(([id, saves]) => ({ id, label: trackName.get(id) || 'Station track', saves }))
      .sort((a, b) => b.saves - a.saves)
      .slice(0, 5)
    const topPlayed = [...tracks]
      .filter((track) => Number(track.play_count || 0) > 0)
      .sort((a, b) => Number(b.play_count || 0) - Number(a.play_count || 0))
      .slice(0, 5)
      .map((track) => ({
        id: String(track.id),
        label: `${track.title} — ${track.artist_name}`,
        plays: Number(track.play_count || 0),
      }))
    const popularGenres = tracks.reduce<Record<string, number>>((acc, track) => {
      const genre = String(track.genre || 'Unspecified')
      acc[genre] = (acc[genre] || 0) + Number(track.play_count || 0)
      return acc
    }, {})

    const submitted = tracks.filter((track) => ['submitted', 'in_review'].includes(String(track.editorial_status))).length
      + releases.filter((release) => ['submitted', 'in_review'].includes(String(release.editorial_status))).length
    const published = tracks.filter((track) => track.is_public).length
      + releases.filter((release) => release.is_public).length

    return NextResponse.json({
      rangeDays: days,
      registrations: {
        total: currentProfiles.length,
        previousTotal: previousProfiles.length,
        growthPercent: percentChange(currentProfiles.length, previousProfiles.length),
        daily: Array.from(registrations, ([day, count]) => ({ day, count })),
        byRole: roleBreakdown,
      },
      activity: {
        uniqueSessions,
        playerStarts,
        listeningMinutes,
        uploads: countEvent('upload_complete'),
        trackSaves: countEvent('track_save'),
      },
      pipeline: {
        awaitingReview: submitted,
        published,
        inRotation: tracks.filter((track) => track.in_rotation).length
          + releases.filter((release) => release.in_rotation).length,
        openRequests: requests.filter((item) => ['open', 'reviewing'].includes(String(item.status))).length,
        publicationRate: tracks.length + releases.length
          ? Math.round((published / (tracks.length + releases.length)) * 100)
          : 0,
      },
      performance: {
        topPlayed,
        topSaved,
        popularGenres: Object.entries(popularGenres)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([genre, plays]) => ({ genre, plays })),
      },
      reliability: {
        playbackErrors,
        playbackErrorRate: playerStarts ? Math.round((playbackErrors / playerStarts) * 1000) / 10 : 0,
        ...(canSeeCommerce ? {
          checkoutStarts,
          checkoutCompletions,
          paymentErrors,
          paymentErrorRate: checkoutStarts ? Math.round((paymentErrors / checkoutStarts) * 1000) / 10 : 0,
        } : {}),
      },
      permissions: { commerce: canSeeCommerce },
    })
  } catch (error) {
    console.error('Editorial analytics failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Editorial analytics are temporarily unavailable.' }, { status: 503 })
  }
}
