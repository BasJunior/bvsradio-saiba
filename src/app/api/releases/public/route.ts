import { NextResponse } from 'next/server'
import { getPublicReleases } from '@/lib/public-releases'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(
    { releases: await getPublicReleases() },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  )
}
