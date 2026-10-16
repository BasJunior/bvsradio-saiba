import { NextResponse } from 'next/server'
import { isParticipationWorkerOwner } from '@/lib/participation-worker-owner'
import { trendingRpc } from '@/lib/trending-server'
export const maxDuration = 60
export async function GET(request: Request) {
  if (!isParticipationWorkerOwner(process.env)) return NextResponse.json({ skipped: 'non_worker_project' })
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return new NextResponse(null, { status: 401 })
  try { return NextResponse.json({ ok: true, result: await trendingRpc('bvs_refresh_trending', {}) }) }
  catch { return NextResponse.json({ error: 'Trending refresh failed.' }, { status: 503 }) }
}
