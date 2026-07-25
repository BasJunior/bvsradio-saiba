import { NextResponse } from 'next/server'
import { getPublishedArtists } from '@/lib/artist-content'

export async function GET() {
  const artists = await getPublishedArtists()
  return NextResponse.json(
    { artists },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
  )
}
