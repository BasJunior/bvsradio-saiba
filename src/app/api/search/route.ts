import { NextResponse } from 'next/server'
import { getDiscoverySnapshot, type DiscoverySurface } from '@/lib/discovery-index'
import { selectDiscoveryResults, searchKinds } from '@/lib/discovery-search-results'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** One public, surface-scoped catalogue for Discover and suggestions. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const requestedSurface = params.get('surface') || 'web'
  const type = params.get('type') || 'all'
  if (!['web', 'ios', 'android'].includes(requestedSurface) || (type !== 'all' && !searchKinds.includes(type as typeof searchKinds[number]))) {
    return NextResponse.json({ error: 'Invalid search filter.' }, { status: 400 })
  }
  try {
    const snapshot = await getDiscoverySnapshot(requestedSurface as DiscoverySurface)
    const result = selectDiscoveryResults(snapshot.items, params)
    const payload = { ...result, unavailable: snapshot.unavailable }
    return NextResponse.json(payload, {
      status: snapshot.unavailable.includes('tracks') && !result.items.length ? 503 : 200,
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch {
    return NextResponse.json({ error: 'Search is temporarily unavailable.' }, { status: 503 })
  }
}
