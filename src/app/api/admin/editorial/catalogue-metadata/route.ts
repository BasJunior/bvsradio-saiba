import { NextResponse } from 'next/server'
import { audit, can, editorialIdentity, editorialUrl, serviceHeaders } from '@/lib/editorial-server'
import { creatorPublicName } from '@/lib/public-name'
import { r2KeyFromMediaUrl, safeR2Key, signedR2DownloadUrl } from '@/lib/r2-storage'

type JsonRow = Record<string, unknown>

type CreatorProfile = {
  id: string
  username?: string | null
  display_name?: string | null
  creator_public_name?: string | null
  creator_name_status?: string | null
  role?: string | null
  is_producer?: boolean | null
  is_published?: boolean | null
}

async function rows(path: string): Promise<JsonRow[]> {
  const response = await fetch(editorialUrl(path), { headers: serviceHeaders, cache: 'no-store' })
  if (!response.ok) throw new Error(await response.text())
  const data = await response.json()
  return Array.isArray(data) ? data as JsonRow[] : []
}

async function patchRows(table: string, query: string, body: Record<string, unknown>) {
  const response = await fetch(editorialUrl(`${table}?${query}`), {
    method: 'PATCH',
    headers: { ...serviceHeaders, Prefer: 'return=representation' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(await response.text())
  const data = await response.json().catch(() => [])
  return Array.isArray(data) ? data as JsonRow[] : []
}

async function signStoredMedia(value?: unknown) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const key = r2KeyFromMediaUrl(raw) || (safeR2Key(raw) && !/^https?:/i.test(raw) ? raw : null)
  return key ? signedR2DownloadUrl(key, 900) : raw
}

function cleanTitle(value: unknown) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 180)
}

function cleanArtistName(value: unknown) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 160)
}

function isCreator(profile: CreatorProfile) {
  const role = String(profile.role || '').toLowerCase()
  return role === 'artist' || role === 'admin' || Boolean(profile.is_producer)
}

function publicNameForProfile(profile: CreatorProfile) {
  return creatorPublicName({
    publicName: profile.creator_public_name,
    publicNameStatus: profile.creator_name_status,
    username: profile.username,
  })
}

async function resolveCreator(profileId: string): Promise<{ profile: CreatorProfile; publicName: string } | null> {
  if (!profileId) return null
  const profile = (await rows(
    `profiles?id=eq.${encodeURIComponent(profileId)}&select=id,username,display_name,creator_public_name,creator_name_status,role,is_producer,is_published&limit=1`,
  ))[0] as CreatorProfile | undefined
  if (!profile || !isCreator(profile)) return null
  return { profile, publicName: publicNameForProfile(profile) }
}

export async function GET(request: Request) {
  const identity = await editorialIdentity(request)
  if (!identity) return NextResponse.json({ error: 'Editorial access required.' }, { status: 403 })

  try {
    const [rawTracks, rawReleases, rawMembers, rawProfiles] = await Promise.all([
      rows('tracks?reclassified_to_beat_id=is.null&select=id,user_id,title,artist_name,genre,file_url,artwork_url,editorial_status,is_public,in_rotation,created_at,release_id,track_number&order=created_at.desc&limit=800'),
      rows('releases?select=id,user_id,title,artist_name,genre,cover_url,release_type,editorial_status,is_public,in_rotation,track_count,created_at&order=created_at.desc&limit=300'),
      rows('release_tracks?select=id,release_id,track_id,position,title,file_url,audio_path&order=position.asc&limit=1500'),
      rows('profiles?select=id,username,display_name,creator_public_name,creator_name_status,role,is_producer,is_published&order=username.asc&limit=1500'),
    ])

    const tracks = await Promise.all(rawTracks.map(async (track) => ({
      ...track,
      file_url: await signStoredMedia(track.file_url),
      artwork_url: await signStoredMedia(track.artwork_url),
    })))
    const releases = await Promise.all(rawReleases.map(async (release) => ({
      ...release,
      cover_url: await signStoredMedia(release.cover_url),
    })))
    const releaseTracks = await Promise.all(rawMembers.map(async (member) => ({
      ...member,
      file_url: await signStoredMedia(member.file_url || member.audio_path),
    })))
    const profiles = (rawProfiles as CreatorProfile[])
      .filter(isCreator)
      .map((profile) => ({
        ...profile,
        public_name: publicNameForProfile(profile),
      }))
      .sort((a, b) => String(a.public_name || '').localeCompare(String(b.public_name || '')))

    return NextResponse.json({
      tracks,
      releases,
      releaseTracks,
      profiles,
      identity: { role: identity.role, permissions: identity.permissions },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not load catalogue normalization data.' },
      { status: 500 },
    )
  }
}

type PatchBody = {
  kind?: 'track' | 'release'
  id?: string
  title?: string
  selectedProfileId?: string
  customArtistName?: string
  trackTitles?: Array<{ releaseTrackId?: string; title?: string }>
}

export async function PATCH(request: Request) {
  const identity = await editorialIdentity(request)
  if (!identity) return NextResponse.json({ error: 'Editorial access required.' }, { status: 403 })
  if (!can(identity, 'approve_submissions')) {
    return NextResponse.json({ error: 'Your editorial role cannot edit public release metadata.' }, { status: 403 })
  }

  const body = await request.json() as PatchBody
  const kind = body.kind
  const id = String(body.id || '').trim()
  const title = cleanTitle(body.title)
  const selectedProfileId = String(body.selectedProfileId || '').trim()
  const customArtistName = cleanArtistName(body.customArtistName)

  if (!id || !title || !['track', 'release'].includes(String(kind))) {
    return NextResponse.json({ error: 'A valid item and public title are required.' }, { status: 400 })
  }

  try {
    const linked = selectedProfileId ? await resolveCreator(selectedProfileId) : null
    if (selectedProfileId && !linked) {
      return NextResponse.json({ error: 'The selected BVS creator profile could not be linked.' }, { status: 400 })
    }

    if (kind === 'track') {
      const existing = (await rows(
        `tracks?id=eq.${encodeURIComponent(id)}&select=id,user_id,title,artist_name,release_id,is_public,in_rotation&limit=1`,
      ))[0] as JsonRow | undefined
      if (!existing) return NextResponse.json({ error: 'Single track not found.' }, { status: 404 })
      if (existing.release_id) {
        return NextResponse.json(
          { error: 'This track belongs to an album or EP. Edit it from the release card so the project stays synchronized.' },
          { status: 409 },
        )
      }

      const artistName = linked?.publicName || customArtistName || cleanArtistName(existing.artist_name)
      if (!artistName) return NextResponse.json({ error: 'A public artist name is required.' }, { status: 400 })
      const previousUserId = String(existing.user_id || '')
      const nextUserId = linked?.profile.id || previousUserId
      const result = await patchRows('tracks', `id=eq.${encodeURIComponent(id)}`, {
        title,
        artist_name: artistName,
        ...(linked ? { user_id: nextUserId } : {}),
      })

      await audit(identity.user.id, 'track_metadata_normalized', 'track', id, {
        previousTitle: existing.title,
        title,
        previousArtistName: existing.artist_name,
        artistName,
        previousUserId,
        linkedProfileId: linked?.profile.id || null,
        relationshipChanged: Boolean(linked && previousUserId !== nextUserId),
        preservedTrackIdentity: true,
        inRotation: Boolean(existing.in_rotation),
        isPublic: Boolean(existing.is_public),
      })
      return NextResponse.json({ result, relationshipChanged: Boolean(linked && previousUserId !== nextUserId) })
    }

    const existing = (await rows(
      `releases?id=eq.${encodeURIComponent(id)}&select=id,user_id,title,artist_name,release_type,is_public,in_rotation&limit=1`,
    ))[0] as JsonRow | undefined
    if (!existing) return NextResponse.json({ error: 'Release not found.' }, { status: 404 })

    const members = await rows(
      `release_tracks?release_id=eq.${encodeURIComponent(id)}&select=id,track_id,position,title&order=position.asc`,
    )
    const memberIds = new Set(members.map((member) => String(member.id)))
    const requestedTitles = Array.isArray(body.trackTitles) ? body.trackTitles : []
    const titleByMember = new Map<string, string>()
    for (const row of requestedTitles.slice(0, 300)) {
      const releaseTrackId = String(row.releaseTrackId || '').trim()
      const memberTitle = cleanTitle(row.title)
      if (!releaseTrackId || !memberTitle) continue
      if (!memberIds.has(releaseTrackId)) {
        return NextResponse.json({ error: 'One or more edited songs do not belong to this release.' }, { status: 400 })
      }
      titleByMember.set(releaseTrackId, memberTitle)
    }

    const artistName = linked?.publicName || customArtistName || cleanArtistName(existing.artist_name)
    if (!artistName) return NextResponse.json({ error: 'A public artist name is required.' }, { status: 400 })
    const previousUserId = String(existing.user_id || '')
    const nextUserId = linked?.profile.id || previousUserId

    const releaseResult = await patchRows('releases', `id=eq.${encodeURIComponent(id)}`, {
      title,
      artist_name: artistName,
      ...(linked ? { user_id: nextUserId } : {}),
    })

    for (const member of members) {
      const releaseTrackId = String(member.id)
      const memberTitle = titleByMember.get(releaseTrackId) || cleanTitle(member.title)
      if (!memberTitle) continue
      if (titleByMember.has(releaseTrackId)) {
        await patchRows('release_tracks', `id=eq.${encodeURIComponent(releaseTrackId)}`, { title: memberTitle })
      }
      const trackId = String(member.track_id || '').trim()
      if (trackId) {
        await patchRows('tracks', `id=eq.${encodeURIComponent(trackId)}`, {
          title: memberTitle,
          artist_name: artistName,
          ...(linked ? { user_id: nextUserId } : {}),
        })
      }
    }

    // Safety sync for already-materialized catalogue rows even if an old release_track link is incomplete.
    await patchRows('tracks', `release_id=eq.${encodeURIComponent(id)}`, {
      artist_name: artistName,
      ...(linked ? { user_id: nextUserId } : {}),
    })

    await audit(identity.user.id, 'release_metadata_normalized', 'release', id, {
      previousTitle: existing.title,
      title,
      previousArtistName: existing.artist_name,
      artistName,
      previousUserId,
      linkedProfileId: linked?.profile.id || null,
      relationshipChanged: Boolean(linked && previousUserId !== nextUserId),
      editedTrackTitles: [...titleByMember.keys()],
      preservedReleaseIdentity: true,
      isPublic: Boolean(existing.is_public),
      inRotation: Boolean(existing.in_rotation),
    })

    return NextResponse.json({
      result: releaseResult,
      relationshipChanged: Boolean(linked && previousUserId !== nextUserId),
      updatedTrackTitles: titleByMember.size,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not save public catalogue metadata.' },
      { status: 500 },
    )
  }
}
