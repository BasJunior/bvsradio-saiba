import 'server-only'
import { shows as fallbackShows, type Show } from '@/lib/station'

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
