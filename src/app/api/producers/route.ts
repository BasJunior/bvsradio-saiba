import { NextResponse } from 'next/server'
import { getPublishedProducers } from '@/lib/artist-content'
import { fairDailyOrder } from '@/lib/fair-discovery-order'

export async function GET() {
  const producers = fairDailyOrder(await getPublishedProducers(), 'producers')
  return NextResponse.json(
    { producers },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
