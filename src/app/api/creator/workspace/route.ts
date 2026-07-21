import { NextResponse } from 'next/server'
import { creatorHeaders, creatorIdentity, creatorJson, creatorUrl } from '@/lib/creator-server'

const allowedRoles = new Set(['artist', 'writer', 'show_creator', 'admin'])
const clean = (value: unknown, max = 5000) => String(value || '').trim().slice(0, max)
const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80)

export async function GET(request: Request) {
  const identity = await creatorIdentity(request)
  if (!identity) return NextResponse.json({ error: 'Sign in to open your creator workspace.' }, { status: 401 })
  if (!identity.profile || !allowedRoles.has(identity.profile.role)) return NextResponse.json({ error: 'This workspace requires a creator account.' }, { status: 403 })
  const id = identity.user.id
  const empty = { application: null, articles: [], briefs: [], shows: [], episodes: [] }
  const [tracksResponse, requestsResponse] = await Promise.all([
    fetch(creatorUrl(`tracks?user_id=eq.${id}&select=id,title,genre,artwork_url,editorial_status,editorial_notes,is_public,in_rotation,is_downloadable,download_price,licence_type,play_count,like_count,created_at,updated_at&order=created_at.desc`), { headers: creatorHeaders, cache: 'no-store' }),
    fetch(creatorUrl(`track_review_requests?artist_user_id=eq.${id}&select=*&order=created_at.desc&limit=50`), { headers: creatorHeaders, cache: 'no-store' }),
  ])
  const tracks = tracksResponse.ok ? await tracksResponse.json() : []
  const trackRequests = requestsResponse.ok ? await requestsResponse.json() : []
  if (!['writer', 'show_creator', 'admin'].includes(identity.profile.role)) {
    return NextResponse.json({ profile: identity.profile, ...empty, tracks, trackRequests })
  }
  const workflowRequests = [
    fetch(creatorUrl(`writer_applications?user_id=eq.${id}&select=*&limit=1`), { headers: creatorHeaders, cache: 'no-store' }),
    fetch(creatorUrl(`editorial_articles?author_id=eq.${id}&select=*&order=updated_at.desc`), { headers: creatorHeaders, cache: 'no-store' }),
    fetch(creatorUrl(`research_briefs?assigned_to=eq.${id}&select=*&order=created_at.desc`), { headers: creatorHeaders, cache: 'no-store' }),
    fetch(creatorUrl(`show_creator_profiles?user_id=eq.${id}&select=*&order=created_at.desc`), { headers: creatorHeaders, cache: 'no-store' }),
    fetch(creatorUrl(`show_episodes?creator_id=eq.${id}&select=*&order=created_at.desc`), { headers: creatorHeaders, cache: 'no-store' }),
  ]
  const responses = await Promise.all(workflowRequests)
  if (responses.some(response => !response.ok)) return NextResponse.json({ error: 'Creator tables are not ready. Run supabase-creator-workflows.sql.' }, { status: 503 })
  const [applications, articles, briefs, shows, episodes] = await Promise.all(responses.map(response => response.json()))
  return NextResponse.json({ profile: identity.profile, application: applications[0] || null, articles, briefs, shows, episodes, tracks, trackRequests })
}

export async function POST(request: Request) {
  const identity = await creatorIdentity(request)
  if (!identity) return NextResponse.json({ error: 'Sign in to submit creator work.' }, { status: 401 })
  if (!identity.profile || !allowedRoles.has(identity.profile.role)) return NextResponse.json({ error: 'Your account does not have creator access.' }, { status: 403 })
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const action = clean(body.action, 40)
  const id = identity.user.id
  try {
    if (action === 'apply_writer') {
      const bio = clean(body.bio, 2000); if (bio.length < 40) return NextResponse.json({ error: 'Tell the editors a little more about your experience.' }, { status: 400 })
      const beats = Array.isArray(body.beats) ? body.beats.map(item => clean(item, 60)).filter(Boolean).slice(0, 8) : []
      const data = await creatorJson(await fetch(creatorUrl('writer_applications?on_conflict=user_id'), { method: 'POST', headers: { ...creatorHeaders, Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify({ user_id: id, bio, beats, portfolio_url: clean(body.portfolioUrl, 500) || null, status: 'submitted', updated_at: new Date().toISOString() }) }))
      return NextResponse.json({ item: data[0] })
    }
    if (action === 'save_article') {
      if (!['writer','admin'].includes(identity.profile.role)) return NextResponse.json({ error: 'Writer access required.' }, { status: 403 })
      const title = clean(body.title, 180); const articleId = clean(body.id, 80); const submit = body.submit === true
      if (!title) return NextResponse.json({ error: 'Article title is required.' }, { status: 400 })
      const payload = { author_id: id, title, dek: clean(body.dek, 400), body: clean(body.body, 60000), sources: Array.isArray(body.sources) ? body.sources.slice(0, 20) : [], status: submit ? 'submitted' : 'draft', updated_at: new Date().toISOString() }
      const response = articleId
        ? await fetch(creatorUrl(`editorial_articles?id=eq.${encodeURIComponent(articleId)}&author_id=eq.${id}&status=in.(draft,changes_requested)`), { method: 'PATCH', headers: { ...creatorHeaders, Prefer: 'return=representation' }, body: JSON.stringify(payload) })
        : await fetch(creatorUrl('editorial_articles'), { method: 'POST', headers: { ...creatorHeaders, Prefer: 'return=representation' }, body: JSON.stringify(payload) })
      const data = await creatorJson(response); if (!data[0]) return NextResponse.json({ error: 'Only drafts or requested changes can be edited.' }, { status: 409 })
      return NextResponse.json({ item: data[0] })
    }
    if (action === 'save_show') {
      if (!['show_creator','admin'].includes(identity.profile.role)) return NextResponse.json({ error: 'Show creator access required.' }, { status: 403 })
      const title = clean(body.title, 150); if (!title) return NextResponse.json({ error: 'Show title is required.' }, { status: 400 })
      const showId = clean(body.id, 80); const payload = { user_id: id, title, slug: slugify(clean(body.slug, 100) || title), description: clean(body.description, 4000), artwork_url: clean(body.artworkUrl, 500) || null, category: clean(body.category, 80) || 'Music', cadence: 'weekly', status: body.submit === true ? 'submitted' : 'draft', updated_at: new Date().toISOString() }
      const response = showId
        ? await fetch(creatorUrl(`show_creator_profiles?id=eq.${encodeURIComponent(showId)}&user_id=eq.${id}&status=in.(draft,rejected)`), { method: 'PATCH', headers: { ...creatorHeaders, Prefer: 'return=representation' }, body: JSON.stringify(payload) })
        : await fetch(creatorUrl('show_creator_profiles'), { method: 'POST', headers: { ...creatorHeaders, Prefer: 'return=representation' }, body: JSON.stringify(payload) })
      const data = await creatorJson(response); if (!data[0]) return NextResponse.json({ error: 'This show can no longer be edited.' }, { status: 409 })
      return NextResponse.json({ item: data[0] })
    }
    if (action === 'submit_episode') {
      if (!['show_creator','admin'].includes(identity.profile.role)) return NextResponse.json({ error: 'Show creator access required.' }, { status: 403 })
      const showId = clean(body.showId, 80); const title = clean(body.title, 180); const audioPath = clean(body.audioPath, 1000)
      if (!showId || !title || !audioPath) return NextResponse.json({ error: 'Show, title and uploaded audio are required.' }, { status: 400 })
      const owned = await creatorJson(await fetch(creatorUrl(`show_creator_profiles?id=eq.${encodeURIComponent(showId)}&user_id=eq.${id}&status=eq.approved&select=id`), { headers: creatorHeaders }))
      if (!owned[0]) return NextResponse.json({ error: 'Episodes can be submitted only to your approved show.' }, { status: 403 })
      const data = await creatorJson(await fetch(creatorUrl('show_episodes'), { method: 'POST', headers: { ...creatorHeaders, Prefer: 'return=representation' }, body: JSON.stringify({ show_id: showId, creator_id: id, title, description: clean(body.description, 5000), episode_number: Number(body.episodeNumber) || null, audio_path: audioPath, explicit: body.explicit === true, status: 'submitted' }) }))
      return NextResponse.json({ item: data[0] })
    }
    if (action === 'track_request') {
      if (!['artist','admin'].includes(identity.profile.role)) return NextResponse.json({ error: 'Artist access required.' }, { status: 403 })
      const trackId = clean(body.trackId, 80)
      const requestType = clean(body.requestType, 40)
      const message = clean(body.message, 3000)
      if (!trackId || !['takedown','metadata_correction','artwork_replacement','rights_update','payout_question','other'].includes(requestType)) return NextResponse.json({ error: 'Choose a valid track request.' }, { status: 400 })
      if (message.length < 10) return NextResponse.json({ error: 'Add a short note for the editorial team.' }, { status: 400 })
      const owned = await creatorJson(await fetch(creatorUrl(`tracks?id=eq.${encodeURIComponent(trackId)}&user_id=eq.${id}&select=id`), { headers: creatorHeaders }))
      if (!owned[0]) return NextResponse.json({ error: 'You can request changes only for your own uploads.' }, { status: 403 })
      const data = await creatorJson(await fetch(creatorUrl('track_review_requests'), { method: 'POST', headers: { ...creatorHeaders, Prefer: 'return=representation' }, body: JSON.stringify({ track_id: trackId, artist_user_id: id, request_type: requestType, message, status: 'open' }) }))
      return NextResponse.json({ item: data[0] })
    }
    return NextResponse.json({ error: 'Unknown creator action.' }, { status: 400 })
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Creator request failed.' }, { status: 500 }) }
}
