import { NextResponse } from 'next/server'
import { can, editorialIdentity, editorialUrl, serviceHeaders } from '@/lib/editorial-server'
import { creatorPublicName, producerPublicName } from '@/lib/public-name'
import { mediaUrlForStoredValue } from '@/lib/media-url'
import { r2KeyFromMediaUrl, safeR2Key, signedR2DownloadUrl } from '@/lib/r2-storage'
import type { EditorialPermission } from '@/lib/editorial'
import { PRODUCER_NAME_USE_ARTIST } from '@/lib/creator-entitlements'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type WorkKind =
  | 'release'
  | 'track'
  | 'beat'
  | 'creator'
  | 'artist_name'
  | 'producer_name'
  | 'request'
  | 'role'
  | 'programme'
  | 'audit'

type Field = { label: string; value: string }
type Related = { label: string; value: string; meta?: string; kind?: string; id?: string }
type QuickAction = {
  id: string
  label: string
  tone?: 'default' | 'positive' | 'warning' | 'danger'
  action: string
  body: Record<string, unknown>
  noteKey?: string
  noteRequired?: boolean
  confirm?: string
}

type WorkItem = {
  kind: WorkKind
  id: string
  title: string
  subtitle?: string
  status?: string
  section: string
  createdAt?: string
  artwork?: string
  audio?: string
  description?: string
  fields: Field[]
  related: Related[]
  audit: Related[]
  quickActions: QuickAction[]
  distro?: {
    premium: boolean
    canQueue: boolean
    job?: { id: string; status: string; distributor?: string | null; notes?: string | null }
    trackId?: string
    releaseId?: string
  }
}

async function rows(path: string) {
  const response = await fetch(editorialUrl(path), { headers: serviceHeaders, cache: 'no-store' })
  if (!response.ok) return [] as Array<Record<string, unknown>>
  return response.json() as Promise<Array<Record<string, unknown>>>
}

function text(value: unknown) {
  return String(value ?? '').trim()
}

function yesNo(value: unknown) {
  return value === true ? 'Yes' : 'No'
}

function pretty(value: unknown) {
  const raw = text(value)
  return raw ? raw.replaceAll('_', ' ') : '—'
}

function dateValue(value: unknown) {
  const raw = text(value)
  if (!raw) return '—'
  const time = Date.parse(raw)
  return Number.isFinite(time) ? new Date(time).toLocaleString() : raw
}

async function signStoredMedia(value?: string | null) {
  if (!value) return undefined
  const key = r2KeyFromMediaUrl(value) || (safeR2Key(value) && !/^https?:/i.test(value) ? value : null)
  if (key) return signedR2DownloadUrl(key, 900)
  return mediaUrlForStoredValue(value) || value
}

function has(identity: Awaited<ReturnType<typeof editorialIdentity>>, permission: EditorialPermission) {
  return Boolean(identity && can(identity, permission))
}

function artistPremiumOn(profile?: Record<string, unknown> | null) {
  if (!profile || profile.premium_active !== true) return false
  const until = text(profile.premium_until)
  if (until && Number.isFinite(Date.parse(until)) && Date.parse(until) < Date.now()) return false
  return true
}

async function recentAudit(entityId: string) {
  if (!entityId) return [] as Related[]
  const auditRows = await rows(
    `editorial_audit_log?entity_id=eq.${encodeURIComponent(entityId)}&select=action,entity_type,created_at&order=created_at.desc&limit=8`,
  )
  return auditRows.map((entry) => ({
    label: pretty(entry.action),
    value: dateValue(entry.created_at),
    meta: text(entry.entity_type),
  }))
}

function trackActions(
  identity: Awaited<ReturnType<typeof editorialIdentity>>,
  track: Record<string, unknown>,
): QuickAction[] {
  const actions: QuickAction[] = []
  const id = text(track.id)
  const status = text(track.editorial_status)
  const isPublic = track.is_public === true
  const inRotation = track.in_rotation === true
  if (has(identity, 'approve_submissions')) {
    if (status === 'submitted') {
      actions.push({ id: 'review', label: 'Mark in review', action: 'review_track', body: { trackId: id, status: 'in_review' } })
    }
    if (['submitted', 'in_review'].includes(status)) {
      actions.push({ id: 'approve', label: 'Approve', tone: 'positive', action: 'review_track', body: { trackId: id, status: 'approved' } })
      actions.push({ id: 'reject', label: 'Reject', tone: 'danger', action: 'review_track', body: { trackId: id, status: 'rejected' }, noteKey: 'notes', noteRequired: true, confirm: 'Reject this track submission?' })
    }
    if (status === 'approved') {
      actions.push({ id: isPublic ? 'unpublish' : 'publish', label: isPublic ? 'Unpublish' : 'Publish', tone: isPublic ? 'warning' : 'positive', action: 'publish_track', body: { trackId: id, publish: !isPublic }, confirm: isPublic ? 'Unpublish this track from BVS?' : undefined })
    }
  }
  if (has(identity, 'manage_rotation') && status === 'approved' && isPublic) {
    actions.push({ id: inRotation ? 'remove-rotation' : 'add-rotation', label: inRotation ? 'Remove from rotation' : 'Add to rotation', action: 'set_rotation', body: { trackId: id, enabled: !inRotation } })
  }
  return actions
}

function beatActions(
  identity: Awaited<ReturnType<typeof editorialIdentity>>,
  beat: Record<string, unknown>,
): QuickAction[] {
  const actions: QuickAction[] = []
  if (!has(identity, 'approve_submissions')) return actions
  const id = text(beat.id)
  const status = text(beat.status)
  const isPublic = beat.is_public === true
  if (status === 'submitted') {
    actions.push({ id: 'review', label: 'Mark in review', action: 'review_beat', body: { beatId: id, status: 'in_review' } })
  }
  if (['submitted', 'in_review', 'changes_requested'].includes(status)) {
    actions.push({ id: 'approve', label: 'Approve', tone: 'positive', action: 'review_beat', body: { beatId: id, status: 'approved' } })
    actions.push({ id: 'changes', label: 'Request changes', tone: 'warning', action: 'review_beat', body: { beatId: id, status: 'changes_requested' }, noteKey: 'notes', noteRequired: true })
    actions.push({ id: 'reject', label: 'Reject', tone: 'danger', action: 'review_beat', body: { beatId: id, status: 'rejected' }, noteKey: 'notes', noteRequired: true, confirm: 'Reject this beat submission?' })
  }
  if (['approved', 'published'].includes(status)) {
    actions.push({ id: isPublic ? 'unpublish' : 'publish', label: isPublic ? 'Unpublish' : 'Publish to BeatStore', tone: isPublic ? 'warning' : 'positive', action: 'publish_beat', body: { beatId: id, publish: !isPublic }, confirm: isPublic ? 'Unpublish this beat from BeatStore?' : undefined })
  }
  return actions
}

function identityActions(
  identity: Awaited<ReturnType<typeof editorialIdentity>>,
  profile: Record<string, unknown>,
  kind: 'artist_name' | 'producer_name',
): QuickAction[] {
  if (!has(identity, 'publish_artists')) return []
  const profileId = text(profile.id)
  const artist = kind === 'artist_name'
  const request = text(artist ? profile.creator_name_request : profile.producer_name_request)
  const status = text(artist ? profile.creator_name_status : profile.producer_name_status)
  if (!['pending', 'changes_requested'].includes(status) || !request) return []
  const reviewAction = artist ? 'review_creator_name' : 'review_producer_name'
  const approveBody: Record<string, unknown> = { profileId, decision: 'approved' }
  if (!artist && request === PRODUCER_NAME_USE_ARTIST) approveBody.useArtistNameForProducer = true
  else approveBody.publicName = request
  return [
    { id: 'approve', label: request === PRODUCER_NAME_USE_ARTIST ? 'Approve artist-name fallback' : 'Approve name', tone: 'positive', action: reviewAction, body: approveBody },
    { id: 'changes', label: 'Request changes', tone: 'warning', action: reviewAction, body: { profileId, decision: 'changes_requested', publicName: request }, noteKey: 'notes', noteRequired: true },
    { id: 'reject', label: 'Reject', tone: 'danger', action: reviewAction, body: { profileId, decision: 'rejected', publicName: request }, noteKey: 'notes', noteRequired: true, confirm: 'Reject this public-name request?' },
  ]
}

async function workTrack(identity: Awaited<ReturnType<typeof editorialIdentity>>, id: string): Promise<WorkItem | null> {
  const track = (await rows(`tracks?id=eq.${encodeURIComponent(id)}&reclassified_to_beat_id=is.null&select=*&limit=1`))[0]
  if (!track) return null
  const userId = text(track.user_id)
  const releaseId = text(track.release_id)
  const [profiles, credits, messages, clearances, siblings, distJobs, audit] = await Promise.all([
    rows(`profiles?id=eq.${encodeURIComponent(userId)}&select=id,username,display_name,creator_public_name,creator_name_status,premium_active,distribution_enabled,premium_until&limit=1`),
    rows(`track_credits?track_id=eq.${encodeURIComponent(id)}&select=person_name,credit_role,is_verified&order=created_at.asc&limit=100`),
    rows(`track_review_messages?track_id=eq.${encodeURIComponent(id)}&select=author_kind,message,created_at&order=created_at.asc&limit=100`),
    rows(`mobile_distribution_clearances?track_id=eq.${encodeURIComponent(id)}&select=surface,status,rights_basis,evidence_reference,reviewed_at&limit=20`),
    userId
      ? rows(`tracks?user_id=eq.${encodeURIComponent(userId)}&reclassified_to_beat_id=is.null&select=id,title,genre,editorial_status,created_at&order=created_at.desc&limit=40`)
      : Promise.resolve([] as Array<Record<string, unknown>>),
    rows(
      releaseId
        ? `distribution_jobs?or=(track_id.eq.${encodeURIComponent(id)},release_id.eq.${encodeURIComponent(releaseId)})&select=id,status,distributor,notes,track_id,release_id&order=updated_at.desc&limit=5`
        : `distribution_jobs?track_id=eq.${encodeURIComponent(id)}&select=id,status,distributor,notes,track_id,release_id&order=updated_at.desc&limit=5`,
    ),
    recentAudit(id),
  ])
  const profile = profiles[0]
  const artist = creatorPublicName({ publicName: text(profile?.creator_public_name), publicNameStatus: text(profile?.creator_name_status), username: text(profile?.username) }) || text(track.artist_name)
  const premium = artistPremiumOn(profile)
  const job = distJobs[0]
  return {
    kind: 'track', id, title: text(track.title) || 'Untitled track', subtitle: [artist, text(track.genre)].filter(Boolean).join(' · '), status: text(track.editorial_status), section: 'ed-tracks', createdAt: text(track.created_at) || undefined,
    artwork: await signStoredMedia(text(track.artwork_url)), audio: await signStoredMedia(text(track.file_url)), description: text(track.description) || undefined,
    fields: [
      { label: 'Artist', value: artist || '—' }, { label: 'Genre', value: text(track.genre) || '—' }, { label: 'Public', value: yesNo(track.is_public) }, { label: 'In rotation', value: yesNo(track.in_rotation) }, { label: 'Licence', value: pretty(track.licence_type) }, { label: 'Price', value: `$${Number(track.download_price || 0).toFixed(2)}` }, { label: 'Premium', value: premium ? 'Active' : 'Off' }, { label: 'Submitted', value: dateValue(track.created_at) },
    ],
    related: [
      ...siblings.filter((row) => text(row.id) !== id).map((row) => ({
        label: text(row.title) || 'Untitled track',
        value: `${pretty(row.editorial_status)}${text(row.genre) ? ` · ${text(row.genre)}` : ''}`,
        meta: 'same artist',
        kind: 'track',
        id: text(row.id),
      })),
      ...credits.map((row) => ({ label: text(row.person_name), value: text(row.credit_role), meta: row.is_verified === true ? 'verified credit' : 'credit' })),
      ...clearances.map((row) => ({ label: `${text(row.surface).toUpperCase()} clearance`, value: pretty(row.status), meta: text(row.rights_basis) || undefined })),
      ...messages.slice(-5).map((row) => ({ label: `${pretty(row.author_kind)} message`, value: text(row.message), meta: dateValue(row.created_at) })),
    ],
    audit,
    quickActions: trackActions(identity, track),
    distro: {
      premium,
      canQueue: has(identity, 'manage_artist_wallet'),
      job: job?.id ? { id: text(job.id), status: text(job.status), distributor: text(job.distributor) || null, notes: text(job.notes) || null } : undefined,
      trackId: id,
      releaseId: releaseId || undefined,
    },
  }
}

async function workBeat(identity: Awaited<ReturnType<typeof editorialIdentity>>, id: string): Promise<WorkItem | null> {
  const beat = (await rows(`beats?id=eq.${encodeURIComponent(id)}&select=*,beat_licence_options(*)&limit=1`))[0]
  if (!beat) return null
  const [profiles, messages, audit] = await Promise.all([
    rows(`profiles?id=eq.${encodeURIComponent(text(beat.producer_user_id))}&select=id,username,creator_public_name,creator_name_status,producer_public_name,producer_name_status&limit=1`),
    rows(`beat_review_messages?beat_id=eq.${encodeURIComponent(id)}&select=author_kind,message,created_at&order=created_at.asc&limit=100`),
    recentAudit(id),
  ])
  const profile = profiles[0]
  const producer = producerPublicName({ producerPublicName: text(profile?.producer_public_name), producerNameStatus: text(profile?.producer_name_status), publicName: text(profile?.creator_public_name), publicNameStatus: text(profile?.creator_name_status), username: text(profile?.username) })
  const licences = Array.isArray(beat.beat_licence_options) ? beat.beat_licence_options as Array<Record<string, unknown>> : []
  return {
    kind: 'beat', id, title: text(beat.title) || 'Untitled beat', subtitle: [producer, text(beat.genre)].filter(Boolean).join(' · '), status: text(beat.status), section: 'ed-beats', createdAt: text(beat.created_at) || undefined,
    artwork: await signStoredMedia(text(beat.artwork_path)), audio: await signStoredMedia(text(beat.preview_path)), description: text(beat.description) || undefined,
    fields: [
      { label: 'Producer', value: producer || '—' }, { label: 'Genre', value: text(beat.genre) || '—' }, { label: 'Mood', value: text(beat.mood) || '—' }, { label: 'BPM', value: text(beat.bpm) || '—' }, { label: 'Key', value: text(beat.musical_key) || '—' }, { label: 'Public', value: yesNo(beat.is_public) }, { label: 'Submitted', value: dateValue(beat.created_at) },
    ],
    related: [
      ...licences.map((row) => ({ label: text(row.licence_name) || 'Licence', value: `$${Number(row.price_usd || 0).toFixed(2)}`, meta: row.is_active === false ? 'inactive' : 'active' })),
      ...messages.slice(-5).map((row) => ({ label: `${pretty(row.author_kind)} message`, value: text(row.message), meta: dateValue(row.created_at) })),
    ],
    audit,
    quickActions: beatActions(identity, beat),
  }
}

async function workRelease(identity: Awaited<ReturnType<typeof editorialIdentity>>, id: string): Promise<WorkItem | null> {
  const release = (await rows(`releases?id=eq.${encodeURIComponent(id)}&select=*&limit=1`))[0]
  if (!release) return null
  const [members, contributors, evidence, mediaJobs, distJobs, profiles, audit] = await Promise.all([
    rows(`release_tracks?release_id=eq.${encodeURIComponent(id)}&select=id,position,title,isrc,track_id,in_rotation&order=position.asc&limit=300`),
    rows(`release_contributors?release_id=eq.${encodeURIComponent(id)}&select=person_name,contribution_role,rights_confirmed&order=created_at.asc&limit=200`),
    rows(`release_clearance_evidence?release_id=eq.${encodeURIComponent(id)}&select=material_type,review_status,original_file_name,created_at&order=created_at.asc&limit=200`),
    rows(`media_processing_jobs?release_id=eq.${encodeURIComponent(id)}&select=status,malware_status,error_code,release_track_id&order=created_at.asc&limit=300`),
    rows(`distribution_jobs?release_id=eq.${encodeURIComponent(id)}&select=id,status,distributor,notes,updated_at&order=updated_at.desc&limit=5`),
    text(release.user_id)
      ? rows(`profiles?id=eq.${encodeURIComponent(text(release.user_id))}&select=id,premium_active,distribution_enabled,premium_until&limit=1`)
      : Promise.resolve([] as Array<Record<string, unknown>>),
    recentAudit(id),
  ])
  const blockers = Array.isArray(release.preflight_blockers) ? (release.preflight_blockers as unknown[]).map(text).filter(Boolean) : []
  const premium = artistPremiumOn(profiles[0])
  const job = distJobs[0]
  return {
    kind: 'release', id, title: text(release.title) || 'Untitled release', subtitle: [text(release.artist_name), pretty(release.release_type)].filter(Boolean).join(' · '), status: text(release.editorial_status), section: 'ed-releases', createdAt: text(release.created_at) || undefined,
    artwork: await signStoredMedia(text(release.cover_url)), description: blockers.length ? `Preflight blockers: ${blockers.join(' · ')}` : text(release.editorial_notes) || undefined,
    fields: [
      { label: 'Artist', value: text(release.artist_name) || '—' }, { label: 'Type', value: pretty(release.release_type) }, { label: 'Tracks', value: String(members.length || Number(release.track_count || 0)) }, { label: 'Preflight', value: pretty(release.preflight_status) }, { label: 'Public', value: yesNo(release.is_public) }, { label: 'In rotation', value: yesNo(release.in_rotation) }, { label: 'Premium', value: premium ? 'Active' : 'Off' }, { label: 'Submitted', value: dateValue(release.created_at) },
    ],
    related: [
      ...members.map((row) => ({
        label: `${text(row.position)}. ${text(row.title)}`,
        value: text(row.isrc) || 'No ISRC',
        meta: row.in_rotation === true ? 'in rotation' : undefined,
        kind: text(row.track_id) ? 'track' : undefined,
        id: text(row.track_id) || undefined,
      })),
      ...contributors.map((row) => ({ label: text(row.person_name), value: text(row.contribution_role), meta: row.rights_confirmed === true ? 'rights confirmed' : 'rights not confirmed' })),
      ...evidence.map((row) => ({ label: pretty(row.material_type), value: pretty(row.review_status), meta: text(row.original_file_name) })),
      ...mediaJobs.filter((row) => text(row.status) !== 'ready').map((row) => ({ label: 'Media processing', value: pretty(row.status), meta: text(row.error_code) || pretty(row.malware_status) })),
    ],
    audit,
    // Publishing a release has preflight, ISRC, rights and rotation choices. Keep
    // those decisions in the full release panel rather than hiding them here.
    quickActions: has(identity, 'approve_submissions') && ['submitted', 'in_review'].includes(text(release.editorial_status))
      ? [{ id: 'reject', label: 'Reject release', tone: 'danger', action: 'reject_release', body: { releaseId: id }, noteKey: 'notes', noteRequired: true, confirm: 'Reject this release submission?' }]
      : [],
    distro: {
      premium,
      canQueue: has(identity, 'manage_artist_wallet'),
      job: job?.id ? { id: text(job.id), status: text(job.status), distributor: text(job.distributor) || null, notes: text(job.notes) || null } : undefined,
      releaseId: id,
    },
  }
}

async function workCreator(identity: Awaited<ReturnType<typeof editorialIdentity>>, id: string, kind: 'creator' | 'artist_name' | 'producer_name'): Promise<WorkItem | null> {
  const profile = (await rows(`profiles?id=eq.${encodeURIComponent(id)}&select=*&limit=1`))[0]
  if (!profile) return null
  const artistName = creatorPublicName({ publicName: text(profile.creator_public_name), publicNameStatus: text(profile.creator_name_status), username: text(profile.username) })
  const producerName = producerPublicName({ producerPublicName: text(profile.producer_public_name), producerNameStatus: text(profile.producer_name_status), publicName: text(profile.creator_public_name), publicNameStatus: text(profile.creator_name_status), username: text(profile.username) })
  const request = kind === 'artist_name' ? text(profile.creator_name_request) : kind === 'producer_name' ? text(profile.producer_name_request) : ''
  const status = kind === 'artist_name' ? text(profile.creator_name_status) : kind === 'producer_name' ? text(profile.producer_name_status) : profile.is_published === true ? 'published' : 'not_published'
  const [audit, tracks] = await Promise.all([
    recentAudit(id),
    rows(`tracks?user_id=eq.${encodeURIComponent(id)}&reclassified_to_beat_id=is.null&select=id,title,genre,editorial_status,created_at&order=created_at.desc&limit=40`),
  ])
  const premium = artistPremiumOn(profile)
  return {
    kind, id, title: kind === 'producer_name' ? producerName : artistName, subtitle: [`@${text(profile.username)}`, text(profile.role), profile.is_producer === true ? 'producer' : ''].filter(Boolean).join(' · '), status, section: kind === 'creator' ? 'ed-artists' : 'ed-identities', createdAt: text(profile.created_at) || undefined,
    artwork: await signStoredMedia(text(profile.avatar_url)), description: text(profile.bio) || undefined,
    fields: [
      { label: 'Username', value: `@${text(profile.username)}` }, { label: 'Member display name', value: text(profile.display_name) || '—' }, { label: 'Artist public name', value: artistName || '—' }, { label: 'Artist review', value: pretty(profile.creator_name_status) }, { label: 'Producer public name', value: producerName || '—' }, { label: 'Producer review', value: pretty(profile.producer_name_status) }, { label: 'Published profile', value: yesNo(profile.is_published) }, { label: 'Verified', value: yesNo(profile.is_verified) }, { label: 'Premium', value: premium ? 'Active · Amuse queue available' : 'Off' },
      ...(request ? [{ label: 'Requested identity', value: request === PRODUCER_NAME_USE_ARTIST ? 'Use approved artist public name' : request }] : []),
    ],
    related: tracks.map((row) => ({
      label: text(row.title) || 'Untitled track',
      value: `${pretty(row.editorial_status)}${text(row.genre) ? ` · ${text(row.genre)}` : ''}`,
      meta: 'song',
      kind: 'track',
      id: text(row.id),
    })),
    audit,
    quickActions: kind === 'artist_name' || kind === 'producer_name' ? identityActions(identity, profile, kind) : [],
    distro: { premium, canQueue: false },
  }
}

async function workRequest(identity: Awaited<ReturnType<typeof editorialIdentity>>, id: string): Promise<WorkItem | null> {
  const [trackRows, artworkRows] = await Promise.all([
    rows(`track_review_requests?id=eq.${encodeURIComponent(id)}&select=*&limit=1`),
    rows(`artwork_change_requests?id=eq.${encodeURIComponent(id)}&select=*&limit=1`),
  ])
  const request = trackRows[0] || artworkRows[0]
  if (!request) return null
  const artwork = Boolean(artworkRows[0])
  const targetKind = artwork ? text(request.target_kind) : 'track'
  const targetId = artwork ? text(request.target_id) : text(request.track_id)
  const targetTable = targetKind === 'release' ? 'releases' : targetKind === 'beat' ? 'beats' : 'tracks'
  const target = targetId ? (await rows(`${targetTable}?id=eq.${encodeURIComponent(targetId)}&select=id,title&limit=1`))[0] : undefined
  const action = artwork ? 'review_artwork_change' : 'review_track_request'
  const audit = await recentAudit(id)
  const quickActions: QuickAction[] = has(identity, 'approve_submissions')
    ? [
        { id: 'reviewing', label: 'Mark reviewing', action, body: { requestId: id, status: 'reviewing' } },
        { id: 'resolve', label: artwork ? 'Approve / apply' : 'Resolve', tone: 'positive', action, body: { requestId: id, status: 'resolved' }, noteKey: 'notes' },
        { id: 'reject', label: 'Reject', tone: 'danger', action, body: { requestId: id, status: 'rejected' }, noteKey: 'notes', noteRequired: true, confirm: 'Reject this artist request?' },
      ]
    : []
  return {
    kind: 'request', id, title: artwork ? `Artwork · ${text(target?.title) || targetKind}` : `${pretty(request.request_type)} · ${text(target?.title) || 'track'}`, subtitle: text(request.message) || targetKind, status: text(request.status), section: 'ed-requests', createdAt: text(request.created_at) || undefined,
    artwork: artwork ? await signStoredMedia(text(request.proposed_artwork_path)) : undefined,
    description: text(request.message) || undefined,
    fields: [{ label: 'Request type', value: pretty(request.request_type) }, { label: 'Target', value: text(target?.title) || targetId || '—' }, { label: 'Status', value: pretty(request.status) }, { label: 'Submitted', value: dateValue(request.created_at) }], related: [], audit, quickActions,
  }
}

async function workRole(id: string): Promise<WorkItem | null> {
  const application = (await rows(`profile_role_applications?id=eq.${encodeURIComponent(id)}&select=*&limit=1`))[0]
  if (!application) return null
  const profile = (await rows(`profiles?id=eq.${encodeURIComponent(text(application.user_id))}&select=id,username,display_name,role,is_producer&limit=1`))[0]
  return {
    kind: 'role', id, title: `${text(profile?.display_name) || `@${text(profile?.username)}`} → ${pretty(application.requested_role)}`, subtitle: text(application.message) || `Current role: ${pretty(profile?.role)}`, status: text(application.status), section: 'ed-role-applications', createdAt: text(application.updated_at) || undefined,
    fields: [{ label: 'Account', value: `@${text(profile?.username)}` }, { label: 'Current role', value: pretty(profile?.role) }, { label: 'Requested role', value: pretty(application.requested_role) }, { label: 'Updated', value: dateValue(application.updated_at) }], related: [], audit: await recentAudit(id), quickActions: [],
  }
}

async function workProgramme(id: string): Promise<WorkItem | null> {
  const programme = (await rows(`programmes?id=eq.${encodeURIComponent(id)}&select=*&limit=1`))[0]
  if (!programme) return null
  return {
    kind: 'programme', id, title: text(programme.title) || text(programme.slug), subtitle: [text(programme.host), text(programme.day_label), text(programme.start_time), text(programme.timezone)].filter(Boolean).join(' · '), status: text(programme.status), section: 'ed-artists',
    fields: [{ label: 'Slug', value: text(programme.slug) }, { label: 'Host', value: text(programme.host) || '—' }, { label: 'Schedule', value: [text(programme.day_label), text(programme.start_time), text(programme.timezone)].filter(Boolean).join(' · ') || '—' }, { label: 'Status', value: pretty(programme.status) }], related: [], audit: await recentAudit(text(programme.slug) || id), quickActions: [],
  }
}

async function workAudit(id: string): Promise<WorkItem | null> {
  const entry = (await rows(`editorial_audit_log?id=eq.${encodeURIComponent(id)}&select=*&limit=1`))[0]
  if (!entry) return null
  return {
    kind: 'audit', id, title: pretty(entry.action), subtitle: `${text(entry.entity_type)} · ${text(entry.entity_id)}`, section: 'ed-audit', createdAt: text(entry.created_at) || undefined,
    fields: [{ label: 'Entity type', value: text(entry.entity_type) || '—' }, { label: 'Entity ID', value: text(entry.entity_id) || '—' }, { label: 'Time', value: dateValue(entry.created_at) }], related: [], audit: [], quickActions: [],
  }
}

export async function GET(request: Request) {
  const identity = await editorialIdentity(request)
  if (!identity) return NextResponse.json({ error: 'Editorial access required.' }, { status: 403 })

  const url = new URL(request.url)
  const kind = text(url.searchParams.get('kind')) as WorkKind
  const id = text(url.searchParams.get('id'))
  const allowedKinds: WorkKind[] = ['release', 'track', 'beat', 'creator', 'artist_name', 'producer_name', 'request', 'role', 'programme', 'audit']
  if (!id || !allowedKinds.includes(kind)) return NextResponse.json({ error: 'A valid work kind and id are required.' }, { status: 400 })

  let item: WorkItem | null = null
  if (kind === 'track') item = await workTrack(identity, id)
  else if (kind === 'beat') item = await workBeat(identity, id)
  else if (kind === 'release') item = await workRelease(identity, id)
  else if (kind === 'creator' || kind === 'artist_name' || kind === 'producer_name') item = await workCreator(identity, id, kind)
  else if (kind === 'request') item = await workRequest(identity, id)
  else if (kind === 'role') item = await workRole(id)
  else if (kind === 'programme') item = await workProgramme(id)
  else if (kind === 'audit') item = await workAudit(id)

  if (!item) return NextResponse.json({ error: 'Editorial work item not found.' }, { status: 404 })
  return NextResponse.json({
    item,
    identity: { role: identity.role, permissions: identity.permissions },
  }, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
}
