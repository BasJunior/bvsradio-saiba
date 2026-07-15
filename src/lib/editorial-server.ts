import 'server-only'
import { rolePermissions, type EditorialPermission, type EditorialRole } from '@/lib/editorial'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export const serviceHeaders = { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json' }

export async function editorialIdentity(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token || !url || !service) return null
  const userResponse = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anon || service, Authorization: `Bearer ${token}` }, cache: 'no-store' })
  if (!userResponse.ok) return null
  const user = await userResponse.json() as { id: string; email?: string }
  const [profileResponse, staffResponse] = await Promise.all([
    fetch(`${url}/rest/v1/profiles?id=eq.${user.id}&select=id,username,display_name,role`, { headers: serviceHeaders, cache: 'no-store' }),
    fetch(`${url}/rest/v1/editorial_staff?user_id=eq.${user.id}&active=eq.true&select=role`, { headers: serviceHeaders, cache: 'no-store' }),
  ])
  const profiles = profileResponse.ok ? await profileResponse.json() : []
  const staff = staffResponse.ok ? await staffResponse.json() : []
  const role = (staff[0]?.role || (profiles[0]?.role === 'admin' ? 'administrator' : null)) as EditorialRole | null
  if (!role || !rolePermissions[role]) return null
  return { user, profile: profiles[0] || null, role, permissions: rolePermissions[role] }
}

export function can(identity: NonNullable<Awaited<ReturnType<typeof editorialIdentity>>>, permission: EditorialPermission) {
  return identity.permissions.includes(permission)
}

export async function audit(actorId: string, action: string, entityType: string, entityId: string, details: Record<string, unknown> = {}) {
  await fetch(`${url}/rest/v1/editorial_audit_log`, { method: 'POST', headers: serviceHeaders, body: JSON.stringify({ actor_id: actorId, action, entity_type: entityType, entity_id: entityId, details }) })
}

export function editorialUrl(path: string) { return `${url}/rest/v1/${path}` }
