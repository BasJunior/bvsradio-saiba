import { NextResponse } from 'next/server'
import { getPublishedArtists } from '@/lib/artist-content'
import { fairDailyOrder } from '@/lib/fair-discovery-order'

export async function GET() {
  const artists = fairDailyOrder(await getPublishedArtists(), 'artists')
  return NextResponse.json(
    { artists },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
