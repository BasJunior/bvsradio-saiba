import { NextResponse } from 'next/server'
import { getPublicReleases } from '@/lib/public-releases'

const PUBLIC_CACHE = 'public, max-age=0, s-maxage=60, stale-while-revalidate=300'

function requestedLimit(request: Request) {
  const raw = Number(new URL(request.url).searchParams.get('limit') || 0)
  if (!Number.isFinite(raw) || raw <= 0) return 100
  return Math.min(100, Math.max(1, Math.floor(raw)))
}

export async function GET(request: Request) {
  return NextResponse.json(
    { releases: await getPublicReleases(undefined, requestedLimit(request)) },
    { headers: { 'Cache-Control': PUBLIC_CACHE } },
  )
}
