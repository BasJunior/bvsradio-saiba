import { NextResponse } from 'next/server'
import { mediaUrlForStoredValue } from '@/lib/media-url'
import {
  isArtistNameCapable,
  isProducerNameCapable,
  PRODUCER_NAME_USE_ARTIST,
} from '@/lib/creator-entitlements'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const serviceHeaders = {
  apikey: service,
  Authorization: `Bearer ${service}`,
  'Content-Type': 'application/json',
}

async function accountUser(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token || !url || !anon || !service) return null
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anon, Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!response.ok) return null
  return response.json() as Promise<{
    id: string
    email?: string
    created_at?: string
    user_metadata?: Record<string, unknown>
  }>
}

export async function GET(request: Request) {
  const user = await accountUser(request)
  if (!user) return NextResponse.json({ error: 'Sign in to open Account Centre.' }, { status: 401 })

  const [profileResponse, ordersResponse] = await Promise.all([
    fetch(
      `${url}/rest/v1/profiles?id=eq.${user.id}&select=id,username,display_name,avatar_url,bio,role,is_producer,is_verified,is_published,creator_public_name,creator_name_request,creator_name_status,creator_name_review_notes,producer_public_name,producer_name_request,producer_name_status,producer_name_review_notes,created_at&limit=1`,
      { headers: serviceHeaders, cache: 'no-store' },
    ),
    fetch(
      `${url}/rest/v1/orders?customer_user_id=eq.${user.id}&select=reference,status,delivery_status,total,payment_method,items,created_at&order=created_at.desc&limit=30`,
      { headers: serviceHeaders, cache: 'no-store' },
    ),
  ])
  const profiles = profileResponse.ok ? await profileResponse.json() : []
  const orders = ordersResponse.ok ? await ordersResponse.json() : []
  const profile = profiles[0] || null
  let displayAvatarUrl = mediaUrlForStoredValue(profile?.avatar_url) || profile?.avatar_url || ''
  if (!displayAvatarUrl || displayAvatarUrl.includes('default-avatar')) {
    const [trackArtworkResponse, beatArtworkResponse] = await Promise.all([
      fetch(`${url}/rest/v1/tracks?user_id=eq.${user.id}&artwork_url=not.is.null&select=artwork_url&order=created_at.desc&limit=1`, { headers: serviceHeaders, cache: 'no-store' }),
      fetch(`${url}/rest/v1/beats?producer_user_id=eq.${user.id}&artwork_path=not.is.null&select=artwork_path&order=created_at.desc&limit=1`, { headers: serviceHeaders, cache: 'no-store' }),
    ])
    const trackArtwork = trackArtworkResponse.ok ? (await trackArtworkResponse.json())[0]?.artwork_url : null
    const beatArtworkPath = beatArtworkResponse.ok ? (await beatArtworkResponse.json())[0]?.artwork_path : null
    displayAvatarUrl = mediaUrlForStoredValue(trackArtwork) || mediaUrlForStoredValue(beatArtworkPath) || displayAvatarUrl
  }
  return NextResponse.json({
    user: {
      email: user.email || '',
      createdAt: user.created_at || null,
      fullName: String(user.user_metadata?.full_name || ''),
    },
    profile: profile ? { ...profile, display_avatar_url: displayAvatarUrl } : null,
    orders,
  })
}

export async function PATCH(request: Request) {
  const user = await accountUser(request)
  if (!user) return NextResponse.json({ error: 'Sign in to update your account.' }, { status: 401 })
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const requestedUsername = String(body.username || '').trim().toLowerCase().slice(0, 50)
  const displayName = String(body.displayName || '').trim().slice(0, 100)
  const fullName = String(body.fullName || '').trim().slice(0, 160)
  const bio = String(body.bio || '').trim().slice(0, 1000)
  const avatarUrl = String(body.avatarUrl || '').trim().slice(0, 500)
  const creatorNameRequest = String(body.creatorPublicName || body.artistPublicName || '').trim().slice(0, 120)
  const producerNameRaw = String(body.producerPublicName || '').trim().slice(0, 120)
  const useArtistForProducer =
    body.useArtistNameForProducer === true ||
    producerNameRaw === PRODUCER_NAME_USE_ARTIST ||
    body.clearProducerPublicName === true

  const existingResponse = await fetch(
    `${url}/rest/v1/profiles?id=eq.${user.id}&select=id,username,role,is_producer,creator_public_name,creator_name_request,creator_name_status,producer_public_name,producer_name_request,producer_name_status&limit=1`,
    { headers: serviceHeaders, cache: 'no-store' },
  )
  const existingRows = existingResponse.ok ? await existingResponse.json() : []
  const existing = existingRows[0] as {
    username?: string
    role?: string
    is_producer?: boolean
    creator_public_name?: string
    creator_name_request?: string
    creator_name_status?: string
    producer_public_name?: string
    producer_name_request?: string
    producer_name_status?: string
  } | undefined
  if (!existing) {
    return NextResponse.json({ error: 'Your profile could not be loaded.' }, { status: 404 })
  }
  const username = String(existing.username || '').trim().toLowerCase()
  if (!/^[a-z0-9][a-z0-9._-]{2,49}$/.test(username)) {
    return NextResponse.json(
      { error: 'Your existing username needs staff review before this profile can be updated.' },
      { status: 400 },
    )
  }
  if (requestedUsername && requestedUsername !== username) {
    return NextResponse.json(
      { error: 'Usernames are permanent profile handles. Contact BVS if yours needs correcting.' },
      { status: 409 },
    )
  }
  if (!displayName) return NextResponse.json({ error: 'Display name is required.' }, { status: 400 })
  if (!fullName) return NextResponse.json({ error: 'Full/legal name is required and remains private.' }, { status: 400 })

  // Same resolver as Account UI + /api/auth/access (admin inherits both).
  const artistCapable = isArtistNameCapable(existing)
  const producerCapable = isProducerNameCapable(existing)
  const creatorNameChanged =
    artistCapable &&
    creatorNameRequest.length > 0 &&
    creatorNameRequest !== String(existing.creator_name_request || '') &&
    creatorNameRequest !== String(existing.creator_public_name || '')
  const producerNameRequest = useArtistForProducer ? PRODUCER_NAME_USE_ARTIST : producerNameRaw
  const hasSeparateProducerName = Boolean(String(existing.producer_public_name || '').trim())
  const producerNameChanged =
    producerCapable &&
    (
      (useArtistForProducer &&
        (hasSeparateProducerName || String(existing.producer_name_request || '') !== PRODUCER_NAME_USE_ARTIST)) ||
      (!useArtistForProducer &&
        producerNameRequest.length > 0 &&
        producerNameRequest !== String(existing.producer_name_request || '') &&
        producerNameRequest !== String(existing.producer_public_name || ''))
    )

  const profilePatch: Record<string, unknown> = {
    username,
    display_name: displayName,
    bio,
    avatar_url: avatarUrl || '/assets/images/default-avatar.png',
    updated_at: new Date().toISOString(),
  }
  if (creatorNameChanged) {
    profilePatch.creator_name_request = creatorNameRequest
    profilePatch.creator_name_status = 'pending'
    profilePatch.creator_name_review_notes = null
    profilePatch.creator_name_reviewed_by = null
    profilePatch.creator_name_reviewed_at = null
  }
  if (producerNameChanged) {
    profilePatch.producer_name_request = producerNameRequest
    profilePatch.producer_name_status = 'pending'
    profilePatch.producer_name_review_notes = null
    profilePatch.producer_name_reviewed_by = null
    profilePatch.producer_name_reviewed_at = null
  }

  const response = await fetch(`${url}/rest/v1/profiles?id=eq.${user.id}`, {
    method: 'PATCH',
    headers: { ...serviceHeaders, Prefer: 'return=representation' },
    body: JSON.stringify(profilePatch),
  })
  const data = await response.json().catch(() => [])
  if (!response.ok) {
    const duplicate = String(data?.message || '').toLowerCase().includes('duplicate')
    return NextResponse.json(
      { error: duplicate ? 'That username is already taken.' : 'Could not update your profile.' },
      { status: duplicate ? 409 : 500 },
    )
  }

  const metadataResponse = await fetch(`${url}/auth/v1/admin/users/${user.id}`, {
    method: 'PUT',
    headers: serviceHeaders,
    body: JSON.stringify({
      user_metadata: {
        ...(user.user_metadata || {}),
        full_name: fullName,
      },
    }),
  })
  if (!metadataResponse.ok) {
    console.error('Account full-name update failed:', metadataResponse.status)
    return NextResponse.json(
      { error: 'Your profile was saved, but the private account name could not be updated. Please retry.' },
      { status: 502 },
    )
  }
  return NextResponse.json({ profile: data[0] || null })
}
