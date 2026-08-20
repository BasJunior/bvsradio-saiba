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

function publicSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return url && key ? { url, key } : null
}

export async function getPublicShowEvent(programmeSlug: string): Promise<ShowEvent | null> {
  const supabase = publicSupabase()
  if (!supabase) return null
  try {
    const fields = 'id,programme_slug,title,starts_at,ends_at,status,room_id,live_video_url,replay_video_url,archive_published_at'
    const response = await fetch(
      `${supabase.url}/rest/v1/show_events?programme_slug=eq.${encodeURIComponent(programmeSlug)}&status=in.(scheduled,live,ended,archived)&select=${fields}&order=starts_at.desc&limit=1`,
      { headers: { apikey: supabase.key, Authorization: `Bearer ${supabase.key}` }, next: { revalidate: 30 } },
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
