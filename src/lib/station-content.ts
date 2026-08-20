import 'server-only'
import { shows as fallbackShows, type Show } from '@/lib/station'
import type { ShowEvent, ShowEventStatus } from '@/lib/show-events'

type ProgrammeRow = { slug: string; title: string; tagline?: string; description?: string; image_url?: string; host: string; day_label: string; start_time?: string; timezone: string; status: 'scheduled' | 'active' }

function scheduleLabel(row: ProgrammeRow) {
  const time = row.start_time ? row.start_time.slice(0, 5) : 'Time TBA'
  const zone = row.timezone === 'Africa/Harare' ? 'CAT' : row.timezone
  return `${row.day_label} · ${time} ${zone}`
}

export async function getPublicProgrammes(): Promise<Show[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return fallbackShows
  try {
    const response = await fetch(`${url}/rest/v1/programmes?status=in.(scheduled,active)&select=*&order=day_label,start_time`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, next: { revalidate: 60 } })
    if (!response.ok) return fallbackShows
    const rows = await response.json() as ProgrammeRow[]
    if (!rows.length) return fallbackShows
    return rows.map(row => ({ slug: row.slug, title: row.title, tagline: row.tagline || '', description: row.description || '', image: row.image_url || '/images/editorial/radio-studio-harare.webp', host: row.host, schedule: scheduleLabel(row), status: row.status === 'active' ? 'active' : 'preview' }))
  } catch { return fallbackShows }
}

export async function getPublicProgramme(slug: string) {
  const programmes = await getPublicProgrammes()
  return programmes.find(programme => programme.slug === slug) || fallbackShows.find(programme => programme.slug === slug)
}

type ShowEventRow = {
  id: string
  programme_slug: string
  title: string
  starts_at?: string | null
  ends_at?: string | null
  status: ShowEventStatus
  room_id: string
  live_video_url?: string | null
  replay_video_url?: string | null
  archive_published_at?: string | null
}

export type PublicShowCreator = {
  id: string
  profileId?: string
  username?: string
  publicName: string
  role: string
  position: number
}

export type PublicShowSetlistItem = {
  id: string
  trackId?: string
  title: string
  artistName: string
  position: number
  playedAt?: string
}

export type PublicShowContext = {
  creators: PublicShowCreator[]
  setlist: PublicShowSetlistItem[]
}

function publicSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return url && key ? { url, key } : null
}

function publicHeaders(key: string) {
  return { apikey: key, Authorization: `Bearer ${key}` }
}

export async function getPublicShowEvent(programmeSlug: string): Promise<ShowEvent | null> {
  const supabase = publicSupabase()
  if (!supabase) return null
  try {
    const fields = 'id,programme_slug,title,starts_at,ends_at,status,room_id,live_video_url,replay_video_url,archive_published_at'
    const response = await fetch(
      `${supabase.url}/rest/v1/show_events?programme_slug=eq.${encodeURIComponent(programmeSlug)}&status=in.(scheduled,live,ended,archived)&select=${fields}&order=starts_at.desc&limit=1`,
      { headers: publicHeaders(supabase.key), next: { revalidate: 30 } },
    )
    if (!response.ok) return null
    const rows = await response.json() as ShowEventRow[]
    const row = rows[0]
    if (!row) return null
    return {
      id: row.id,
      programmeSlug: row.programme_slug,
      title: row.title,
      startsAt: row.starts_at || null,
      endsAt: row.ends_at || null,
      status: row.status,
      roomId: row.room_id,
      liveVideoUrl: row.live_video_url || null,
      replayVideoUrl: row.replay_video_url || null,
      archivePublishedAt: row.archive_published_at || null,
    }
  } catch {
    return null
  }
}

export async function getPublicShowContext(eventId: string): Promise<PublicShowContext> {
  const supabase = publicSupabase()
  if (!supabase || !eventId) return { creators: [], setlist: [] }
  const headers = publicHeaders(supabase.key)

  try {
    const [creatorsResponse, setlistResponse] = await Promise.all([
      fetch(
        `${supabase.url}/rest/v1/show_event_creators?event_id=eq.${encodeURIComponent(eventId)}&select=id,profile_id,public_name,role,position&order=position.asc`,
        { headers, next: { revalidate: 30 } },
      ),
      fetch(
        `${supabase.url}/rest/v1/show_setlist_items?event_id=eq.${encodeURIComponent(eventId)}&select=id,track_id,title,artist_name,position,played_at&order=position.asc`,
        { headers, next: { revalidate: 15 } },
      ),
    ])

    const creatorRows = creatorsResponse.ok
      ? await creatorsResponse.json() as Array<{ id: string; profile_id?: string | null; public_name: string; role: string; position?: number | null }>
      : []
    const setlistRows = setlistResponse.ok
      ? await setlistResponse.json() as Array<{ id: string; track_id?: string | null; title: string; artist_name: string; position?: number | null; played_at?: string | null }>
      : []

    const profileIds = [...new Set(creatorRows.map(row => row.profile_id).filter((value): value is string => Boolean(value)))]
    let usernames = new Map<string, string>()

    if (profileIds.length) {
      const profilesResponse = await fetch(
        `${supabase.url}/rest/v1/profiles?id=in.(${profileIds.join(',')})&is_published=eq.true&select=id,username`,
        { headers, next: { revalidate: 60 } },
      )
      if (profilesResponse.ok) {
        const profiles = await profilesResponse.json() as Array<{ id: string; username?: string | null }>
        usernames = new Map(profiles.filter(profile => profile.username).map(profile => [profile.id, String(profile.username)]))
      }
    }

    return {
      creators: creatorRows.map(row => ({
        id: row.id,
        profileId: row.profile_id || undefined,
        username: row.profile_id ? usernames.get(row.profile_id) : undefined,
        publicName: row.public_name,
        role: row.role,
        position: Number(row.position || 0),
      })),
      setlist: setlistRows.map(row => ({
        id: row.id,
        trackId: row.track_id || undefined,
        title: row.title,
        artistName: row.artist_name,
        position: Number(row.position || 0),
        playedAt: row.played_at || undefined,
      })),
    }
  } catch {
    return { creators: [], setlist: [] }
  }
}
