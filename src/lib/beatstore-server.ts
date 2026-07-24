import 'server-only'
import { creatorHeaders, creatorIdentity, creatorUrl } from '@/lib/creator-server'

export type BeatStatus =
  | 'draft'
  | 'submitted'
  | 'in_review'
  | 'changes_requested'
  | 'approved'
  | 'published'
  | 'rejected'
  | 'suspended'

export type BeatRow = {
  id: string
  producer_user_id: string
  title: string
  slug?: string | null
  description?: string
  genre?: string
  mood?: string
  bpm?: number | null
  musical_key?: string | null
  artwork_path?: string | null
  preview_path?: string | null
  master_path?: string | null
  stems_path?: string | null
  status: BeatStatus
  is_public: boolean
  is_featured?: boolean
  rights_confirmed?: boolean
  explicit?: boolean
  editorial_notes?: string | null
  created_at?: string
  updated_at?: string
  published_at?: string | null
}

export type BeatLicenceRow = {
  id: string
  beat_id: string
  licence_code: string
  licence_name: string
  price_usd: number
  currency: string
  included_files?: string[]
  is_active: boolean
  is_sold_out?: boolean
  terms_version?: string
  terms_summary?: string
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export const beatHeaders = creatorHeaders
export const beatUrl = creatorUrl

export function slugifyBeat(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}

export function cleanText(value: unknown, max = 2000) {
  return String(value || '')
    .trim()
    .slice(0, max)
}

export function publicStorageUrl(path?: string | null) {
  if (!path || !url) return null
  if (path.startsWith('http')) return path
  return `${url}/storage/v1/object/public/bvsradio-audio/${path}`
}

export async function beatIdentity(request: Request) {
  return creatorIdentity(request)
}

export async function isProducerCapable(profile?: {
  role?: string
  is_producer?: boolean
} | null) {
  if (!profile) return false
  if (profile.is_producer === true) return true
  const role = String(profile.role || '')
  return role === 'artist' || role === 'admin'
}

export async function loadProducerProfile(userId: string) {
  if (!url || !service) return null
  const res = await fetch(
    creatorUrl(
      `profiles?id=eq.${userId}&select=id,username,display_name,role,is_producer,is_published,is_verified`,
    ),
    { headers: creatorHeaders, cache: 'no-store' },
  )
  if (!res.ok) return null
  const rows = await res.json()
  return (rows?.[0] as {
    id: string
    username: string
    display_name?: string
    role: string
    is_producer?: boolean
    is_published?: boolean
    is_verified?: boolean
  }) || null
}

export async function ensureProducerFlag(userId: string, profile: { role?: string; is_producer?: boolean }) {
  if (profile.is_producer) return profile
  if (!['artist', 'admin'].includes(String(profile.role || ''))) return profile
  try {
    await fetch(creatorUrl(`profiles?id=eq.${userId}`), {
      method: 'PATCH',
      headers: { ...creatorHeaders, Prefer: 'return=minimal' },
      body: JSON.stringify({ is_producer: true }),
    })
    return { ...profile, is_producer: true }
  } catch {
    return profile
  }
}

export async function listBeatsForProducer(userId: string) {
  const res = await fetch(
    creatorUrl(
      `beats?producer_user_id=eq.${userId}&select=*,beat_licence_options(*)&order=created_at.desc`,
    ),
    { headers: creatorHeaders, cache: 'no-store' },
  )
  if (!res.ok) {
    // table may not exist yet
    return []
  }
  return (await res.json()) as Array<BeatRow & { beat_licence_options?: BeatLicenceRow[] }>
}

export async function listPublishedBeats(limit = 48) {
  const res = await fetch(
    creatorUrl(
      `beats?is_public=eq.true&status=eq.published&select=id,title,slug,description,genre,mood,bpm,musical_key,artwork_path,preview_path,producer_user_id,created_at,published_at,beat_licence_options!inner(id,licence_code,licence_name,price_usd,currency,is_active,is_sold_out)&beat_licence_options.is_active=eq.true&order=published_at.desc.nullslast,created_at.desc&limit=${limit}`,
    ),
    { headers: creatorHeaders, cache: 'no-store' },
  )
  if (!res.ok) return []
  return (await res.json()) as Array<
    BeatRow & { beat_licence_options?: BeatLicenceRow[] }
  >
}

export async function listSubmittedBeats(limit = 100) {
  const res = await fetch(
    creatorUrl(
      `beats?status=in.(submitted,in_review,changes_requested,approved,published,rejected)&select=*,beat_licence_options(*)&order=updated_at.desc&limit=${limit}`,
    ),
    { headers: creatorHeaders, cache: 'no-store' },
  )
  if (!res.ok) return []
  return (await res.json()) as Array<BeatRow & { beat_licence_options?: BeatLicenceRow[] }>
}

export function minBeatPrice(price: unknown) {
  const n = Number(price)
  if (!Number.isFinite(n)) return null
  if (n < 1) return null
  return Math.min(Math.round(n * 100) / 100, 9999)
}
