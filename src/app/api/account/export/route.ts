import { NextResponse } from 'next/server'
import { authUserId, serviceHeaders } from '@/lib/storage-upload'

export const runtime = 'nodejs'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export async function GET(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token || !url || !service) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
  const user = await authUserId(url, service, token)
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
  const headers = serviceHeaders(service)
  const rows = async (path: string) => {
    const response = await fetch(`${url}/rest/v1/${path}`, { headers, cache: 'no-store' })
    return response.ok ? await response.json() : []
  }

  const authResponse = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: service, Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  const authAccount = authResponse.ok
    ? await authResponse.json() as { created_at?: string; user_metadata?: Record<string, unknown> }
    : null

  const [
    profile,
    library,
    orders,
    tracks,
    releases,
    beats,
    requests,
    writerApplications,
    articles,
    shows,
    episodes,
    playlists,
    roleApplications,
    notificationPreferences,
    pushDevices,
    marketplaceBookings,
    streamQualifications,
    distributionJobs,
    deposits,
    incomeEntries,
    ledgerEntries,
    payoutMethods,
    payoutRequests,
    serviceOrders,
  ] = await Promise.all([
    rows(`profiles?id=eq.${user.id}&select=*`),
    rows(`user_library_items?user_id=eq.${user.id}&select=*`),
    rows(`orders?customer_user_id=eq.${user.id}&select=*`),
    rows(`tracks?user_id=eq.${user.id}&select=*`),
    rows(`releases?user_id=eq.${user.id}&select=*`),
    rows(`beats?producer_user_id=eq.${user.id}&select=*`),
    rows(`track_review_requests?artist_user_id=eq.${user.id}&select=*`),
    rows(`writer_applications?user_id=eq.${user.id}&select=*`),
    rows(`editorial_articles?author_id=eq.${user.id}&select=*`),
    rows(`show_creator_profiles?user_id=eq.${user.id}&select=*`),
    rows(`show_episodes?creator_id=eq.${user.id}&select=*`),
    rows(`playlists?user_id=eq.${user.id}&select=*`),
    rows(`profile_role_applications?user_id=eq.${user.id}&select=*`),
    rows(`app_notification_preferences?user_id=eq.${user.id}&select=*`),
    rows(`app_push_devices?user_id=eq.${user.id}&select=id,user_id,platform,app_variant,enabled,last_seen_at,created_at,updated_at`),
    rows(`marketplace_booking_requests?buyer_user_id=eq.${user.id}&select=*`),
    rows(`stream_qualifications?user_id=eq.${user.id}&select=*`),
    rows(`distribution_jobs?artist_user_id=eq.${user.id}&select=*`),
    rows(`artist_deposits?artist_user_id=eq.${user.id}&select=*`),
    rows(`artist_income_entries?artist_user_id=eq.${user.id}&select=*`),
    rows(`artist_ledger_entries?artist_user_id=eq.${user.id}&select=*`),
    rows(`artist_payout_methods?artist_user_id=eq.${user.id}&select=*`),
    rows(`artist_payout_requests?artist_user_id=eq.${user.id}&select=*`),
    rows(`creator_service_orders?or=(buyer_user_id.eq.${user.id},seller_user_id.eq.${user.id})&select=*`),
  ])

  const playlistIds = playlists.map((playlist: { id?: string }) => playlist.id).filter(Boolean) as string[]
  const playlistTracks = playlistIds.length
    ? await rows(`playlist_tracks?playlist_id=in.(${playlistIds.join(',')})&select=*`)
    : []

  const payload = {
    exportedAt: new Date().toISOString(),
    account: {
      id: user.id,
      email: user.email,
      createdAt: authAccount?.created_at || null,
      fullName: String(authAccount?.user_metadata?.full_name || ''),
    },
    profile: profile[0] || null,
    library,
    playlists: { playlists, tracks: playlistTracks },
    notifications: { preferences: notificationPreferences, devices: pushDevices },
    roleApplications,
    orders,
    marketplace: { bookings: marketplaceBookings, serviceOrders },
    listening: { qualifiedStreams: streamQualifications },
    creatorData: {
      tracks,
      releases,
      beats,
      requests,
      writerApplications,
      articles,
      shows,
      episodes,
      distributionJobs,
      money: {
        deposits,
        incomeEntries,
        ledgerEntries,
        payoutMethods,
        payoutRequests,
      },
    },
  }
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="bvs-account-export-${new Date().toISOString().slice(0, 10)}.json"`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
