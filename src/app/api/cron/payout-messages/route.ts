import { NextResponse } from 'next/server'
import { deliverPayoutMessageEmails } from '@/lib/payout-conversations'
import { isParticipationWorkerOwner } from '@/lib/participation-worker-owner'
export const dynamic = 'force-dynamic'
export const maxDuration = 120
export async function GET(request: Request) {
  if (!isParticipationWorkerOwner(process.env)) return NextResponse.json({ skipped: 'non_worker_project' })
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try { return NextResponse.json(await deliverPayoutMessageEmails()) }
  catch { return NextResponse.json({ error: 'Payout email queue unavailable.' }, { status: 503 }) }
}
