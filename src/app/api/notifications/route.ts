import { NextResponse } from 'next/server'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

type Event = { id: string; title: string; detail: string; created_at: string; href: string; kind: string }

export async function GET(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token || !url || !anon || !service) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
  const userResponse = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anon, Authorization: `Bearer ${token}` }, cache: 'no-store' })
  if (!userResponse.ok) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
  const user = await userResponse.json() as { id: string }
  const headers = { apikey: service, Authorization: `Bearer ${service}` }
  const rows = async (path: string) => {
    const response = await fetch(`${url}/rest/v1/${path}`, { headers, cache: 'no-store' })
    return response.ok ? await response.json() as Array<Record<string, unknown>> : []
  }
  const [profiles, staff] = await Promise.all([
    rows(`profiles?id=eq.${user.id}&select=role,is_producer&limit=1`),
    rows(`editorial_staff?user_id=eq.${user.id}&active=eq.true&select=role&limit=1`),
  ])
  const profile = profiles[0]
  const editorial = Boolean(staff[0]) || ['admin', 'editor', 'moderator'].includes(String(profile?.role || ''))

  let events: Event[] = []
  if (editorial) {
    const [messages, trackMessages, beats, tracks, releases, requests, applications, articles, shows, episodes, payouts] = await Promise.all([
      rows('beat_review_messages?author_kind=eq.producer&select=id,beat_id,message,created_at&order=created_at.desc&limit=30'),
      rows('track_review_messages?author_kind=eq.artist&select=id,track_id,message,created_at&order=created_at.desc&limit=30'),
      rows('beats?status=in.(submitted,changes_requested)&select=id,title,status,updated_at&order=updated_at.desc&limit=30'),
      rows('tracks?editorial_status=in.(submitted,in_review)&select=id,title,editorial_status,updated_at&order=updated_at.desc&limit=30'),
      rows('releases?editorial_status=in.(submitted,in_review)&select=id,title,editorial_status,updated_at&order=updated_at.desc&limit=30'),
      rows('track_review_requests?status=in.(open,reviewing)&select=id,request_type,status,created_at&order=created_at.desc&limit=30'),
      rows('writer_applications?status=eq.submitted&select=id,status,created_at&order=created_at.desc&limit=30'),
      rows('editorial_articles?status=in.(submitted,changes_requested)&select=id,title,status,updated_at&order=updated_at.desc&limit=30'),
      rows('show_creator_profiles?status=eq.submitted&select=id,title,status,updated_at&order=updated_at.desc&limit=30'),
      rows('show_episodes?status=in.(submitted,changes_requested)&select=id,title,status,updated_at&order=updated_at.desc&limit=30'),
      rows('artist_payout_requests?status=in.(requested,approved,processing)&select=id,requested_amount,currency,status,requested_at&order=requested_at.desc&limit=30'),
    ])
    events = [
      ...messages.map(item => ({ id: `beat-message-${item.id}`, title: 'Producer reply', detail: String(item.message || ''), created_at: String(item.created_at), href: '/editorial#ed-beats', kind: 'message' })),
      ...trackMessages.map(item => ({ id: `track-message-${item.id}`, title: 'Artist reply', detail: String(item.message || ''), created_at: String(item.created_at), href: '/editorial#ed-tracks', kind: 'message' })),
      ...beats.map(item => ({ id: `beat-${item.id}-${item.status}`, title: 'Beat needs review', detail: `${item.title} · ${String(item.status).replaceAll('_', ' ')}`, created_at: String(item.updated_at), href: '/editorial#ed-beats', kind: 'beat' })),
      ...tracks.map(item => ({ id: `track-${item.id}-${item.editorial_status}`, title: 'Track submission', detail: `${item.title} · ${String(item.editorial_status).replaceAll('_', ' ')}`, created_at: String(item.updated_at), href: '/editorial#ed-tracks', kind: 'track' })),
      ...releases.map(item => ({ id: `release-${item.id}-${item.editorial_status}`, title: 'Release submission', detail: `${item.title} · ${String(item.editorial_status).replaceAll('_', ' ')}`, created_at: String(item.updated_at), href: '/editorial#ed-releases', kind: 'release' })),
      ...requests.map(item => ({ id: `request-${item.id}-${item.status}`, title: 'Artist request', detail: String(item.request_type || '').replaceAll('_', ' '), created_at: String(item.created_at), href: '/editorial#ed-requests', kind: 'request' })),
      ...applications.map(item => ({ id: `writer-${item.id}`, title: 'Writer application', detail: 'New application waiting for review', created_at: String(item.created_at), href: '/admin/creator-workflows', kind: 'writer' })),
      ...articles.map(item => ({ id: `article-${item.id}-${item.status}`, title: 'Article submission', detail: String(item.title || 'Untitled article'), created_at: String(item.updated_at), href: '/admin/creator-workflows', kind: 'article' })),
      ...shows.map(item => ({ id: `show-${item.id}-${item.status}`, title: 'Show proposal', detail: String(item.title || 'Untitled show'), created_at: String(item.updated_at), href: '/admin/creator-workflows', kind: 'show' })),
      ...episodes.map(item => ({ id: `episode-${item.id}-${item.status}`, title: 'Episode submission', detail: String(item.title || 'Untitled episode'), created_at: String(item.updated_at), href: '/admin/creator-workflows', kind: 'episode' })),
      ...payouts.map(item => ({ id: `payout-${item.id}-${item.status}`, title: 'Payout request', detail: `${item.currency || 'USD'} ${item.requested_amount} · ${item.status}`, created_at: String(item.requested_at), href: '/editorial#ed-wallet', kind: 'payout' })),
    ]
  } else {
    const rightsNotices = await rows(
      `artist_rights_notices?user_id=eq.${user.id}&select=id,title,body,notice_type,created_at&order=created_at.desc&limit=30`,
    )
    const [beats, messages, trackMessages, tracks, releases, requests, applications, articles, shows, episodes, orders] = await Promise.all([
      rows(`beats?producer_user_id=eq.${user.id}&select=id,title,status,updated_at&order=updated_at.desc&limit=50`),
      rows(`beat_review_messages?author_kind=eq.editor&beat_id=in.(${(await rows(`beats?producer_user_id=eq.${user.id}&select=id`)).map(item => item.id).join(',') || '00000000-0000-0000-0000-000000000000'})&select=id,beat_id,message,created_at&order=created_at.desc&limit=30`),
      rows(`track_review_messages?author_kind=eq.editor&track_id=in.(${(await rows(`tracks?user_id=eq.${user.id}&select=id`)).map(item => item.id).join(',') || '00000000-0000-0000-0000-000000000000'})&select=id,track_id,message,created_at&order=created_at.desc&limit=30`),
      rows(`tracks?user_id=eq.${user.id}&select=id,title,editorial_status,updated_at&order=updated_at.desc&limit=40`),
      rows(`releases?user_id=eq.${user.id}&select=id,title,editorial_status,updated_at&order=updated_at.desc&limit=40`),
      rows(`track_review_requests?artist_user_id=eq.${user.id}&select=id,request_type,status,staff_notes,created_at&order=created_at.desc&limit=40`),
      rows(`writer_applications?user_id=eq.${user.id}&select=id,status,review_notes,updated_at&limit=1`),
      rows(`editorial_articles?author_id=eq.${user.id}&select=id,title,status,editor_notes,updated_at&order=updated_at.desc&limit=40`),
      rows(`show_creator_profiles?user_id=eq.${user.id}&select=id,title,status,review_notes,updated_at&order=updated_at.desc&limit=40`),
      rows(`show_episodes?creator_id=eq.${user.id}&select=id,title,status,review_notes,updated_at&order=updated_at.desc&limit=40`),
      rows(`orders?customer_user_id=eq.${user.id}&select=reference,status,delivery_status,updated_at&order=updated_at.desc&limit=30`),
    ])
    events = [
      ...rightsNotices.map(item => ({
        id: `rights-notice-${item.id}`,
        title: String(item.title || 'Rights notice'),
        detail: String(item.body || item.notice_type || ''),
        created_at: String(item.created_at),
        href: '/copyright',
        kind: 'rights',
      })),
      ...messages.map(item => ({ id: `beat-message-${item.id}`, title: 'Editorial message', detail: String(item.message || ''), created_at: String(item.created_at), href: '/creator/studio', kind: 'message' })),
      ...trackMessages.map(item => ({ id: `track-message-${item.id}`, title: 'Editorial message', detail: String(item.message || ''), created_at: String(item.created_at), href: '/creator/studio', kind: 'message' })),
      ...beats.filter(item => item.status !== 'draft').map(item => ({ id: `beat-${item.id}-${item.status}`, title: 'Beat status updated', detail: `${item.title} · ${String(item.status).replaceAll('_', ' ')}`, created_at: String(item.updated_at), href: '/creator/studio', kind: 'beat' })),
      ...tracks.map(item => ({ id: `track-${item.id}-${item.editorial_status}`, title: 'Track status updated', detail: `${item.title} · ${String(item.editorial_status).replaceAll('_', ' ')}`, created_at: String(item.updated_at), href: '/creator/studio', kind: 'track' })),
      ...releases.map(item => ({ id: `release-${item.id}-${item.editorial_status}`, title: 'Release status updated', detail: `${item.title} · ${String(item.editorial_status).replaceAll('_', ' ')}`, created_at: String(item.updated_at), href: '/creator/studio', kind: 'release' })),
      ...requests.map(item => ({ id: `request-${item.id}-${item.status}`, title: 'Artist request updated', detail: `${String(item.request_type).replaceAll('_', ' ')} · ${item.status}${item.staff_notes ? ` · ${item.staff_notes}` : ''}`, created_at: String(item.created_at), href: '/creator/studio', kind: 'request' })),
      ...applications.map(item => ({ id: `writer-${item.id}-${item.status}`, title: 'Writer application updated', detail: `${item.status}${item.review_notes ? ` · ${item.review_notes}` : ''}`, created_at: String(item.updated_at), href: '/creator/studio', kind: 'writer' })),
      ...articles.map(item => ({ id: `article-${item.id}-${item.status}`, title: 'Article status updated', detail: `${item.title} · ${String(item.status).replaceAll('_', ' ')}${item.editor_notes ? ` · ${item.editor_notes}` : ''}`, created_at: String(item.updated_at), href: '/creator/studio', kind: 'article' })),
      ...shows.map(item => ({ id: `show-${item.id}-${item.status}`, title: 'Show status updated', detail: `${item.title} · ${String(item.status).replaceAll('_', ' ')}${item.review_notes ? ` · ${item.review_notes}` : ''}`, created_at: String(item.updated_at), href: '/creator/studio', kind: 'show' })),
      ...episodes.map(item => ({ id: `episode-${item.id}-${item.status}`, title: 'Episode status updated', detail: `${item.title} · ${String(item.status).replaceAll('_', ' ')}${item.review_notes ? ` · ${item.review_notes}` : ''}`, created_at: String(item.updated_at), href: '/creator/studio', kind: 'episode' })),
      ...orders.map(item => ({ id: `order-${item.reference}-${item.status}-${item.delivery_status}`, title: 'Order updated', detail: `${item.reference} · ${String(item.status).replaceAll('_', ' ')} · ${String(item.delivery_status).replaceAll('_', ' ')}`, created_at: String(item.updated_at), href: `/account/orders/${item.reference}`, kind: 'order' })),
    ]
  }

  events = events.filter(event => event.created_at && event.created_at !== 'undefined')
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 100)
  return NextResponse.json({ destination: '/notifications', events })
}
