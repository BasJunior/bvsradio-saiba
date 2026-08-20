import { NextResponse } from 'next/server'
import { editorialIdentity, editorialUrl, serviceHeaders } from '@/lib/editorial-server'
import { creatorPublicName } from '@/lib/public-name'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type CommandKind = 'release' | 'track' | 'beat' | 'creator' | 'artist_name' | 'producer_name' | 'request' | 'role' | 'programme' | 'audit'

type CommandItem = {
  id: string
  kind: CommandKind
  title: string
  subtitle: string
  status?: string
  section: string
  createdAt?: string
  priority: number
  keywords: string[]
}

async function rows(path: string) {
  const response = await fetch(editorialUrl(path), {
    headers: serviceHeaders,
    cache: 'no-store',
  })
  if (!response.ok) return [] as Array<Record<string, unknown>>
  return response.json() as Promise<Array<Record<string, unknown>>>
}

function text(value: unknown) {
  return String(value || '').trim()
}

function statusPriority(status: string, kind: CommandKind) {
  const value = status.toLowerCase()
  if (kind === 'release' || kind === 'track') {
    if (value === 'submitted') return 120
    if (value === 'in_review') return 110
  }
  if (kind === 'beat') {
    if (value === 'submitted') return 120
    if (value === 'in_review') return 110
    if (value === 'changes_requested') return 100
  }
  if (kind === 'request') {
    if (value === 'open') return 120
    if (value === 'reviewing') return 110
  }
  if (kind === 'role') {
    if (value === 'submitted') return 120
    if (value === 'information_requested') return 100
  }
  if (kind === 'creator') {
    if (value.includes('pending')) return 105
    if (value.includes('changes_requested')) return 95
  }
  return 0
}

function unique(items: CommandItem[]) {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = `${item.kind}:${item.id}:${item.section}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export async function GET(request: Request) {
  const identity = await editorialIdentity(request)
  if (!identity) return NextResponse.json({ error: 'Editorial access required.' }, { status: 403 })

  const [tracks, beats, releases, profiles, programmes, trackRequests, artworkRequests, roleApplications, auditLog] = await Promise.all([
    rows('tracks?reclassified_to_beat_id=is.null&select=id,user_id,title,artist_name,genre,editorial_status,is_public,in_rotation,created_at&order=created_at.desc&limit=250'),
    rows('beats?select=id,producer_user_id,title,genre,status,is_public,created_at&order=created_at.desc&limit=250'),
    rows('releases?select=id,title,artist_name,release_type,editorial_status,is_public,created_at&order=created_at.desc&limit=200'),
    rows('profiles?select=id,username,display_name,role,is_producer,is_verified,is_published,creator_public_name,creator_name_status,producer_public_name,producer_name_status,created_at&order=created_at.desc&limit=300'),
    rows('programmes?select=id,slug,title,host,status,day_label,start_time,timezone&order=title.asc&limit=150'),
    rows('track_review_requests?select=id,track_id,artist_user_id,request_type,message,status,created_at&order=created_at.desc&limit=150'),
    rows('artwork_change_requests?select=id,requester_user_id,target_kind,target_id,request_type,message,status,created_at&order=created_at.desc&limit=150'),
    rows('profile_role_applications?select=id,user_id,requested_role,status,message,updated_at&order=updated_at.desc&limit=150'),
    rows('editorial_audit_log?select=id,action,entity_type,entity_id,created_at&order=created_at.desc&limit=80'),
  ])

  const profileById = new Map(profiles.map((profile) => [text(profile.id), profile]))
  const trackById = new Map(tracks.map((track) => [text(track.id), track]))
  const releaseById = new Map(releases.map((release) => [text(release.id), release]))
  const beatById = new Map(beats.map((beat) => [text(beat.id), beat]))

  const creatorName = (profile?: Record<string, unknown>) => {
    if (!profile) return 'BVS creator'
    return creatorPublicName({
      publicName: text(profile.creator_public_name) || text(profile.producer_public_name) || undefined,
      publicNameStatus: text(profile.creator_name_status) || text(profile.producer_name_status) || undefined,
      username: text(profile.username),
    }) || text(profile.display_name) || `@${text(profile.username)}`
  }

  const items: CommandItem[] = []

  for (const release of releases) {
    const status = text(release.editorial_status)
    items.push({
      id: text(release.id),
      kind: 'release',
      title: text(release.title) || 'Untitled release',
      subtitle: [text(release.artist_name), text(release.release_type) || 'release', release.is_public ? 'public' : 'not public'].filter(Boolean).join(' · '),
      status,
      section: 'ed-releases',
      createdAt: text(release.created_at) || undefined,
      priority: statusPriority(status, 'release'),
      keywords: [text(release.artist_name), text(release.release_type), status, text(release.id)],
    })
  }

  for (const beat of beats) {
    const status = text(beat.status)
    const producer = profileById.get(text(beat.producer_user_id))
    const name = creatorName(producer)
    items.push({
      id: text(beat.id),
      kind: 'beat',
      title: text(beat.title) || 'Untitled beat',
      subtitle: [name, text(beat.genre) || 'BeatStore', beat.is_public ? 'public' : 'not public'].filter(Boolean).join(' · '),
      status,
      section: 'ed-beats',
      createdAt: text(beat.created_at) || undefined,
      priority: statusPriority(status, 'beat'),
      keywords: [name, text(producer?.username), text(beat.genre), status, text(beat.id)],
    })
  }

  for (const track of tracks) {
    const status = text(track.editorial_status)
    items.push({
      id: text(track.id),
      kind: 'track',
      title: text(track.title) || 'Untitled track',
      subtitle: [text(track.artist_name), text(track.genre), track.in_rotation ? 'in rotation' : '', track.is_public ? 'public' : 'not public'].filter(Boolean).join(' · '),
      status,
      section: 'ed-tracks',
      createdAt: text(track.created_at) || undefined,
      priority: statusPriority(status, 'track'),
      keywords: [text(track.artist_name), text(track.genre), status, text(track.id), text(track.user_id)],
    })
  }

  for (const profile of profiles) {
    const artistStatus = text(profile.creator_name_status)
    const producerStatus = text(profile.producer_name_status)
    const artistPublic = text(profile.creator_public_name)
    const producerPublic = text(profile.producer_public_name)
    const artistRequest = text(profile.creator_name_request)
    const producerRequest = text(profile.producer_name_request)
    const name = creatorName(profile)
    const baseKeywords = [text(profile.username), text(profile.display_name), text(profile.role), text(profile.id), name]

    // Separate identity work objects so staff can triage artist vs producer names independently.
    if (artistStatus && artistStatus !== 'not_submitted') {
      items.push({
        id: `${text(profile.id)}:artist-name`,
        kind: 'artist_name',
        title: artistRequest || artistPublic || name,
        subtitle: [`Artist identity · ${artistStatus.replaceAll('_', ' ')}`, `@${text(profile.username)}`, artistPublic ? `public: ${artistPublic}` : ''].filter(Boolean).join(' · '),
        status: artistStatus,
        section: 'ed-identities',
        createdAt: text(profile.created_at) || undefined,
        priority: statusPriority(artistStatus, 'creator'),
        keywords: [...baseKeywords, artistStatus, artistPublic, artistRequest, 'artist identity', 'artist name'],
      })
    }
    if (profile.is_producer && producerStatus && producerStatus !== 'not_submitted') {
      const fallbackRequest = producerRequest === '__use_artist_name__'
      items.push({
        id: `${text(profile.id)}:producer-name`,
        kind: 'producer_name',
        title: fallbackRequest ? `${name} → use artist name` : (producerRequest || producerPublic || name),
        subtitle: [`Producer identity · ${producerStatus.replaceAll('_', ' ')}`, `@${text(profile.username)}`, producerPublic ? `public: ${producerPublic}` : fallbackRequest ? 'clear separate producer name' : ''].filter(Boolean).join(' · '),
        status: producerStatus,
        section: 'ed-identities',
        createdAt: text(profile.created_at) || undefined,
        priority: statusPriority(producerStatus, 'creator') + (fallbackRequest ? 5 : 0),
        keywords: [...baseKeywords, producerStatus, producerPublic, producerRequest, 'producer identity', 'producer name', fallbackRequest ? 'use artist name' : ''],
      })
    }

    items.push({
      id: text(profile.id),
      kind: 'creator',
      title: name,
      subtitle: [`@${text(profile.username)}`, text(profile.role), profile.is_producer ? 'producer' : '', profile.is_published ? 'published' : 'not published', artistStatus && artistStatus !== 'not_submitted' ? `artist name ${artistStatus}` : '', producerStatus && producerStatus !== 'not_submitted' ? `producer name ${producerStatus}` : ''].filter(Boolean).join(' · '),
      status: [artistStatus, producerStatus].filter((value) => value && value !== 'not_submitted').join(' / ') || (profile.is_published ? 'published' : 'not_published'),
      section: /pending|changes_requested/.test(`${artistStatus} ${producerStatus}`) ? 'ed-identities' : 'ed-artists',
      createdAt: text(profile.created_at) || undefined,
      priority: Math.max(statusPriority(artistStatus, 'creator'), statusPriority(producerStatus, 'creator')),
      keywords: [...baseKeywords, artistStatus, producerStatus, artistPublic, producerPublic],
    })
  }

  for (const programme of programmes) {
    items.push({
      id: text(programme.id),
      kind: 'programme',
      title: text(programme.title) || text(programme.slug) || 'Programme',
      subtitle: [text(programme.host), text(programme.day_label), text(programme.start_time), text(programme.timezone)].filter(Boolean).join(' · '),
      status: text(programme.status),
      section: 'ed-artists',
      priority: 0,
      keywords: [text(programme.slug), text(programme.host), text(programme.status), text(programme.day_label), text(programme.id)],
    })
  }

  for (const review of trackRequests) {
    const track = trackById.get(text(review.track_id))
    const profile = profileById.get(text(review.artist_user_id))
    const status = text(review.status)
    items.push({
      id: text(review.id),
      kind: 'request',
      title: `${text(review.request_type).replaceAll('_', ' ') || 'Track request'} · ${text(track?.title) || 'track'}`,
      subtitle: [creatorName(profile), text(review.message)].filter(Boolean).join(' · '),
      status,
      section: 'ed-requests',
      createdAt: text(review.created_at) || undefined,
      priority: statusPriority(status, 'request'),
      keywords: [text(track?.title), text(profile?.username), text(review.request_type), text(review.message), status, text(review.id)],
    })
  }

  for (const review of artworkRequests) {
    const kind = text(review.target_kind)
    const targetId = text(review.target_id)
    const target = kind === 'track' ? trackById.get(targetId) : kind === 'release' ? releaseById.get(targetId) : kind === 'beat' ? beatById.get(targetId) : undefined
    const status = text(review.status)
    items.push({
      id: text(review.id),
      kind: 'request',
      title: `Artwork · ${text(target?.title) || `${kind} ${targetId.slice(0, 8)}`}`,
      subtitle: text(review.message) || `${kind} artwork change`,
      status,
      section: 'ed-requests',
      createdAt: text(review.created_at) || undefined,
      priority: statusPriority(status, 'request'),
      keywords: [kind, targetId, text(target?.title), text(review.request_type), text(review.message), status, text(review.id)],
    })
  }

  for (const application of roleApplications) {
    const profile = profileById.get(text(application.user_id))
    const status = text(application.status)
    items.push({
      id: text(application.id),
      kind: 'role',
      title: `${creatorName(profile)} → ${text(application.requested_role).replaceAll('_', ' ') || 'role'}`,
      subtitle: text(application.message) || `@${text(profile?.username)}`,
      status,
      section: 'ed-role-applications',
      createdAt: text(application.updated_at) || undefined,
      priority: statusPriority(status, 'role'),
      keywords: [creatorName(profile), text(profile?.username), text(application.requested_role), status, text(application.id)],
    })
  }

  for (const entry of auditLog) {
    items.push({
      id: text(entry.id),
      kind: 'audit',
      title: text(entry.action).replaceAll('_', ' '),
      subtitle: `${text(entry.entity_type)} · ${text(entry.entity_id)}`,
      section: 'ed-audit',
      createdAt: text(entry.created_at) || undefined,
      priority: 0,
      keywords: [text(entry.action), text(entry.entity_type), text(entry.entity_id)],
    })
  }

  const result = unique(items)
  const needsAction = result.filter((item) => item.priority > 0)
  const counts = needsAction.reduce<Record<string, number>>((acc, item) => {
    acc[item.kind] = (acc[item.kind] || 0) + 1
    return acc
  }, {})

  return NextResponse.json({
    items: result,
    summary: {
      total: result.length,
      needsAction: needsAction.length,
      counts,
      generatedAt: new Date().toISOString(),
    },
  }, {
    headers: { 'Cache-Control': 'private, no-store, max-age=0' },
  })
}
