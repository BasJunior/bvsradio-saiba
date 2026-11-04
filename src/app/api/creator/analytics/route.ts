import { NextResponse } from 'next/server'
import { creatorHeaders, creatorIdentity, creatorUrl } from '@/lib/creator-server'
import { r2KeyFromMediaUrl, safeR2Key, signedR2DownloadUrl } from '@/lib/r2-storage'

type Row = Record<string, unknown>
type EventRow = {
  event_name: string
  session_id?: string | null
  properties?: Record<string, unknown>
  created_at: string
}

async function privateMediaUrl(value?: string | null) {
  if (!value) return value
  const key = r2KeyFromMediaUrl(value) || (safeR2Key(value) && !/^https?:/i.test(value) ? value : null)
  return key ? signedR2DownloadUrl(key, 900) : value
}

async function rows(path: string): Promise<Row[]> {
  const response = await fetch(creatorUrl(path), { headers: creatorHeaders, cache: 'no-store' })
  if (!response.ok) throw new Error(`Creator insights source unavailable: ${response.status}`)
  return response.json()
}

function dayKey(value: string) {
  return value.slice(0, 10)
}

function percentChange(current: number, previous: number) {
  if (!previous) return current ? 100 : 0
  return Math.round(((current - previous) / previous) * 1000) / 10
}

function eventItemId(event: EventRow, legacyTrackIds: Map<string, string>) {
  const rawId = String(event.properties?.track_id || event.properties?.beat_id || '')
  return legacyTrackIds.get(rawId) || rawId
}

export async function GET(request: Request) {
  const identity = await creatorIdentity(request)
  if (!identity) return NextResponse.json({ error: 'Sign in to view creator insights.' }, { status: 401 })
  if (!identity.profile || (identity.profile.role === 'listener' && !identity.profile.is_producer)) {
    return NextResponse.json({ error: 'Creator access required.' }, { status: 403 })
  }

  const requestUrl = new URL(request.url)
  const requestedDays = Number(requestUrl.searchParams.get('days') || 30)
  const days = [7, 30, 90].includes(requestedDays) ? requestedDays : 30
  const now = new Date()
  const currentStart = new Date(now)
  currentStart.setUTCDate(currentStart.getUTCDate() - days + 1)
  currentStart.setUTCHours(0, 0, 0, 0)
  const previousStart = new Date(currentStart)
  previousStart.setUTCDate(previousStart.getUTCDate() - days)

  try {
    const userId = identity.user.id
    const [tracks, beats, events, requests] = await Promise.all([
      rows(`tracks?user_id=eq.${encodeURIComponent(userId)}&select=id,title,genre,file_url,artwork_url,editorial_status,is_public,in_rotation,play_count,like_count,created_at&limit=2000`),
      identity.profile.is_producer || identity.profile.role === 'admin'
        ? rows(`beats?producer_user_id=eq.${encodeURIComponent(userId)}&select=id,title,genre,status,is_public,artwork_path,created_at&limit=2000`).catch(() => [])
        : Promise.resolve([]),
      rows(`analytics_events?created_at=gte.${encodeURIComponent(previousStart.toISOString())}&select=event_name,session_id,properties,created_at&order=created_at.asc&limit=20000`) as Promise<EventRow[]>,
      rows(`track_review_requests?artist_user_id=eq.${encodeURIComponent(userId)}&select=id,status,created_at&limit=500`).catch(() => []),
    ])

    const ownedItems: Array<Row & { artwork: string | null | undefined }> = await Promise.all(
      ([...tracks, ...beats] as Row[]).map(async (item) => ({
      ...item,
      artwork: String(item.artwork_url || item.artwork_path || '')
        ? await privateMediaUrl(String(item.artwork_url || item.artwork_path))
        : null,
      })),
    )
    const ownedIds = new Set(ownedItems.map((item) => String(item.id)))
    const legacyTrackIds = new Map<string, string>(tracks.flatMap((track) => {
      const fileUrl = String(track.file_url || '')
      return fileUrl ? [[`rotation-${fileUrl}`, String(track.id)] as const] : []
    }))
    const labels = new Map(ownedItems.map((item) => [String(item.id), String(item.title || 'Untitled')]))
    const ownedEvents = events.filter((event) => ownedIds.has(eventItemId(event, legacyTrackIds)))
    const currentEvents = ownedEvents.filter((event) => event.created_at >= currentStart.toISOString())
    const previousEvents = ownedEvents.filter((event) => event.created_at < currentStart.toISOString())
    const plays = currentEvents.filter((event) => event.event_name === 'player_start')
    const premiumPlays = plays.filter((event) => event.properties?.premium_listener === true)
    const previousPlays = previousEvents.filter((event) => event.event_name === 'player_start')
    const saves = currentEvents.filter((event) => event.event_name === 'track_save')
    const durationEvents = currentEvents.filter((event) => event.event_name === 'listening_duration')
    const playbackErrors = currentEvents.filter((event) => event.event_name === 'playback_error').length
    const submissions = ownedItems.filter((item) => {
      const createdAt = String(item.created_at || '')
      return createdAt >= currentStart.toISOString() && createdAt <= now.toISOString()
    })
    const likes = tracks.reduce((sum, item) => sum + Number(item.like_count || 0), 0)
    const listeningMinutes = Math.round(durationEvents.reduce((sum, event) => {
      const seconds = Number(event.properties?.seconds_bucket)
      return sum + (Number.isFinite(seconds) ? seconds : 0)
    }, 0) / 60)

    const daily = new Map<string, { plays: number; premiumPlays: number; saves: number; minutes: number; submissions: number }>()
    for (let index = 0; index < days; index += 1) {
      const day = new Date(currentStart)
      day.setUTCDate(day.getUTCDate() + index)
      daily.set(dayKey(day.toISOString()), { plays: 0, premiumPlays: 0, saves: 0, minutes: 0, submissions: 0 })
    }
    currentEvents.forEach((event) => {
      const value = daily.get(dayKey(event.created_at))
      if (!value) return
      if (event.event_name === 'player_start') value.plays += 1
      if (event.event_name === 'player_start' && event.properties?.premium_listener === true) value.premiumPlays += 1
      if (event.event_name === 'track_save') value.saves += 1
      if (event.event_name === 'listening_duration') {
        const seconds = Number(event.properties?.seconds_bucket)
        value.minutes += Number.isFinite(seconds) ? seconds / 60 : 0
      }
    })
    submissions.forEach((item) => {
      const value = daily.get(dayKey(String(item.created_at)))
      if (value) value.submissions += 1
    })

    const itemPerformance = ownedItems.map((item) => {
      const id = String(item.id)
      const itemEvents = currentEvents.filter((event) => eventItemId(event, legacyTrackIds) === id)
      return {
        id,
        title: labels.get(id) || 'Untitled',
        kind: tracks.some((track) => String(track.id) === id) ? 'track' : 'beat',
        plays: itemEvents.filter((event) => event.event_name === 'player_start').length,
        saves: itemEvents.filter((event) => event.event_name === 'track_save').length,
        totalPlays: Number(item.play_count || 0),
        artwork: item.artwork,
        status: String(item.editorial_status || item.status || 'draft'),
        published: Boolean(item.is_public),
        inRotation: Boolean(item.in_rotation),
      }
    }).sort((a, b) => (b.plays - a.plays) || (b.totalPlays - a.totalPlays))

    const genres = ownedItems.reduce<Record<string, number>>((acc, item) => {
      const genre = String(item.genre || 'Unspecified')
      const id = String(item.id)
      const itemPlays = plays.filter((event) => eventItemId(event, legacyTrackIds) === id).length
      acc[genre] = (acc[genre] || 0) + itemPlays
      return acc
    }, {})

    return NextResponse.json({
      rangeDays: days,
      summary: {
        plays: plays.length,
        premiumPlays: premiumPlays.length,
        previousPlays: previousPlays.length,
        playGrowthPercent: percentChange(plays.length, previousPlays.length),
        uniqueSessions: new Set(plays.map((event) => event.session_id).filter(Boolean)).size,
        listeningMinutes,
        saves: saves.length,
        likes,
        submissions: submissions.length,
        saveRate: plays.length ? Math.round((saves.length / plays.length) * 1000) / 10 : 0,
        playbackErrors,
        playbackErrorRate: plays.length ? Math.round((playbackErrors / plays.length) * 1000) / 10 : 0,
      },
      catalogue: {
        uploads: tracks.length,
        beats: beats.length,
        lifetimePlays: tracks.reduce((sum, item) => sum + Number(item.play_count || 0), 0),
        published: ownedItems.filter((item) => item.is_public).length,
        inRotation: tracks.filter((track) => track.in_rotation).length,
        awaitingReview: ownedItems.filter((item) =>
          ['submitted', 'in_review', 'changes_requested'].includes(String(item.editorial_status || item.status)),
        ).length,
        openRequests: requests.filter((item) => ['open', 'reviewing'].includes(String(item.status))).length,
      },
      daily: Array.from(daily, ([day, values]) => ({
        day,
        plays: values.plays,
        premiumPlays: values.premiumPlays,
        saves: values.saves,
        minutes: Math.round(values.minutes * 10) / 10,
        submissions: values.submissions,
      })),
      topItems: itemPerformance.slice(0, 8),
      genres: Object.entries(genres)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([genre, playCount]) => ({ genre, plays: playCount })),
    })
  } catch (error) {
    console.error('Creator insights failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Creator insights are temporarily unavailable.' }, { status: 503 })
  }
}
