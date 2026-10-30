import { NextResponse } from 'next/server';
import { isParticipationWorkerOwner } from '@/lib/participation-worker-owner';
import { newsletterMailReady, newsletterRows } from '@/lib/newsletter-server';
import { deliverNewsletterBatch } from '@/lib/newsletter-delivery';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isParticipationWorkerOwner(process.env)) return NextResponse.json({ skipped: 'non_worker_project' });
  if (!newsletterMailReady()) return NextResponse.json({ error: 'Email sending is not configured.' }, { status: 503 });
  try {
    // A single bounded batch per invocation respects the existing SMTP service.
    // Drafts never enter this query; only explicitly reviewed campaigns are sent.
    const [campaign] = await newsletterRows<{ id: string }>('newsletter_campaigns?status=eq.sending&select=id&order=updated_at.asc&limit=1');
    if (!campaign) return NextResponse.json({ sent: 0, suppressed: 0, uncertain: 0 });
    const result = await deliverNewsletterBatch(campaign.id);
    return NextResponse.json({ campaignId: campaign.id, ...result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Newsletter queue unavailable.' }, { status: 503 });
  }
}
