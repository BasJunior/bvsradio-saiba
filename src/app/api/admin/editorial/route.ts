import { NextResponse } from 'next/server'
import { audit, can, editorialIdentity, editorialUrl, serviceHeaders } from '@/lib/editorial-server'
import type { EditorialPermission, EditorialRole } from '@/lib/editorial'

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
  const requests = [
    fetch(editorialUrl('tracks?select=id,user_id,title,artist_name,genre,description,file_url,artwork_url,is_public,is_featured,is_downloadable,download_price,editorial_status,editorial_notes,in_rotation,licence_type,licence_summary,created_at&order=created_at.desc&limit=100'), { headers: serviceHeaders, cache: 'no-store' }),
    fetch(editorialUrl('profiles?select=id,username,display_name,role,is_verified,is_published&order=created_at.desc&limit=200'), { headers: serviceHeaders, cache: 'no-store' }),
    fetch(editorialUrl('programmes?select=*&order=updated_at.desc&limit=100'), { headers: serviceHeaders, cache: 'no-store' }),
    fetch(editorialUrl('track_credits?select=*&order=created_at.desc&limit=100'), { headers: serviceHeaders, cache: 'no-store' }),
    fetch(editorialUrl('editorial_staff?select=user_id,role,active,created_at&order=created_at.desc'), { headers: serviceHeaders, cache: 'no-store' }),
    fetch(editorialUrl('editorial_audit_log?select=*&order=created_at.desc&limit=30'), { headers: serviceHeaders, cache: 'no-store' }),
  ]
  const responses = await Promise.all(requests)
  if (responses.some((response) => !response.ok)) return NextResponse.json({ error: 'Editorial migration is not ready. Run supabase-editorial-workflow.sql.' }, { status: 503 })
  const [tracks, profiles, programmes, credits, staff, auditLog] = await Promise.all(responses.map((response) => response.json()))
  const trackRequests = await optionalJson('track_review_requests?select=*&order=created_at.desc&limit=100')
  const beats = await optionalJson(
    'beats?select=*,beat_licence_options(*)&order=updated_at.desc&limit=100',
  )
  const releases = await optionalJson('releases?select=*&order=created_at.desc&limit=100')
  const releaseTracks = await optionalJson('release_tracks?select=*&order=position.asc&limit=500')
  const distributionJobs = await optionalJson('distribution_jobs?select=*&order=updated_at.desc&limit=100')
  const [artistWaitlist, artistDeposits, artistPayoutRequests] = can(identity, 'manage_artist_wallet')
    ? await Promise.all([
      optionalJson('artist_waitlist?select=*&order=created_at.desc&limit=100'),
      optionalJson('artist_deposits?select=*&order=created_at.desc&limit=100'),
      optionalJson('artist_payout_requests?select=*&order=requested_at.desc&limit=100'),
    ])
    : [[], [], []]
  return NextResponse.json({
    identity: { role: identity.role, permissions: identity.permissions, profile: identity.profile },
    tracks,
    profiles,
    programmes,
    credits,
    staff,
    auditLog,
    trackRequests,
    beats,
    releases,
    releaseTracks,
    distributionJobs,
    artistWaitlist,
    artistDeposits,
    artistPayoutRequests,
  })
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
        const result = await patchTable('tracks', `id=eq.${encodeURIComponent(trackId)}`, { editorial_status: status, editorial_notes: String(body.notes || '').slice(0, 2000), reviewed_by: identity.user.id, reviewed_at: new Date().toISOString(), ...(status === 'rejected' ? { is_public: false, in_rotation: false } : {}) })
        await audit(identity.user.id, `track_${status}`, 'track', trackId, { notes: String(body.notes || '').slice(0, 300) })
        return NextResponse.json({ result })
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
      case 'publish_artist': {
        requirePermission('publish_artists')
        const profileId = String(body.profileId || '')
        const publish = Boolean(body.publish)
        const result = await patchTable('profiles', `id=eq.${encodeURIComponent(profileId)}`, { is_published: publish, is_verified: publish })
        await audit(identity.user.id, publish ? 'artist_published' : 'artist_unpublished', 'profile', profileId)
        return NextResponse.json({ result })
      }
      case 'manage_license': {
        requirePermission('manage_licensing')
        const trackId = String(body.trackId || '')
        const price = Math.max(0, Math.min(100000, Number(body.price) || 0))
        const licenceType = ['not_for_sale', 'personal_download', 'standard_lease', 'exclusive', 'custom'].includes(String(body.licenceType)) ? String(body.licenceType) : 'not_for_sale'
        const result = await patchTable('tracks', `id=eq.${encodeURIComponent(trackId)}`, { licence_type: licenceType, licence_summary: String(body.summary || '').slice(0, 1000), download_price: price, is_downloadable: licenceType !== 'not_for_sale' })
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
        if (!['administrator', 'editor', 'programmer', 'credits_editor', 'commerce_manager'].includes(role)) return NextResponse.json({ error: 'Invalid staff role.' }, { status: 400 })
        const result = await jsonOrError(await fetch(editorialUrl('editorial_staff?on_conflict=user_id'), { method: 'POST', headers: { ...serviceHeaders, Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify({ user_id: userId, role, active: body.active !== false, appointed_by: identity.user.id, updated_at: new Date().toISOString() }) }))
        await audit(identity.user.id, 'staff_assigned', 'profile', userId, { role, active: body.active !== false })
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
        const releaseId = String(body.releaseId || '')
        const inRotation = body.inRotation !== false
        const notes = String(body.notes || '').slice(0, 2000)
        if (!releaseId) return NextResponse.json({ error: 'releaseId required.' }, { status: 400 })
        if (notes) {
          await patchTable('releases', `id=eq.${encodeURIComponent(releaseId)}`, { editorial_notes: notes })
        }
        const result = await materializeReleaseTracks(releaseId, {
          publish: true,
          inRotation,
          reviewedBy: identity.user.id,
        })
        if (!result.ok) return NextResponse.json({ error: result.error || 'Publish failed.' }, { status: 400 })
        await audit(identity.user.id, 'release_published', 'release', releaseId, { inRotation, trackCount: result.trackCount })
        return NextResponse.json({ result })
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
        await audit(identity.user.id, `beat_${status}`, 'beat', beatId, {
          notes: String(body.notes || '').slice(0, 300),
        })
        return NextResponse.json({ result })
      }
      case 'publish_beat': {
        requirePermission('approve_submissions')
        const beatId = String(body.beatId || '')
        const publish = Boolean(body.publish)
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
