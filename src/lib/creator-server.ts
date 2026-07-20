import 'server-only'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export const creatorHeaders = { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json' }
export const creatorUrl = (path: string) => `${url}/rest/v1/${path}`

export async function creatorIdentity(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token || !url || !service) return null
  const response = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anon || service, Authorization: `Bearer ${token}` }, cache: 'no-store' })
  if (!response.ok) return null
  const user = await response.json() as { id: string; email?: string; user_metadata?: Record<string, unknown> }
  const [profileResponse, staffResponse] = await Promise.all([
    fetch(creatorUrl(`profiles?id=eq.${user.id}&select=id,username,display_name,role`), { headers: creatorHeaders, cache: 'no-store' }),
    fetch(creatorUrl(`editorial_staff?user_id=eq.${user.id}&active=eq.true&select=role&limit=1`), { headers: creatorHeaders, cache: 'no-store' }),
  ])
  const profiles = profileResponse.ok ? await profileResponse.json() : []
  const staff = staffResponse.ok ? await staffResponse.json() : []
  const profile = profiles[0] as { id: string; username: string; display_name?: string; role: string } | undefined
  if (profile && (staff[0] || ['admin', 'editor'].includes(profile.role))) profile.role = 'admin'
  return { user, profile }
}

export async function creatorJson(response: Response) {
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(data?.message || data?.error || 'Creator workflow request failed.')
  return data
}
