import 'server-only'
import { betaFeatureConfig, betaFeatureDetails } from '@/lib/beta-features'
import { betaSchemaPacks } from '@/lib/beta-schema-version'
import { editorialUrl, serviceHeaders } from '@/lib/editorial-server'
import { sanitizeCopilotValue } from './sanitize'
import type { StaffCopilotCitation, StaffCopilotSuggestedLink, StaffCopilotToolName, StaffCopilotToolResult } from './types'

async function rest(path: string): Promise<unknown[]> {
  const response = await fetch(editorialUrl(path), { headers: serviceHeaders, cache: 'no-store' })
  if (!response.ok) throw new Error('READ_UNAVAILABLE')
  const data = await response.json()
  return Array.isArray(data) ? data : []
}

async function optionalRest(path: string): Promise<unknown[] | null> {
  try { return await rest(path) } catch { return null }
}

async function exactCount(path: string): Promise<number | null> {
  try {
    const response = await fetch(editorialUrl(path), { headers: { ...serviceHeaders, Prefer: 'count=exact' }, cache: 'no-store' })
    if (!response.ok) return null
    const range = response.headers.get('content-range') || ''
    const total = Number(range.split('/').pop())
    return Number.isFinite(total) ? total : null
  } catch { return null }
}

function cap(value: unknown, fallback = 20): number {
  const n = Number(value)
  return Number.isFinite(n) ? Math.max(1, Math.min(20, Math.floor(n))) : fallback
}

function stringArg(args: Record<string, unknown>, key: string): string {
  return String(args[key] || '').trim()
}

function citations(...names: string[]): StaffCopilotCitation[] {
  return names.map((name) => ({ type: 'table', name }))
}

function links(...items: Array<[string, string]>): StaffCopilotSuggestedLink[] {
  return items.map(([href, label]) => ({ href, label }))
}

async function resolveUser(identifier: string): Promise<{ userId: string | null; profile: Record<string, unknown> | null }> {
  const value = identifier.trim()
  if (!value) return { userId: null, profile: null }
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  if (uuid) {
    const rows = await optionalRest(`profiles?id=eq.${encodeURIComponent(value)}&select=id,username,display_name,creator_public_name,producer_public_name,role,is_producer,is_verified,is_published&limit=1`)
    return { userId: value, profile: (rows?.[0] as Record<string, unknown> | undefined) || null }
  }
  if (!value.includes('@')) {
    const q = encodeURIComponent(value)
    const rows = await optionalRest(`profiles?or=(username.ilike.${q},display_name.ilike.${q},creator_public_name.ilike.${q},producer_public_name.ilike.${q})&select=id,username,display_name,creator_public_name,producer_public_name,role,is_producer,is_verified,is_published&limit=1`)
    const profile = (rows?.[0] as Record<string, unknown> | undefined) || null
    return { userId: profile?.id ? String(profile.id) : null, profile }
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!url || !service) return { userId: null, profile: null }
  try {
    const response = await fetch(`${url}/auth/v1/admin/users?page=1&per_page=1000`, {
      headers: { apikey: service, Authorization: `Bearer ${service}` }, cache: 'no-store',
    })
    if (!response.ok) return { userId: null, profile: null }
    const payload = await response.json() as { users?: Array<{ id: string; email?: string }> }
    const user = (payload.users || []).find((item) => String(item.email || '').toLowerCase() === value.toLowerCase())
    if (!user) return { userId: null, profile: null }
    const rows = await optionalRest(`profiles?id=eq.${user.id}&select=id,username,display_name,creator_public_name,producer_public_name,role,is_producer,is_verified,is_published&limit=1`)
    return { userId: user.id, profile: (rows?.[0] as Record<string, unknown> | undefined) || null }
  } catch { return { userId: null, profile: null } }
}

async function qaSnapshot(): Promise<StaffCopilotToolResult> {
  const features = betaFeatureConfig()
  const details = betaFeatureDetails()
  const [tracks, releases, broadcasts] = await Promise.all([
    exactCount('tracks?editorial_status=eq.submitted&select=id'),
    exactCount('releases?editorial_status=in.(submitted,in_review)&select=id'),
    exactCount('creator_live_broadcasts?status=in.(armed,signal_detected,live,signal_lost)&select=id'),
  ])
  return {
    tool: 'qa.snapshot', status: 'ok',
    data: sanitizeCopilotValue({
      runtime: details.runtime.effective,
      productionLocked: features.productionLocked,
      features,
      deployment: {
        gitSha: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_SHA || null,
        gitBranch: process.env.VERCEL_GIT_COMMIT_REF || process.env.GIT_BRANCH || null,
        deploymentUrl: process.env.VERCEL_URL || null,
        supabaseProjectRef: process.env.BVS_SUPABASE_PROJECT_REF || process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)\./)?.[1] || null,
      },
      queues: { submittedTracks: tracks, submittedReleases: releases, activeBroadcasts: broadcasts },
      expectedSchemaPacks: betaSchemaPacks,
    }),
    citations: [{ type: 'route', name: '/api/beta/qa' }, ...citations('tracks', 'releases', 'creator_live_broadcasts')],
    suggestedLinks: links(['/beta/qa', 'Open Beta QA']),
  }
}

async function queueSummary(args: Record<string, unknown>): Promise<StaffCopilotToolResult> {
  const limit = cap(args.limit)
  const [tracks, beats, releases, profiles, roleApps] = await Promise.all([
    optionalRest(`tracks?editorial_status=in.(submitted,in_review)&reclassified_to_beat_id=is.null&select=id,title,artist_name,editorial_status,created_at&order=created_at.asc&limit=${limit}`),
    optionalRest(`beats?status=in.(submitted,in_review,changes_requested)&select=id,title,status,producer_user_id,created_at&order=created_at.asc&limit=${limit}`),
    optionalRest(`releases?editorial_status=in.(submitted,in_review)&select=id,title,artist_name,editorial_status,created_at&order=created_at.asc&limit=${limit}`),
    optionalRest(`profiles?or=(creator_name_status.eq.pending,producer_name_status.eq.pending)&select=id,username,display_name,creator_name_status,producer_name_status&limit=${limit}`),
    optionalRest(`profile_role_applications?status=eq.submitted&select=id,user_id,requested_role,status,created_at&limit=${limit}`),
  ])
  return {
    tool: 'editorial.queueSummary', status: 'ok',
    data: sanitizeCopilotValue({ tracks: tracks ?? [], beats: beats ?? [], releases: releases ?? [], profiles: profiles ?? [], roleApplications: roleApps ?? [], available: { tracks: tracks !== null, beats: beats !== null, releases: releases !== null, profiles: profiles !== null } }),
    citations: citations('tracks', 'beats', 'releases', 'profiles', 'profile_role_applications'),
    suggestedLinks: links(['/editorial', 'Open Editorial']),
  }
}

async function listBroadcasts(args: Record<string, unknown>): Promise<StaffCopilotToolResult> {
  const limit = cap(args.limit)
  const requested = stringArg(args, 'status').toLowerCase()
  const filter = requested ? `status=eq.${encodeURIComponent(requested)}&` : ''
  const rows = await optionalRest(`creator_live_broadcasts?${filter}select=id,show_id,title,status,scheduled_for,last_signal_at,last_publish_at,last_unpublish_at,current_publisher,bitrate_kbps,hls_available,audio_detected,video_detected,health_status,hls_url,playback_url,updated_at&order=updated_at.desc&limit=${limit}`)
  if (rows === null) return { tool: 'live.listBroadcasts', status: 'unavailable', data: { available: false }, citations: citations('creator_live_broadcasts') }
  const since = new Date(Date.now() - 2 * 60 * 1000).toISOString()
  const sessions = await optionalRest(`live_viewer_sessions?last_seen_at=gte.${encodeURIComponent(since)}&select=broadcast_id,session_id&limit=1000`)
  const viewers = new Map<string, number>()
  for (const item of sessions || []) {
    const row = item as Record<string, unknown>
    const id = String(row.broadcast_id || '')
    viewers.set(id, (viewers.get(id) || 0) + 1)
  }
  const broadcasts = (rows as Record<string, unknown>[]).map((row) => ({ ...row, viewer_count: viewers.get(String(row.id)) || 0 }))
  return {
    tool: 'live.listBroadcasts', status: 'ok', data: sanitizeCopilotValue({ broadcasts }),
    citations: citations('creator_live_broadcasts', 'live_viewer_sessions'),
    suggestedLinks: links(['/beta/qa', 'Open Beta QA']),
  }
}

async function recentEvents(args: Record<string, unknown>): Promise<StaffCopilotToolResult> {
  const limit = cap(args.limit)
  const broadcastId = stringArg(args, 'broadcastId')
  const filter = broadcastId ? `broadcast_id=eq.${encodeURIComponent(broadcastId)}&` : ''
  const rows = await optionalRest(`show_stream_events?${filter}select=id,broadcast_id,event_source,event_type,previous_status,next_status,reason,duplicate,created_at,occurred_at,type&order=created_at.desc&limit=${limit}`)
  return {
    tool: 'live.recentEvents', status: rows === null ? 'unavailable' : 'ok', data: sanitizeCopilotValue({ available: rows !== null, events: rows ?? [] }),
    citations: citations('show_stream_events'), suggestedLinks: links(['/beta/qa', 'Open Beta QA']),
  }
}

async function lookupOrder(args: Record<string, unknown>): Promise<StaffCopilotToolResult> {
  const reference = stringArg(args, 'reference')
  const email = stringArg(args, 'email').toLowerCase()
  if (!reference && !email) return { tool: 'commerce.lookupOrder', status: 'denied', data: { error: 'Order reference or customer email is required.' }, citations: [] }
  const filter = reference ? `reference=eq.${encodeURIComponent(reference)}` : `customer_email=ilike.${encodeURIComponent(email)}`
  const orders = await optionalRest(`orders?${filter}&select=id,reference,customer_name,customer_email,payment_method,subtotal,total,status,delivery_status,currency,paid_at,created_at,updated_at&order=created_at.desc&limit=10`)
  const ids = (orders || []).map((row) => String((row as Record<string, unknown>).id || '')).filter(Boolean)
  let paymentEvents: unknown[] = []
  if (ids.length) {
    const joined = ids.join(',')
    paymentEvents = await optionalRest(`commerce_payment_events?order_id=in.(${joined})&select=order_id,order_reference,provider,event_type,provider_status,amount,currency,verified,reconciled,received_at&order=received_at.desc&limit=20`) || []
  }
  return {
    tool: 'commerce.lookupOrder', status: orders === null ? 'unavailable' : 'ok', data: sanitizeCopilotValue({ orders: orders ?? [], paymentEvents }),
    citations: citations('orders', 'commerce_payment_events'), suggestedLinks: links(['/editorial/finance', 'Open Finance']),
  }
}

async function membershipLookup(args: Record<string, unknown>): Promise<StaffCopilotToolResult> {
  const identifier = stringArg(args, 'identifier')
  if (!identifier) return { tool: 'membership.lookup', status: 'denied', data: { error: 'Email, username or user id is required.' }, citations: [] }
  const resolved = await resolveUser(identifier)
  if (!resolved.userId) return { tool: 'membership.lookup', status: 'ok', data: { found: false }, citations: citations('profiles', 'bvs_memberships') }
  const memberships = await optionalRest(`bvs_memberships?user_id=eq.${resolved.userId}&select=id,plan_id,family,status,billing_interval,starts_at,ends_at,cancel_at,founding_seat,provider,created_at,updated_at&order=updated_at.desc&limit=20`)
  return { tool: 'membership.lookup', status: memberships === null ? 'unavailable' : 'ok', data: sanitizeCopilotValue({ found: true, profile: resolved.profile, memberships: memberships ?? [] }), citations: citations('profiles', 'bvs_memberships'), suggestedLinks: links(['/premium', 'Open Premium']) }
}

async function creatorLookup(args: Record<string, unknown>): Promise<StaffCopilotToolResult> {
  const identifier = stringArg(args, 'identifier')
  if (!identifier) return { tool: 'creator.lookup', status: 'denied', data: { error: 'Username, creator name or user id is required.' }, citations: [] }
  const resolved = await resolveUser(identifier)
  if (!resolved.userId) return { tool: 'creator.lookup', status: 'ok', data: { found: false }, citations: citations('profiles') }
  const id = resolved.userId
  const [tracks, beats, releases, listings] = await Promise.all([
    exactCount(`tracks?user_id=eq.${id}&select=id`), exactCount(`beats?producer_user_id=eq.${id}&select=id`), exactCount(`releases?user_id=eq.${id}&select=id`), exactCount(`creator_marketplace_listings?seller_user_id=eq.${id}&select=id`),
  ])
  return { tool: 'creator.lookup', status: 'ok', data: sanitizeCopilotValue({ found: true, profile: resolved.profile, counts: { tracks, beats, releases, marketplaceListings: listings } }), citations: citations('profiles', 'tracks', 'beats', 'releases', 'creator_marketplace_listings'), suggestedLinks: resolved.profile?.username ? links([`/artist/${resolved.profile.username}`, 'Open creator']) : undefined }
}

async function recentFailures(args: Record<string, unknown>): Promise<StaffCopilotToolResult> {
  const limit = cap(args.limit)
  const [processing, uploads] = await Promise.all([
    optionalRest(`media_processing_jobs?status=in.(failed,blocked)&select=id,release_id,release_track_id,status,attempts,error_code,blockers,malware_status,created_at,updated_at&order=updated_at.desc&limit=${limit}`),
    optionalRest(`marketplace_upload_verifications?status=in.(quarantined,abandoned)&select=id,user_id,status,declared_mime,detected_mime,size_bytes,rejection_reason,created_at,updated_at&order=updated_at.desc&limit=${limit}`),
  ])
  const available = processing !== null || uploads !== null
  return { tool: 'uploads.recentFailures', status: available ? 'ok' : 'unavailable', data: sanitizeCopilotValue({ available, mediaProcessing: processing ?? [], marketplaceUploads: uploads ?? [] }), citations: citations('media_processing_jobs', 'marketplace_upload_verifications'), suggestedLinks: links(['/beta/qa', 'Open Beta QA']) }
}

async function schemaVersion(): Promise<StaffCopilotToolResult> {
  const applied = await optionalRest('bvs_schema_packs?select=pack_id,step,file_name,file_sha256,applied_at,applied_by&order=applied_at.desc&limit=30')
  return { tool: 'schema.version', status: applied === null ? 'unavailable' : 'ok', data: sanitizeCopilotValue({ expected: betaSchemaPacks, envVersion: process.env.BVS_BETA_SCHEMA_VERSION || null, envChecksum: process.env.BVS_BETA_SCHEMA_CHECKSUM || null, applied: applied ?? [] }), citations: citations('bvs_schema_packs'), suggestedLinks: links(['/beta/qa', 'Open Beta QA']) }
}

function docsHelp(): StaffCopilotToolResult {
  return { tool: 'docs.help', status: 'ok', data: { routes: [
    { href: '/admin/copilot', label: 'Ops Copilot' }, { href: '/beta/qa', label: 'Beta QA' }, { href: '/editorial', label: 'Editorial' }, { href: '/editorial/finance', label: 'Finance' }, { href: '/creator/studio#broadcast', label: 'Creator Broadcast' },
  ], boundaries: ['Read tools only', 'No shell or arbitrary SQL', 'No deploys', 'No editorial/payment/live mutations', 'Public Ask BVS is separate'] }, citations: [{ type: 'docs', name: 'staff-copilot-route-map' }] }
}

export async function executeStaffCopilotTool(name: StaffCopilotToolName, args: Record<string, unknown> = {}): Promise<StaffCopilotToolResult> {
  switch (name) {
    case 'qa.snapshot': return qaSnapshot()
    case 'editorial.queueSummary': return queueSummary(args)
    case 'live.listBroadcasts': return listBroadcasts(args)
    case 'live.recentEvents': return recentEvents(args)
    case 'commerce.lookupOrder': return lookupOrder(args)
    case 'membership.lookup': return membershipLookup(args)
    case 'creator.lookup': return creatorLookup(args)
    case 'uploads.recentFailures': return recentFailures(args)
    case 'schema.version': return schemaVersion()
    case 'docs.help': return docsHelp()
  }
}
