import { NextResponse } from 'next/server'
import { listCatalogueShelves } from '@/lib/catalogue-shelves'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/catalogue/shelves
 * Live catalogue shelf cards: BeatStore + published packs + releases + curated fallbacks.
 */
export async function GET() {
  try {
    const payload = await listCatalogueShelves()
    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('catalogue shelves GET', error)
    return NextResponse.json(
      { error: 'Could not load catalogue shelves.', shelves: [], summary: null },
      { status: 500 },
    )
  }
}
