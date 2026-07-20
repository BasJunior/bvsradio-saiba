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

/** Platform owner emails that should always get administrator access. */
function ownerEmails(): Set<string> {
  const fromEnv = [process.env.BVS_OWNER_EMAILS || '', process.env.BVS_ORDER_EMAIL || '']
    .join(',')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  // Known BVS owner accounts (Abias) — first-admin bootstrap when staff table is empty
  const known = ['abiaschivago@gmail.com', 'abiaschivayo3@gmail.com']
  return new Set([...fromEnv, ...known])
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

  // 1) Explicit staff assignment wins
  const staffRole = staff?.[0]?.role as EditorialRole | undefined
  if (staffRole && rolePermissions[staffRole]) {
    role = staffRole
  }

  // 2) Profile role mapping (admin/editor)
  if (!role) {
    role = mapProfileRoleToStaff(profile?.role)
  }

  // 3) Owner email bootstrap (fixes empty staff table / first login loop)
  if (!role && email && ownerEmails().has(email)) {
    role = 'administrator'
    // Persist during the request so serverless does not drop the write
    await ensureAdministrator(user.id)
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
