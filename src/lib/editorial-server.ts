import 'server-only'
import { rolePermissions, type EditorialPermission, type EditorialRole } from '@/lib/editorial'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export const serviceHeaders = {
  apikey: service,
  Authorization: `Bearer ${service}`,
  'Content-Type': 'application/json',
}

/** Bootstrap owner when editorial_staff has zero rows (migration safety net). */
function primaryOwnerEmail(): string {
  return (process.env.BVS_PRIMARY_OWNER_EMAIL || '').trim().toLowerCase()
}

function isOwnerStaffRole(role: string | null | undefined): boolean {
  const r = String(role || '').toLowerCase()
  return r === 'founder' || r === 'owner' || r === 'administrator'
}

async function optionalJson(path: string): Promise<unknown[]> {
  if (!url || !service) return []
  try {
    const response = await fetch(`${url}/rest/v1/${path}`, {
      headers: serviceHeaders,
      cache: 'no-store',
    })
    if (!response.ok) return []
    const data = await response.json()
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

async function editorialStaffIsEmpty(): Promise<boolean> {
  const rows = await optionalJson('editorial_staff?select=user_id&limit=1')
  return rows.length === 0
}

function mapProfileRoleToStaff(profileRole: string | undefined): EditorialRole | null {
  const role = String(profileRole || '').toLowerCase()
  if (role === 'admin') return 'administrator'
  if (role === 'editor') return 'editor'
  if (role === 'moderator') return 'editor'
  return null
}

async function ensureAdministrator(userId: string) {
  // Promote profile + staff row so later checks stay consistent
  try {
    await fetch(`${url}/rest/v1/profiles?id=eq.${userId}`, {
      method: 'PATCH',
      headers: { ...serviceHeaders, Prefer: 'return=minimal' },
      body: JSON.stringify({ role: 'admin' }),
    })
  } catch {
    /* non-blocking */
  }
  try {
    await fetch(`${url}/rest/v1/editorial_staff?on_conflict=user_id`, {
      method: 'POST',
      headers: { ...serviceHeaders, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        user_id: userId,
        role: 'administrator',
        active: true,
        updated_at: new Date().toISOString(),
      }),
    })
  } catch {
    /* non-blocking — access still granted in-memory */
  }
}

export async function editorialIdentity(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token || !url || !service) return null

  const userResponse = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anon || service, Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!userResponse.ok) return null
  const user = (await userResponse.json()) as { id: string; email?: string }

  const [profileResponse, staffResponse] = await Promise.all([
    fetch(`${url}/rest/v1/profiles?id=eq.${user.id}&select=id,username,display_name,role`, {
      headers: serviceHeaders,
      cache: 'no-store',
    }),
    fetch(
      `${url}/rest/v1/editorial_staff?user_id=eq.${user.id}&active=eq.true&select=role`,
      { headers: serviceHeaders, cache: 'no-store' },
    ),
  ])

  const profiles = profileResponse.ok ? await profileResponse.json() : []
  const staff = staffResponse.ok ? await staffResponse.json() : []
  const profile = profiles?.[0] || null
  const email = (user.email || '').toLowerCase().trim()

  let role: EditorialRole | null = null

  // 1) Explicit staff assignment wins. Founder is distinct but has all admin permissions.
  const staffRoleRaw = staff?.[0]?.role ? String(staff[0].role) : null
  if (staffRoleRaw === 'founder') {
    role = 'founder'
  } else if (isOwnerStaffRole(staffRoleRaw)) {
    role = 'administrator'
  } else if (staffRoleRaw && rolePermissions[staffRoleRaw as EditorialRole]) {
    role = staffRoleRaw as EditorialRole
  }

  // 2) Profile role mapping (admin/editor)
  if (!role) {
    role = mapProfileRoleToStaff(profile?.role)
  }

  // 3) Bootstrap only when editorial_staff is empty — env primary owner, no hard-coded emails
  if (!role && email && primaryOwnerEmail() && email === primaryOwnerEmail()) {
    if (await editorialStaffIsEmpty()) {
      role = 'administrator'
      await ensureAdministrator(user.id)
    }
  }

  if (!role || !rolePermissions[role]) return null
  return { user, profile, role, permissions: rolePermissions[role] }
}

export function can(
  identity: NonNullable<Awaited<ReturnType<typeof editorialIdentity>>>,
  permission: EditorialPermission,
) {
  return identity.permissions.includes(permission)
}

export async function audit(
  actorId: string,
  action: string,
  entityType: string,
  entityId: string,
  details: Record<string, unknown> = {},
) {
  await fetch(`${url}/rest/v1/editorial_audit_log`, {
    method: 'POST',
    headers: serviceHeaders,
    body: JSON.stringify({
      actor_id: actorId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details,
    }),
  })
}

export function editorialUrl(path: string) {
  return `${url}/rest/v1/${path}`
}
