import { NextResponse } from 'next/server'
import { audit, can, editorialIdentity, editorialUrl, serviceHeaders } from '@/lib/editorial-server'
import { sendMusicApprovalEmail } from '@/lib/approval-email'
import type { EditorialPermission, EditorialRole } from '@/lib/editorial'
import { r2KeyFromMediaUrl, safeR2Key, signedR2DownloadUrl } from '@/lib/r2-storage'
import { assertCanPublishLiveBeat } from '@/lib/producer-entitlements'

async function jsonOrError(response: Response) {
  if (!response.ok) throw new Error(await response.text())
  const text = await response.text()
  return text ? JSON.parse(text) : null
}

async function patchTable(table: string, query: string, body: Record<string, unknown>) {
  return jsonOrError(await fetch(editorialUrl(`${table}?${query}`), {
    method: 'PATCH', headers: { ...serviceHeaders, Prefer: 'return=representation' }, body: JSON.stringify(body),
  }))
}

async function optionalJson(path: string) {
  const response = await fetch(editorialUrl(path), { headers: serviceHeaders, cache: 'no-store' })
  if (!response.ok) return []
  return response.json()
}

async function requiredJson(path: string) {
  const response = await fetch(editorialUrl(path), { headers: serviceHeaders, cache: 'no-store' })
  if (!response.ok) throw new Error('MIGRATION')
  return response.json()
}

async function signStoredMedia(value?: string | null) {
  if (!value) return value
  const key = r2KeyFromMediaUrl(value) || (safeR2Key(value) && !/^https?:/i.test(value) ? value : null)
  return key ? signedR2DownloadUrl(key, 900) : value
}

async function notifyApproval(input: { userId?: string; title?: string; kind: 'track' | 'release' | 'beat' }) {
  if (!input.userId || !input.title) return
  try {
    await sendMusicApprovalEmail({ userId: input.userId, title: input.title, kind: input.kind })
  } catch (error) {
    console.error('Approval email failed:', error instanceof Error ? error.message : error)
  }
}

type EditorialSection =
  | 'bootstrap'
  | 'overview'
  | 'tracks'
  | 'beats'
  | 'releases'
  | 'profiles'
  | 'programmes'
  | 'wallet'
  | 'all'

async function loadStaffAndAudit() {
  const [staffRes, auditRes] = await Promise.all([
    fetch(editorialUrl('editorial_staff?select=user_id,role,active,created_at&order=created_at.desc'), {
      headers: serviceHeaders,
      cache: 'no-store',
    }),
    fetch(editorialUrl('editorial_audit_log?select=*&order=created_at.desc&limit=30'), {
      headers: serviceHeaders,
      cache: 'no-store',
    }),
  ])
  if (!staffRes.ok || !auditRes.ok) {
    throw new Error('MIGRATION')
  }
  const [staff, auditLog] = await Promise.all([staffRes.json(), auditRes.json()])
  return { staff, auditLog }
}

async function loadTracksSection() {
  const [tracksRes, mobileClearances] = await Promise.all([
    fetch(
      editorialUrl(
        'tracks?reclassified_to_beat_id=is.null&select=id,user_id,title,artist_name,genre,description,file_url,artwork_url,is_public,is_featured,is_downloadable,download_price,editorial_status,editorial_notes,in_rotation,licence_type,licence_summary,created_at&order=created_at.desc&limit=100',
      ),
      { headers: serviceHeaders, cache: 'no-store' },
    ),
    optionalJson('mobile_distribution_clearances?select=id,track_id,surface,status,rights_basis,evidence_reference,review_notes,reviewed_at&limit=1000'),
  ])
  if (!tracksRes.ok) throw new Error('MIGRATION')
  const rawTracks = await tracksRes.json()
  const tracks = await Promise.all(
    (rawTracks as Array<Record<string, unknown>>).map(async (track) => ({
      ...track,
      mobile_clearances: (mobileClearances as Array<Record<string, unknown>>).filter((row) => row.track_id === track.id),
      file_url: await signStoredMedia(String(track.file_url || '')),
      artwork_url: await signStoredMedia(String(track.artwork_url || '')),
    })),
  )
  const [trackRequests, trackReviewMessages, credits] = await Promise.all([
    optionalJson('track_review_requests?select=*&order=created_at.desc&limit=100'),
    optionalJson('track_review_messages?select=*&order=created_at.asc&limit=500'),
    optionalJson('track_credits?select=*&order=created_at.desc&limit=100'),
  ])
  return { tracks, trackRequests, trackReviewMessages, credits }
}

async function loadBeatsSection() {
  const rawBeats = await requiredJson('beats?select=*,beat_licence_options(*)&order=updated_at.desc&limit=100')
  const beats = await Promise.all(
    (rawBeats as Array<Record<string, unknown>>).map(async (beat) => ({
      ...beat,
      preview_path: await signStoredMedia(String(beat.preview_path || '')),
      artwork_path: await signStoredMedia(String(beat.artwork_path || '')),
    })),
  )
  const beatReviewMessages = await optionalJson('beat_review_messages?select=*&order=created_at.asc&limit=500')
  return { beats, beatReviewMessages }
}

async function loadReleasesSection(identity: NonNullable<Awaited<ReturnType<typeof editorialIdentity>>>) {
  const [releases, rawReleaseTracks, releaseCatalogueTracks, knownIsrcMap, releaseContributors, rawReleaseClearanceEvidence, rawMediaProcessingJobs, distributionJobs] =
    await Promise.all([
      requiredJson('releases?select=*&order=created_at.desc&limit=100'),
      requiredJson('release_tracks?select=*&order=position.asc&limit=500'),
      requiredJson('tracks?release_id=not.is.null&select=id,in_rotation,isrc,spotify_url&limit=1000'),
      optionalJson('known_isrc_map?select=isrc,title,artist_name,upc,spotify_album_url,source&order=title.asc&limit=2000'),
      optionalJson('release_contributors?select=*&order=created_at.asc&limit=1000'),
      optionalJson('release_clearance_evidence?select=*&order=created_at.asc&limit=1000'),
      optionalJson('media_processing_jobs?select=*&order=created_at.asc&limit=1000'),
      optionalJson('distribution_jobs?select=*&order=updated_at.desc&limit=100'),
    ])
  const rotationByTrackId = new Map(
    (releaseCatalogueTracks as Array<Record<string, unknown>>).map((track) => [String(track.id), Boolean(track.in_rotation)]),
  )
  const isrcByTrackId = new Map(
    (releaseCatalogueTracks as Array<Record<string, unknown>>)
      .filter((track) => track.isrc)
      .map((track) => [String(track.id), String(track.isrc)]),
  )
  const releaseTracks = (rawReleaseTracks as Array<Record<string, unknown>>).map((track) => ({
    ...track,
    in_rotation: track.track_id ? rotationByTrackId.get(String(track.track_id)) === true : false,
    isrc: track.track_id ? isrcByTrackId.get(String(track.track_id)) || null : null,
  }))
  const releaseClearanceEvidence = await Promise.all(
    (rawReleaseClearanceEvidence as Array<Record<string, unknown>>).map(async (evidence) => ({
      ...evidence,
      file_url: await signStoredMedia(String(evidence.file_path || '')),
    })),
  )
  const mediaProcessingJobs = await Promise.all(
    (rawMediaProcessingJobs as Array<Record<string, unknown>>).map(async (job) => ({
      ...job,
      waveform_path: await signStoredMedia(String(job.waveform_path || '')),
      preview_path: await signStoredMedia(String(job.preview_path || '')),
    })),
  )
  const [copyrightComplaints, releaseClearanceItems, releaseAttestations] = can(identity, 'approve_submissions')
    ? await Promise.all([
      optionalJson('copyright_complaints?select=id,docket_number,status,work_title,claimant_name,release_id,track_id,target_user_id,created_at,hold_applied_at&order=created_at.desc&limit=50'),
      optionalJson('release_clearance_items?select=id,release_id,material_type,risk_level,title,status,required,created_at&order=created_at.desc&limit=200'),
      optionalJson('release_rights_attestations?select=id,release_id,user_id,agreement_version,attested_at&order=attested_at.desc&limit=100'),
    ])
    : [[], [], []]
  return {
    releases,
    releaseTracks,
    releaseContributors,
    releaseClearanceEvidence,
    mediaProcessingJobs,
    distributionJobs,
    knownIsrcMap,
    copyrightComplaints,
    releaseClearanceItems,
    releaseAttestations,
  }
}

async function loadProfilesSection() {
  const profilesRes = await fetch(
    editorialUrl(
      'profiles?select=id,username,display_name,avatar_url,bio,website_url,location,role,is_producer,is_verified,is_published,spotify_url,created_at,creator_public_name,creator_name_request,creator_name_status,creator_name_review_notes,creator_name_reviewed_at&order=created_at.desc&limit=200',
    ),
    { headers: serviceHeaders, cache: 'no-store' },
  )
  if (!profilesRes.ok) throw new Error('MIGRATION')
  const rawProfiles = await profilesRes.json() as Array<Record<string, unknown>>
  const [roleApplications, artistDetails] = await Promise.all([
    optionalJson('profile_role_applications?select=*&order=updated_at.desc&limit=100'),
    optionalJson('artist_waitlist?onboarded_profile_id=not.is.null&select=onboarded_profile_id,artist_name,country,city,links,status&order=updated_at.desc&limit=500'),
  ])
  const detailsByProfile = new Map(
    (artistDetails as Array<Record<string, unknown>>).map((details) => [String(details.onboarded_profile_id), details]),
  )
  const profiles = rawProfiles.map((profile) => {
    const details = detailsByProfile.get(String(profile.id))
    return {
      ...profile,
      onboarding_artist_name: details?.artist_name || null,
      onboarding_status: details?.status || null,
      onboarding_location: [details?.city, details?.country].filter(Boolean).join(', ') || null,
      social_links: details?.links || {},
    }
  })
  return { profiles, roleApplications }
}

async function loadProgrammesSection() {
  const programmesRes = await fetch(editorialUrl('programmes?select=*&order=updated_at.desc&limit=100'), {
    headers: serviceHeaders,
    cache: 'no-store',
  })
  if (!programmesRes.ok) throw new Error('MIGRATION')
  return { programmes: await programmesRes.json() }
}

async function loadWalletSection(identity: Awaited<ReturnType<typeof editorialIdentity>>) {
  if (!identity || !can(identity, 'manage_artist_wallet')) {
    return { artistWaitlist: [], artistDeposits: [], artistPayoutRequests: [] }
  }
  const [artistWaitlist, artistDeposits, artistPayoutRequests] = await Promise.all([
    optionalJson('artist_waitlist?select=*&order=created_at.desc&limit=100'),
    optionalJson('artist_deposits?select=*&order=created_at.desc&limit=100'),
    optionalJson('artist_payout_requests?select=*&order=requested_at.desc&limit=100'),
  ])
  return { artistWaitlist, artistDeposits, artistPayoutRequests }
}

async function lightCounts() {
  // Cheap head-style counts via limited selects when full lists are not loaded.
  const [tracks, beats, releases, profiles, programmes] = await Promise.all([
    optionalJson('tracks?reclassified_to_beat_id=is.null&select=id&limit=1'),
    optionalJson('beats?select=id&limit=1'),
    optionalJson('releases?select=id&limit=1'),
    optionalJson('profiles?select=id&limit=1'),
    optionalJson('programmes?select=id&limit=1'),
  ])
  // PostgREST does not return total without Prefer count; expose presence flags + 0|1 sample.
  return {
    tracksSample: Array.isArray(tracks) ? tracks.length : 0,
    beatsSample: Array.isArray(beats) ? beats.length : 0,
    releasesSample: Array.isArray(releases) ? releases.length : 0,
    profilesSample: Array.isArray(profiles) ? profiles.length : 0,
    programmesSample: Array.isArray(programmes) ? programmes.length : 0,
  }
}

export async function GET(request: Request) {
  const hasBearer = Boolean(request.headers.get('authorization')?.replace(/^Bearer\s+/i, ''))
  const identity = await editorialIdentity(request)
  if (!identity) {
    return NextResponse.json(
      {
        error: hasBearer
          ? 'Editorial access required. Your account is signed in but not on the editorial staff list. Owner accounts are auto-promoted; try Refresh. Otherwise ask a BVS admin to assign your role.'
          : 'Sign in required for editorial.',
      },
      { status: hasBearer ? 403 : 401 },
    )
  }

  const url = new URL(request.url)
  const rawSection = (url.searchParams.get('section') || 'all').toLowerCase().trim()
  const section = (rawSection || 'all') as EditorialSection
  const identityPayload = {
    role: identity.role,
    permissions: identity.permissions,
    profile: identity.profile,
  }

  try {
    if (section === 'bootstrap' || section === 'overview') {
      const { staff, auditLog } = await loadStaffAndAudit()
      const counts = section === 'overview' ? await lightCounts() : undefined
      // Do not include empty list keys — client merges by presence and must not wipe loaded sections.
      return NextResponse.json({
        section,
        identity: identityPayload,
        staff,
        auditLog,
        ...(counts ? { counts } : {}),
      })
    }

    if (section === 'tracks') {
      const data = await loadTracksSection()
      return NextResponse.json({ section, identity: identityPayload, ...data })
    }
    if (section === 'beats') {
      const data = await loadBeatsSection()
      return NextResponse.json({ section, identity: identityPayload, ...data })
    }
    if (section === 'releases') {
      const data = await loadReleasesSection(identity)
      return NextResponse.json({ section, identity: identityPayload, ...data })
    }
    if (section === 'profiles') {
      const data = await loadProfilesSection()
      return NextResponse.json({ section, identity: identityPayload, ...data })
    }
    if (section === 'programmes') {
      const data = await loadProgrammesSection()
      return NextResponse.json({ section, identity: identityPayload, ...data })
    }
    if (section === 'wallet') {
      const data = await loadWalletSection(identity)
      return NextResponse.json({ section, identity: identityPayload, ...data })
    }

    // section=all or unknown → full backward-compatible payload
    const [{ staff, auditLog }, tracksPart, beatsPart, releasesPart, profilesPart, programmesPart, walletPart] =
      await Promise.all([
        loadStaffAndAudit(),
        loadTracksSection(),
        loadBeatsSection(),
        loadReleasesSection(identity),
        loadProfilesSection(),
        loadProgrammesSection(),
        loadWalletSection(identity),
      ])
    return NextResponse.json({
      section: 'all',
      identity: identityPayload,
      staff,
      auditLog,
      ...tracksPart,
      ...beatsPart,
      ...releasesPart,
      ...profilesPart,
      ...programmesPart,
      ...walletPart,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'MIGRATION') {
      return NextResponse.json(
        { error: 'Editorial migration is not ready. Run supabase-editorial-workflow.sql.' },
        { status: 503 },
      )
    }
    throw error
  }
}

type ActionBody = { action?: string; [key: string]: unknown }

export async function PATCH(request: Request) {
  const identity = await editorialIdentity(request)
  if (!identity) return NextResponse.json({ error: 'Editorial access required' }, { status: 403 })
  const body = await request.json() as ActionBody
  const requirePermission = (permission: EditorialPermission) => {
    if (!can(identity, permission)) throw new Error('FORBIDDEN')
  }
  try {
    switch (body.action) {
      case 'review_track': {
        requirePermission('approve_submissions')
        const trackId = String(body.trackId || '')
        const status = body.status === 'approved' ? 'approved' : body.status === 'rejected' ? 'rejected' : 'in_review'
        const previous = (await optionalJson(
          `tracks?id=eq.${encodeURIComponent(trackId)}&select=user_id,title,editorial_status&limit=1`,
        ))[0] as { user_id?: string; title?: string; editorial_status?: string } | undefined
        const result = await patchTable('tracks', `id=eq.${encodeURIComponent(trackId)}`, { editorial_status: status, editorial_notes: String(body.notes || '').slice(0, 2000), reviewed_by: identity.user.id, reviewed_at: new Date().toISOString(), ...(status === 'rejected' ? { is_public: false, in_rotation: false } : {}) })
        await audit(identity.user.id, `track_${status}`, 'track', trackId, { notes: String(body.notes || '').slice(0, 300) })
        if (status === 'approved' && previous?.editorial_status !== 'approved') {
          await notifyApproval({ userId: previous?.user_id, title: previous?.title, kind: 'track' })
        }
        return NextResponse.json({ result })
      }
      case 'message_track': {
        requirePermission('approve_submissions')
        const trackId = String(body.trackId || '')
        const message = String(body.message || '').trim().slice(0, 2000)
        if (!trackId || !message) {
          return NextResponse.json({ error: 'Track and message are required.' }, { status: 400 })
        }
        const tracks = await optionalJson(
          `tracks?id=eq.${encodeURIComponent(trackId)}&reclassified_to_beat_id=is.null&select=id&limit=1`,
        )
        if (!tracks[0]) return NextResponse.json({ error: 'Track submission not found.' }, { status: 404 })
        const result = await jsonOrError(await fetch(editorialUrl('track_review_messages'), {
          method: 'POST',
          headers: { ...serviceHeaders, Prefer: 'return=representation' },
          body: JSON.stringify({
            track_id: trackId,
            author_user_id: identity.user.id,
            author_kind: 'editor',
            message,
          }),
        }))
        await audit(identity.user.id, 'track_message_sent', 'track', trackId)
        return NextResponse.json({ result })
      }
      case 'reclassify_track_as_beat': {
        requirePermission('approve_submissions')
        const trackId = String(body.trackId || '')
        if (!trackId) return NextResponse.json({ error: 'Track is required.' }, { status: 400 })
        const source = (await optionalJson(
          `tracks?id=eq.${encodeURIComponent(trackId)}&select=id,title,user_id,reclassified_to_beat_id&limit=1`,
        ))[0] as { id?: string; title?: string; user_id?: string; reclassified_to_beat_id?: string } | undefined
        if (!source) return NextResponse.json({ error: 'Track submission not found.' }, { status: 404 })
        const result = await jsonOrError(await fetch(editorialUrl('rpc/reclassify_track_as_beat'), {
          method: 'POST',
          headers: { ...serviceHeaders, Prefer: 'return=representation' },
          body: JSON.stringify({ p_track_id: trackId, p_editor_id: identity.user.id }),
        }))
        const beatId = typeof result === 'string' ? result : source.reclassified_to_beat_id
        await audit(identity.user.id, 'track_reclassified_as_beat', 'track', trackId, { beatId })
        return NextResponse.json({ beatId })
      }
      case 'publish_track': {
        requirePermission('approve_submissions')
        const trackId = String(body.trackId || '')
        const publish = Boolean(body.publish)
        const result = await patchTable('tracks', `id=eq.${encodeURIComponent(trackId)}&editorial_status=eq.approved`, { is_public: publish, ...(publish ? {} : { in_rotation: false }) })
        if (!result?.length) return NextResponse.json({ error: 'Only approved tracks can be published.' }, { status: 409 })
        await audit(identity.user.id, publish ? 'track_published' : 'track_unpublished', 'track', trackId)
        return NextResponse.json({ result })
      }
      case 'set_rotation': {
        requirePermission('manage_rotation')
        const trackId = String(body.trackId || '')
        const enabled = Boolean(body.enabled)
        const result = await patchTable('tracks', `id=eq.${encodeURIComponent(trackId)}&editorial_status=eq.approved&is_public=eq.true`, { in_rotation: enabled, rotation_added_at: enabled ? new Date().toISOString() : null })
        if (!result?.length) return NextResponse.json({ error: 'Publish an approved track before adding it to rotation.' }, { status: 409 })
        await audit(identity.user.id, enabled ? 'rotation_added' : 'rotation_removed', 'track', trackId)
        return NextResponse.json({ result })
      }
      case 'set_mobile_clearance': {
        requirePermission('approve_submissions')
        const trackId = String(body.trackId || '')
        const surface = String(body.surface || '')
        const status = String(body.status || '')
        const rightsBasis = String(body.rightsBasis || '').trim().slice(0, 120)
        const evidenceReference = String(body.evidenceReference || '').trim().slice(0, 500)
        const notes = String(body.notes || '').trim().slice(0, 2000)
        if (!trackId || !['ios', 'android'].includes(surface) || !['not_reviewed', 'cleared', 'blocked'].includes(status)) {
          return NextResponse.json({ error: 'Track, surface and valid clearance status are required.' }, { status: 400 })
        }
        if (status === 'cleared' && (!rightsBasis || !evidenceReference)) {
          return NextResponse.json({ error: 'A rights basis and evidence reference are required before mobile clearance.' }, { status: 400 })
        }
        const track = (await optionalJson(
          `tracks?id=eq.${encodeURIComponent(trackId)}&select=id,title,editorial_status,is_public&limit=1`,
        ))[0] as { id?: string; title?: string; editorial_status?: string; is_public?: boolean } | undefined
        if (!track) return NextResponse.json({ error: 'Track not found.' }, { status: 404 })
        if (status === 'cleared' && (track.editorial_status !== 'approved' || !track.is_public)) {
          return NextResponse.json({ error: 'Approve and publish the track before clearing it for a mobile store.' }, { status: 409 })
        }
        const now = new Date().toISOString()
        const result = await jsonOrError(await fetch(editorialUrl('mobile_distribution_clearances?on_conflict=track_id,surface'), {
          method: 'POST',
          headers: { ...serviceHeaders, Prefer: 'resolution=merge-duplicates,return=representation' },
          body: JSON.stringify({
            track_id: trackId,
            surface,
            status,
            rights_basis: rightsBasis,
            evidence_reference: evidenceReference,
            review_notes: notes,
            reviewed_by: identity.user.id,
            reviewed_at: now,
            updated_at: now,
          }),
        }))
        await audit(identity.user.id, `mobile_${surface}_${status}`, 'track', trackId, {
          title: track.title,
          rightsBasis,
          evidenceReference,
        })
        return NextResponse.json({ result })
      }
      case 'publish_artist': {
        requirePermission('publish_artists')
        const profileId = String(body.profileId || '')
        const publish = Boolean(body.publish)
        const result = await patchTable('profiles', `id=eq.${encodeURIComponent(profileId)}`, { is_published: publish, is_verified: publish })
        await audit(identity.user.id, publish ? 'artist_published' : 'artist_unpublished', 'profile', profileId)
        return NextResponse.json({ result })
      }
      case 'set_producer': {
        requirePermission('publish_artists')
        const profileId = String(body.profileId || '')
        if (!profileId) return NextResponse.json({ error: 'Profile is required.' }, { status: 400 })
        const enabled = body.enabled === true
        const result = await patchTable('profiles', `id=eq.${encodeURIComponent(profileId)}`, { is_producer: enabled })
        await audit(identity.user.id, enabled ? 'producer_enabled' : 'producer_disabled', 'profile', profileId)
        return NextResponse.json({ result })
      }
      case 'review_creator_name': {
        requirePermission('publish_artists')
        const profileId = String(body.profileId || '')
        const decision = String(body.decision || '')
        const requestedPublicName = String(body.publicName || '').trim().slice(0, 120)
        const notes = String(body.notes || '').trim().slice(0, 2000)
        if (!profileId || !['approved', 'changes_requested', 'rejected'].includes(decision)) {
          return NextResponse.json({ error: 'Choose a valid public-name review decision.' }, { status: 400 })
        }
        if (decision === 'approved' && !requestedPublicName) {
          return NextResponse.json({ error: 'Enter the public artist or producer name to approve.' }, { status: 400 })
        }
        if (decision !== 'approved' && notes.length < 3) {
          return NextResponse.json({ error: 'Add a note explaining what the creator should change.' }, { status: 400 })
        }
        const profile = (await optionalJson(
          `profiles?id=eq.${encodeURIComponent(profileId)}&select=id,username,role,is_producer,creator_public_name,creator_name_request&limit=1`,
        ))[0] as { id?: string; username?: string; role?: string; is_producer?: boolean; creator_public_name?: string; creator_name_request?: string } | undefined
        if (!profile) return NextResponse.json({ error: 'Creator profile not found.' }, { status: 404 })
        if (profile.role !== 'artist' && !profile.is_producer) {
          return NextResponse.json({ error: 'Public creator names are only available to artist or producer accounts.' }, { status: 409 })
        }
        const now = new Date().toISOString()
        const result = await patchTable('profiles', `id=eq.${encodeURIComponent(profileId)}`, {
          creator_name_request: requestedPublicName || profile.creator_name_request || null,
          creator_name_status: decision,
          creator_name_review_notes: notes || null,
          creator_name_reviewed_by: identity.user.id,
          creator_name_reviewed_at: now,
          ...(decision === 'approved' ? { creator_public_name: requestedPublicName } : {}),
          updated_at: now,
        })
        await audit(identity.user.id, `creator_name_${decision}`, 'profile', profileId, {
          username: profile.username,
          approvedPublicName: decision === 'approved' ? requestedPublicName : undefined,
        })
        return NextResponse.json({ result })
      }
      case 'review_role_application': {
        requirePermission('publish_artists')
        const applicationId = String(body.applicationId || '')
        const decision = String(body.decision || '')
        const notes = String(body.notes || '').trim().slice(0, 2000)
        if (!applicationId || !['approved', 'rejected', 'information_requested'].includes(decision)) {
          return NextResponse.json({ error: 'Choose a valid role-application decision.' }, { status: 400 })
        }
        if (decision !== 'approved' && notes.length < 3) {
          return NextResponse.json({ error: 'Add a note explaining what the member needs to provide or why the request was rejected.' }, { status: 400 })
        }
        const application = (await optionalJson(
          `profile_role_applications?id=eq.${encodeURIComponent(applicationId)}&select=id,user_id,requested_role,status&limit=1`,
        ))[0] as { id: string; user_id: string; requested_role: string; status: string } | undefined
        if (!application) return NextResponse.json({ error: 'Role application not found.' }, { status: 404 })

        if (decision === 'approved') {
          const profilePatch = application.requested_role === 'producer'
            ? { is_producer: true }
            : { role: application.requested_role }
          const profiles = await patchTable('profiles', `id=eq.${encodeURIComponent(application.user_id)}`, profilePatch)
          if (!profiles?.length) return NextResponse.json({ error: 'Member profile not found.' }, { status: 404 })
        }

        const now = new Date().toISOString()
        const result = await patchTable('profile_role_applications', `id=eq.${encodeURIComponent(applicationId)}`, {
          status: decision,
          review_notes: notes || null,
          reviewed_by: identity.user.id,
          reviewed_at: now,
          updated_at: now,
        })
        await audit(identity.user.id, `role_application_${decision}`, 'profile_role_application', applicationId, {
          userId: application.user_id,
          requestedRole: application.requested_role,
        })
        return NextResponse.json({ result })
      }
      case 'manage_license': {
        requirePermission('manage_licensing')
        const trackId = String(body.trackId || '')
        const price = Math.max(0, Math.min(100000, Number(body.price) || 0))
        const allowedLicenceTypes = [
          'not_for_sale',
          'personal_download',
          'standard_lease',
          'premium_lease',
          'exclusive',
          'free_download',
          'custom',
        ]
        const licenceType = allowedLicenceTypes.includes(String(body.licenceType))
          ? String(body.licenceType)
          : 'not_for_sale'
        const result = await patchTable('tracks', `id=eq.${encodeURIComponent(trackId)}`, {
          licence_type: licenceType,
          licence_summary: String(body.summary || '').slice(0, 2000),
          download_price: price,
          is_downloadable: licenceType !== 'not_for_sale' && licenceType !== 'free_download'
            ? true
            : licenceType === 'free_download',
        })
        await audit(identity.user.id, 'licence_updated', 'track', trackId, { licence_type: licenceType, price })
        return NextResponse.json({ result })
      }
      case 'add_credit': {
        requirePermission('verify_credits')
        const trackId = String(body.trackId || '')
        const personName = String(body.personName || '').trim().slice(0, 160)
        const creditRole = String(body.creditRole || '').trim().slice(0, 120)
        if (!trackId || !personName || !creditRole) return NextResponse.json({ error: 'Track, person and credit role are required.' }, { status: 400 })
        const result = await jsonOrError(await fetch(editorialUrl('track_credits?on_conflict=track_id,person_name,credit_role'), { method: 'POST', headers: { ...serviceHeaders, Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify({ track_id: trackId, person_name: personName, credit_role: creditRole, profile_url: body.profileUrl ? String(body.profileUrl).slice(0, 500) : null, is_verified: true, verified_by: identity.user.id }) }))
        await audit(identity.user.id, 'credit_verified', 'track', trackId, { person_name: personName, credit_role: creditRole })
        return NextResponse.json({ result })
      }
      case 'save_programme': {
        requirePermission('schedule_programmes')
        const title = String(body.title || '').trim().slice(0, 160)
        const slug = String(body.slug || title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 120)
        if (!title || !slug || !body.dayLabel) return NextResponse.json({ error: 'Title and day are required.' }, { status: 400 })
        const status = ['draft', 'scheduled', 'active', 'archived'].includes(String(body.status)) ? String(body.status) : 'draft'
        const result = await jsonOrError(await fetch(editorialUrl('programmes?on_conflict=slug'), { method: 'POST', headers: { ...serviceHeaders, Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify({ slug, title, tagline: String(body.tagline || '').slice(0, 240), description: String(body.description || '').slice(0, 3000), host: String(body.host || 'BVS Radio').slice(0, 160), image_url: String(body.imageUrl || '').slice(0, 500) || null, day_label: String(body.dayLabel).slice(0, 80), start_time: body.startTime || null, timezone: String(body.timezone || 'Africa/Harare').slice(0, 80), status, updated_by: identity.user.id, created_by: identity.user.id, updated_at: new Date().toISOString() }) }))
        await audit(identity.user.id, 'programme_saved', 'programme', slug, { status })
        return NextResponse.json({ result })
      }
      case 'assign_staff': {
        requirePermission('manage_staff')
        const userId = String(body.userId || '')
        const role = String(body.role || '') as EditorialRole
        const active = body.active !== false
        if (!userId) return NextResponse.json({ error: 'Choose a staff account.' }, { status: 400 })
        if (!['administrator', 'editor', 'programmer', 'credits_editor', 'commerce_manager'].includes(role)) return NextResponse.json({ error: 'Invalid staff role.' }, { status: 400 })
        const currentRows = await optionalJson(
          `editorial_staff?user_id=eq.${encodeURIComponent(userId)}&select=user_id,role,active&limit=1`,
        ) as Array<{ user_id: string; role: EditorialRole; active: boolean }>
        const current = currentRows[0]
        if (current?.role === 'founder') {
          return NextResponse.json(
            { error: 'The Founder role is the protected highest-authority account and cannot be changed here.' },
            { status: 403 },
          )
        }
        if (current?.active && current.role === 'administrator' && (!active || role !== 'administrator')) {
          const activeAdmins = await optionalJson(
            'editorial_staff?role=eq.administrator&active=eq.true&select=user_id&limit=2',
          ) as Array<{ user_id: string }>
          if (activeAdmins.length <= 1) {
            return NextResponse.json(
              { error: 'Keep at least one active administrator before changing this role.' },
              { status: 409 },
            )
          }
        }
        const result = await jsonOrError(await fetch(editorialUrl('editorial_staff?on_conflict=user_id'), { method: 'POST', headers: { ...serviceHeaders, Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify({ user_id: userId, role, active, appointed_by: identity.user.id, updated_at: new Date().toISOString() }) }))
        await audit(identity.user.id, current ? 'staff_updated' : 'staff_assigned', 'profile', userId, {
          previousRole: current?.role || null,
          previousActive: current?.active ?? null,
          role,
          active,
        })
        return NextResponse.json({ result })
      }
      case 'review_track_request': {
        requirePermission('approve_submissions')
        const requestId = String(body.requestId || '')
        const status = ['reviewing', 'resolved', 'rejected'].includes(String(body.status)) ? String(body.status) : 'reviewing'
        const result = await patchTable('track_review_requests', `id=eq.${encodeURIComponent(requestId)}`, { status, staff_notes: String(body.notes || '').slice(0, 2000), reviewed_by: identity.user.id, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        await audit(identity.user.id, `track_request_${status}`, 'track_review_request', requestId)
        return NextResponse.json({ result })
      }
      case 'publish_release': {
        requirePermission('approve_submissions')
        const { materializeReleaseTracks } = await import('@/lib/releases-server')
        const { normalizeIsrc } = await import('@/lib/known-isrc')
        const releaseId = String(body.releaseId || '')
        const inRotation = body.inRotation !== false
        const rotationReleaseTrackIds = Array.isArray(body.rotationReleaseTrackIds)
          ? body.rotationReleaseTrackIds.map(String).filter(Boolean).slice(0, 200)
          : undefined
        const trackIsrcs = Array.isArray(body.trackIsrcs)
          ? (body.trackIsrcs as Array<Record<string, unknown>>)
              .map((row) => ({
                releaseTrackId: String(row.releaseTrackId || row.id || '').trim(),
                isrc: normalizeIsrc(String(row.isrc || '')),
              }))
              .filter((row) => row.releaseTrackId && row.isrc)
              .slice(0, 200)
          : undefined
        const notes = String(body.notes || '').slice(0, 2000)
        if (!releaseId) return NextResponse.json({ error: 'releaseId required.' }, { status: 400 })
        const previous = (await optionalJson(
          `releases?id=eq.${encodeURIComponent(releaseId)}&select=user_id,title,editorial_status&limit=1`,
        ))[0] as { user_id?: string; title?: string; editorial_status?: string } | undefined
        if (notes) {
          await patchTable('releases', `id=eq.${encodeURIComponent(releaseId)}`, { editorial_notes: notes })
        }
        const result = await materializeReleaseTracks(releaseId, {
          publish: true,
          inRotation,
          rotationReleaseTrackIds,
          trackIsrcs,
          reviewedBy: identity.user.id,
        })
        if (!result.ok) return NextResponse.json({ error: result.error || 'Publish failed.' }, { status: 400 })
        await audit(identity.user.id, 'release_published', 'release', releaseId, {
          inRotation,
          rotationTrackCount: rotationReleaseTrackIds?.length ?? (inRotation ? result.trackCount : 0),
          trackCount: result.trackCount,
        })
        if (previous?.editorial_status !== 'approved') {
          await notifyApproval({ userId: previous?.user_id, title: previous?.title, kind: 'release' })
        }
        return NextResponse.json({ result })
      }
      case 'review_release_clearance_evidence': {
        requirePermission('approve_submissions')
        const evidenceId = String(body.evidenceId || '')
        const status = String(body.status || '')
        const notes = String(body.notes || '').slice(0, 2000)
        if (!evidenceId || !['approved', 'rejected'].includes(status)) {
          return NextResponse.json({ error: 'Evidence and a valid decision are required.' }, { status: 400 })
        }
        const existing = (await optionalJson(`release_clearance_evidence?id=eq.${encodeURIComponent(evidenceId)}&select=release_id,material_type&limit=1`))[0] as { release_id?: string; material_type?: string } | undefined
        if (!existing?.release_id) return NextResponse.json({ error: 'Clearance evidence not found.' }, { status: 404 })
        const result = await patchTable('release_clearance_evidence', `id=eq.${encodeURIComponent(evidenceId)}`, {
          review_status: status,
          review_notes: notes || null,
          reviewed_by: identity.user.id,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        await jsonOrError(await fetch(editorialUrl('rpc/refresh_release_preflight'), {
          method: 'POST', headers: serviceHeaders, body: JSON.stringify({ p_release_id: existing.release_id }),
        }))
        await audit(identity.user.id, `release_clearance_${status}`, 'release_clearance_evidence', evidenceId, {
          releaseId: existing.release_id, materialType: existing.material_type,
        })
        return NextResponse.json({ result })
      }
      case 'update_release_rotation': {
        requirePermission('manage_rotation')
        const releaseId = String(body.releaseId || '')
        const selectedReleaseTrackIds = Array.isArray(body.rotationReleaseTrackIds)
          ? [...new Set(body.rotationReleaseTrackIds.map(String).filter(Boolean).slice(0, 200))]
          : []
        if (!releaseId) return NextResponse.json({ error: 'releaseId required.' }, { status: 400 })

        const releases = await optionalJson(
          `releases?id=eq.${encodeURIComponent(releaseId)}&is_public=eq.true&select=id&limit=1`,
        )
        if (!releases[0]) return NextResponse.json({ error: 'Publish the album before editing its rotation.' }, { status: 409 })

        const members = await optionalJson(
          `release_tracks?release_id=eq.${encodeURIComponent(releaseId)}&select=id,track_id`,
        ) as Array<{ id: string; track_id?: string | null }>
        const memberIds = new Set(members.map((member) => member.id))
        if (selectedReleaseTrackIds.some((id) => !memberIds.has(id))) {
          return NextResponse.json({ error: 'One or more selected tracks do not belong to this album.' }, { status: 400 })
        }

        const selectedMemberIds = new Set(selectedReleaseTrackIds)
        const now = new Date().toISOString()
        await Promise.all(members.filter((member) => member.track_id).map((member) => {
          const enabled = selectedMemberIds.has(member.id)
          return patchTable('tracks', `id=eq.${encodeURIComponent(String(member.track_id))}&is_public=eq.true`, {
            in_rotation: enabled,
            rotation_added_at: enabled ? now : null,
          })
        }))
        await patchTable('releases', `id=eq.${encodeURIComponent(releaseId)}`, {
          in_rotation: selectedReleaseTrackIds.length > 0,
          updated_at: now,
        })
        await audit(identity.user.id, 'release_rotation_updated', 'release', releaseId, {
          rotationTrackCount: selectedReleaseTrackIds.length,
        })
        return NextResponse.json({ selected: selectedReleaseTrackIds.length })
      }
      case 'reject_release': {
        requirePermission('approve_submissions')
        const releaseId = String(body.releaseId || '')
        const notes = String(body.notes || '').slice(0, 2000)
        if (!releaseId) return NextResponse.json({ error: 'releaseId required.' }, { status: 400 })
        const result = await patchTable('releases', `id=eq.${encodeURIComponent(releaseId)}`, {
          editorial_status: 'rejected',
          editorial_notes: notes,
          is_public: false,
          in_rotation: false,
          reviewed_by: identity.user.id,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        await audit(identity.user.id, 'release_rejected', 'release', releaseId, { notes: notes.slice(0, 200) })
        return NextResponse.json({ result })
      }
      case 'set_release_rotation': {
        requirePermission('manage_rotation')
        const releaseId = String(body.releaseId || '')
        const enabled = Boolean(body.enabled)
        if (!releaseId) return NextResponse.json({ error: 'releaseId required.' }, { status: 400 })
        const result = await patchTable(
          'releases',
          `id=eq.${encodeURIComponent(releaseId)}&editorial_status=eq.approved&is_public=eq.true`,
          { in_rotation: enabled, updated_at: new Date().toISOString() },
        )
        await patchTable('tracks', `release_id=eq.${encodeURIComponent(releaseId)}&editorial_status=eq.approved`, {
          in_rotation: enabled,
          rotation_added_at: enabled ? new Date().toISOString() : null,
        })
        await audit(identity.user.id, enabled ? 'release_rotation_on' : 'release_rotation_off', 'release', releaseId)
        return NextResponse.json({ result })
      }
      case 'update_distribution_job': {
        requirePermission('manage_artist_wallet')
        const jobId = String(body.jobId || '')
        const status = String(body.status || '')
        const allowed = ['not_eligible', 'eligible', 'queued', 'submitted', 'live_on_dsp', 'failed', 'cancelled']
        if (!jobId || !allowed.includes(status)) {
          return NextResponse.json({ error: 'jobId and valid status required.' }, { status: 400 })
        }
        const result = await patchTable('distribution_jobs', `id=eq.${encodeURIComponent(jobId)}`, {
          status,
          distributor: body.distributor ? String(body.distributor).slice(0, 120) : null,
          notes: body.notes != null ? String(body.notes).slice(0, 2000) : undefined,
          updated_at: new Date().toISOString(),
        })
        await audit(identity.user.id, 'distribution_job_updated', 'distribution_job', jobId, { status })
        return NextResponse.json({ result })
      }
      case 'review_beat': {
        requirePermission('approve_submissions')
        const beatId = String(body.beatId || '')
        const status =
          body.status === 'approved'
            ? 'approved'
            : body.status === 'rejected'
              ? 'rejected'
              : body.status === 'changes_requested'
                ? 'changes_requested'
                : 'in_review'
        const previous = (await optionalJson(
          `beats?id=eq.${encodeURIComponent(beatId)}&select=producer_user_id,title,status&limit=1`,
        ))[0] as { producer_user_id?: string; title?: string; status?: string } | undefined
        const result = await patchTable('beats', `id=eq.${encodeURIComponent(beatId)}`, {
          status,
          editorial_notes: String(body.notes || '').slice(0, 2000),
          reviewed_by: identity.user.id,
          reviewed_at: new Date().toISOString(),
          ...(status === 'rejected' || status === 'changes_requested'
            ? { is_public: false }
            : {}),
          updated_at: new Date().toISOString(),
        })
        const reviewNote = String(body.notes || '').trim().slice(0, 2000)
        if (reviewNote) {
          await jsonOrError(await fetch(editorialUrl('beat_review_messages'), {
            method: 'POST',
            headers: { ...serviceHeaders, Prefer: 'return=representation' },
            body: JSON.stringify({
              beat_id: beatId,
              author_user_id: identity.user.id,
              author_kind: 'editor',
              message: reviewNote,
            }),
          }))
        }
        await audit(identity.user.id, `beat_${status}`, 'beat', beatId, {
          notes: String(body.notes || '').slice(0, 300),
        })
        if (status === 'approved' && previous?.status !== 'approved' && previous?.status !== 'published') {
          await notifyApproval({ userId: previous?.producer_user_id, title: previous?.title, kind: 'beat' })
        }
        return NextResponse.json({ result })
      }
      case 'message_beat': {
        requirePermission('approve_submissions')
        const beatId = String(body.beatId || '')
        const message = String(body.message || '').trim().slice(0, 2000)
        if (!beatId || !message) {
          return NextResponse.json({ error: 'Beat and message are required.' }, { status: 400 })
        }
        const result = await jsonOrError(await fetch(editorialUrl('beat_review_messages'), {
          method: 'POST',
          headers: { ...serviceHeaders, Prefer: 'return=representation' },
          body: JSON.stringify({
            beat_id: beatId,
            author_user_id: identity.user.id,
            author_kind: 'editor',
            message,
          }),
        }))
        await audit(identity.user.id, 'beat_message_sent', 'beat', beatId)
        return NextResponse.json({ result })
      }
      case 'assign_beat_producer': {
        requirePermission('approve_submissions')
        const beatId = String(body.beatId || '')
        const producerUserId = String(body.producerUserId || '')
        if (!beatId || !producerUserId) {
          return NextResponse.json({ error: 'Beat and producer are required.' }, { status: 400 })
        }
        const profiles = await optionalJson(
          `profiles?id=eq.${encodeURIComponent(producerUserId)}&select=id,is_producer,role&limit=1`,
        )
        if (!profiles?.[0]) return NextResponse.json({ error: 'Producer profile not found.' }, { status: 404 })
        await patchTable('profiles', `id=eq.${encodeURIComponent(producerUserId)}`, { is_producer: true })
        const result = await patchTable('beats', `id=eq.${encodeURIComponent(beatId)}`, {
          producer_user_id: producerUserId,
          updated_at: new Date().toISOString(),
        })
        await audit(identity.user.id, 'beat_producer_assigned', 'beat', beatId, { producerUserId })
        return NextResponse.json({ result })
      }
      case 'publish_beat': {
        requirePermission('approve_submissions')
        const beatId = String(body.beatId || '')
        const publish = Boolean(body.publish)
        const beat = (await optionalJson(
          `beats?id=eq.${encodeURIComponent(beatId)}&select=id,producer_user_id,is_public,status&limit=1`,
        ))[0] as { id?: string; producer_user_id?: string; is_public?: boolean; status?: string } | undefined
        if (!beat?.producer_user_id) {
          return NextResponse.json({ error: 'Beat or producer profile not found.' }, { status: 404 })
        }
        if (publish) {
          const alreadyLive = Boolean(beat.is_public) && String(beat.status) === 'published'
          const gate = await assertCanPublishLiveBeat({
            producerUserId: beat.producer_user_id,
            beatId,
            alreadyLive,
          })
          if (!gate.ok) {
            return NextResponse.json(
              {
                error: gate.error,
                entitlements: gate.entitlements,
              },
              { status: 409 },
            )
          }
        }
        const result = await patchTable(
          'beats',
          `id=eq.${encodeURIComponent(beatId)}&status=in.(approved,published)`,
          {
            is_public: publish,
            status: publish ? 'published' : 'approved',
            published_at: publish ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
          },
        )
        if (!result?.length) {
          return NextResponse.json(
            { error: 'Only approved beats can be published.' },
            { status: 409 },
          )
        }
        if (publish) {
          const profiles = await patchTable(
            'profiles',
            `id=eq.${encodeURIComponent(beat.producer_user_id)}`,
            {
              is_producer: true,
              is_published: true,
              is_verified: true,
              updated_at: new Date().toISOString(),
            },
          )
          if (!profiles?.length) {
            return NextResponse.json({ error: 'Producer profile could not be published.' }, { status: 409 })
          }
        }
        await audit(identity.user.id, publish ? 'beat_published' : 'beat_unpublished', 'beat', beatId)
        return NextResponse.json({ result })
      }
      default: return NextResponse.json({ error: 'Unknown editorial action.' }, { status: 400 })
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'FORBIDDEN') return NextResponse.json({ error: 'Your editorial role cannot perform this action.' }, { status: 403 })
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Editorial action failed.' }, { status: 500 })
  }
}
