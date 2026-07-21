import { editorialUrl, serviceHeaders } from '@/lib/editorial-server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export type CommunityUser = { id: string; email?: string }

export async function communityUser(request: Request): Promise<CommunityUser | null> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token || !SUPABASE_URL || !SUPABASE_ANON_KEY) return null
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!response.ok) return null
  return response.json()
}

export async function communityJson<T>(path: string, fallback: T): Promise<T> {
  if (!serviceHeaders.apikey) return fallback
  const response = await fetch(editorialUrl(path), { headers: serviceHeaders, cache: 'no-store' })
  if (!response.ok) return fallback
  return response.json()
}

export async function communityAccess(userId: string) {
  const id = encodeURIComponent(userId)
  const [profiles, memberships, staff] = await Promise.all([
    communityJson<Array<{ username?: string; display_name?: string; avatar_url?: string; premium_active?: boolean; premium_until?: string | null }>>(
      `profiles?id=eq.${id}&select=username,display_name,avatar_url,premium_active,premium_until&limit=1`,
      [],
    ),
    communityJson<Array<{ tier: string; status: string; expires_at?: string | null }>>(
      `community_memberships?user_id=eq.${id}&select=tier,status,expires_at&limit=1`,
      [],
    ),
    communityJson<Array<{ role: string; active: boolean }>>(
      `editorial_staff?user_id=eq.${id}&active=eq.true&select=role,active&limit=1`,
      [],
    ),
  ])
  const profile = profiles[0] || null
  const membership = memberships[0]
  const membershipPremium = membership?.tier === 'premium' && membership.status === 'active'
    && (!membership.expires_at || new Date(membership.expires_at).getTime() > Date.now())
  // Artist premium (releases pipeline) and community_memberships both unlock chat posting.
  const profilePremium = Boolean(profile?.premium_active)
    && (!profile?.premium_until || new Date(profile.premium_until).getTime() > Date.now())
  const premium = membershipPremium || profilePremium
  return { profile, premium, staff: Boolean(staff[0]) }
}

export function communityUnavailable(error: unknown) {
  return error instanceof Error && /fetch|schema|relation/i.test(error.message)
}
