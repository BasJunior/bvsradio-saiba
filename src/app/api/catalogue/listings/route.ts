import { NextResponse } from 'next/server'
import { listCatalogueMusicListings } from '@/lib/catalogue-listings'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/catalogue/listings
 * Live music catalogue rows (approved public tracks + release packages).
 */
export async function GET() {
  try {
    const payload = await listCatalogueMusicListings(250)
    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    console.error('catalogue listings GET', error)
    return NextResponse.json(
      {
        error: 'Could not load catalogue listings.',
        listings: [],
        summary: null,
      },
      { status: 500 },
    )
  }
}
