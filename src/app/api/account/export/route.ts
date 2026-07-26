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
  const [profile, library, orders, tracks, releases, beats, requests, writerApplications, articles, shows, episodes] = await Promise.all([
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
  ])
  const payload = {
    exportedAt: new Date().toISOString(),
    account: { id: user.id, email: user.email },
    profile: profile[0] || null,
    library,
    orders,
    creatorData: { tracks, releases, beats, requests, writerApplications, articles, shows, episodes },
  }
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="bvs-account-export-${new Date().toISOString().slice(0, 10)}.json"`,
      'Cache-Control': 'no-store',
    },
  })
}
