import { NextResponse } from 'next/server'
import { readTrending } from '@/lib/trending-server'
export async function GET(request: Request) {
  const window = new URL(request.url).searchParams.get('window') || 'now'
  if (window !== 'now' && window !== 'week') return NextResponse.json({ error: 'Invalid window.' }, { status: 400 })
  try { return NextResponse.json(await readTrending(window), { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60' } }) }
  catch { return NextResponse.json({ error: 'Trending is temporarily unavailable.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }) }
}
