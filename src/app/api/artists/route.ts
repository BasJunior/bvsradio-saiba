import { NextResponse } from 'next/server'
import { getPublishedArtists } from '@/lib/artist-content'
import { fairDailyOrder } from '@/lib/fair-discovery-order'

function requestedLimit(request: Request) {
  const raw = Number(new URL(request.url).searchParams.get('limit') || 0)
  if (!Number.isFinite(raw) || raw <= 0) return null
  return Math.min(24, Math.max(1, Math.floor(raw)))
}

export async function GET(request: Request) {
  const limit = requestedLimit(request)
  const ordered = fairDailyOrder(await getPublishedArtists(), 'artists')
  const artists = limit ? ordered.slice(0, limit) : ordered
  return NextResponse.json(
    { artists },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
