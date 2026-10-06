import { NextResponse } from 'next/server';
import { createHmac, randomUUID } from 'node:crypto';
import { UUID, promotionCookie, promotionItem, promotionRows } from '@/lib/creator-promotion-server';
import { creatorHeaders, creatorUrl } from '@/lib/creator-server';
import { BVS_PUBLIC_ORIGIN } from '@/lib/share-url';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return new NextResponse('Promotion unavailable', { status: 404 });
  try {
    const link = (await promotionRows(`creator_promotion_links?id=eq.${id}&select=user_id,item_kind,item_id&limit=1`))[0];
    const item = link ? await promotionItem(link.item_kind, link.item_id, link.user_id) : null;
    if (!item) return new NextResponse('This content is no longer available.', { status: 404 });
    const response = NextResponse.redirect(new URL(item.path, BVS_PUBLIC_ORIGIN), 302);
    response.headers.set('Cache-Control', 'private, no-store');
    // Honor DNT and avoid treating social preview crawlers/prefetches as visits.
    if (request.headers.get('dnt') !== '1' && !/bot|crawler|spider|facebookexternalhit|preview|whatsapp/i.test(request.headers.get('user-agent') || '') && !request.headers.get('purpose')?.includes('prefetch') && !request.headers.get('sec-purpose')?.includes('prefetch')) {
      const raw = request.headers.get('cookie')?.split(';').map(x => x.trim()).find(x => x.startsWith('bvs_promo_visitor='))?.slice(18);
      const visitor = raw && UUID.test(raw) ? raw : randomUUID();
      const hash = createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY || '').update(visitor).digest('hex');
      await fetch(creatorUrl('creator_promotion_visits?on_conflict=link_id,visitor_hash,visit_day'), { method: 'POST', headers: { ...creatorHeaders, Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify({ link_id: id, visitor_hash: hash }) }).catch(() => null);
      response.cookies.set('bvs_promo_visitor', visitor, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 7*86400 });
      response.cookies.set('bvs_promotion', promotionCookie(id), { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 7*86400 });
    }
    return response;
  } catch { return new NextResponse('Promotion is temporarily unavailable.', { status: 503 }); }
}
