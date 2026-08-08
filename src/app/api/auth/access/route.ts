import { NextResponse } from 'next/server'
import { getArtistPremiumStatus } from '@/lib/premium-billing'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

function planLabel(planId: string | null | undefined): string | null {
  if (!planId) return null
  const id = planId.toLowerCase()
  if (id.includes('founding')) return 'Founding'
  if (id.includes('pro')) return 'Pro'
  if (id.includes('standard') || id.includes('artist')) return 'Standard'
  // Humanize snake/kebab without inventing product names
  const cleaned = planId.replace(/^artist[_-]?/i, '').replace(/[_-]+/g, ' ').trim()
  if (!cleaned) return 'Standard'
  return cleaned.replace(/\b\w/g, (c) => c.toUpperCase())
}

function primaryOwnerEmail(): string {
  return (process.env.BVS_PRIMARY_OWNER_EMAIL || '').trim().toLowerCase()
}

function isOwnerStaffRole(role: string | null | undefined): boolean {
  const r = String(role || '').toLowerCase()
  return r === 'founder' || r === 'owner' || r === 'administrator'
}

export async function GET(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token || !url || !anon || !service) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }
  const userResponse = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anon, Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!userResponse.ok) return NextResponse.json({ authenticated: false }, { status: 401 })
  const user = (await userResponse.json()) as { id: string; email?: string }
  const adminHeaders = { apikey: service, Authorization: `Bearer ${service}` }
  const [profileResponse, staffResponse, anyStaffResponse] = await Promise.all([
    fetch(`${url}/rest/v1/profiles?id=eq.${user.id}&select=role,is_producer`, {
      headers: adminHeaders,
      cache: 'no-store',
    }),
    fetch(
      `${url}/rest/v1/editorial_staff?user_id=eq.${user.id}&active=eq.true&select=role`,
      { headers: adminHeaders, cache: 'no-store' },
    ),
    fetch(`${url}/rest/v1/editorial_staff?select=user_id&limit=1`, {
      headers: adminHeaders,
      cache: 'no-store',
    }),
  ])
  const profiles = profileResponse.ok ? await profileResponse.json() : []
  const staff = staffResponse.ok ? await staffResponse.json() : []
  const anyStaff = anyStaffResponse.ok ? await anyStaffResponse.json() : []
  const profileRole = String(profiles[0]?.role || 'listener')
  const isProducerFlag = Boolean(profiles[0]?.is_producer)
  const staffRole = staff[0]?.role ? String(staff[0].role) : null
  const email = (user.email || '').toLowerCase().trim()
  // Source of truth: active editorial_staff owner/administrator. Bootstrap only if table empty.
  const staffTableEmpty = !Array.isArray(anyStaff) || anyStaff.length === 0
  const isOwner =
    isOwnerStaffRole(staffRole) ||
    (staffTableEmpty && Boolean(email) && email === primaryOwnerEmail())
  const isAdmin = isOwnerStaffRole(staffRole) || profileRole === 'admin' || Boolean(isOwner)
  const isEditorial =
    Boolean(staffRole) || ['editor', 'admin', 'moderator'].includes(profileRole) || Boolean(isOwner)
  const isArtist = profileRole === 'artist' || isAdmin
  // Wave A: artists + explicit is_producer + admins can use My BeatStore
  const isProducer = isProducerFlag || isAdmin
  // Creator Studio is available to every creator identity; only pure listeners are excluded.
  const isCreator = profileRole !== 'listener' || isProducerFlag || isEditorial

  let premiumActive = false
  let premiumUntil: string | null = null
  let premiumPlanId: string | null = null
  let premiumPlanLabel: string | null = null
  try {
    const premium = await getArtistPremiumStatus(user.id)
    premiumActive = Boolean(premium.premiumActive)
    premiumUntil = premium.premiumUntil || null
    premiumPlanId = premium.planId || null
    premiumPlanLabel = premiumActive ? planLabel(premium.planId) || 'Standard' : null
  } catch {
    // Premium lookup is best-effort; never block access payload.
  }

  return NextResponse.json({
    authenticated: true,
    email: user.email,
    profileRole,
    staffRole,
    premiumActive,
    premiumUntil,
    premiumPlanId,
    premiumPlanLabel,
    access: {
      listener: true,
      artist: isArtist,
      producer: isProducer,
      creator: isCreator,
      writer: profileRole === 'writer' || isEditorial,
      showCreator: profileRole === 'show_creator' || isEditorial,
      editorial: isEditorial,
      admin: isAdmin,
    },
  })
}
