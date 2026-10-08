import { NextResponse } from 'next/server';
import { creatorIdentity } from '@/lib/creator-server';
import { newsletterRows } from '@/lib/newsletter-server';
type Subscriber = { id: string; is_active: boolean; audience: string };
export async function GET(request: Request) {
  const identity = await creatorIdentity(request);
  if (!identity) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  try {
    const rows = await newsletterRows<Subscriber>(`newsletter_subscribers?user_id=eq.${identity.user.id}&select=id,is_active,audience`);
    return NextResponse.json({ active: rows[0]?.is_active || false, audience: rows[0]?.audience || 'listener' }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch { return NextResponse.json({ error: 'Newsletter preferences unavailable.' }, { status: 503 }); }
}
export async function POST(request: Request) {
  const identity = await creatorIdentity(request);
  if (!identity?.user.email) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (typeof body.active !== 'boolean' || !['listener','artist','producer'].includes(body.audience)) return NextResponse.json({ error: 'Choose a valid newsletter preference.' }, { status: 400 });
  try {
    const now = new Date().toISOString();
    await newsletterRows('newsletter_subscribers?on_conflict=user_id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify({ user_id: identity.user.id, email: identity.user.email.toLowerCase(), audience: body.audience, is_active: body.active, subscribed_at: body.active ? now : null, unsubscribed_at: body.active ? null : now, consent_version: 'newsletter-v1', updated_at: now }) });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: 'Could not save newsletter preference.' }, { status: 503 }); }
}
