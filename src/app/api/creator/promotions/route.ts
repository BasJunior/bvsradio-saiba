import { NextResponse } from 'next/server';
import { creatorHeaders, creatorIdentity, creatorJson, creatorUrl } from '@/lib/creator-server';
import { promotionItem } from '@/lib/creator-promotion-server';
import { promotionCaption } from '@/lib/creator-growth';

export async function POST(request: Request) {
  const identity = await creatorIdentity(request);
  if (!identity) return NextResponse.json({ error: 'Sign in to promote your work.' }, { status: 401 });
  try {
    const body = await request.json();
    const item = await promotionItem(String(body.kind), String(body.itemId), identity.user.id);
    if (!item) return NextResponse.json({ error: 'Only your published, approved content can be promoted.' }, { status: 403 });
    const rows = await creatorJson(await fetch(creatorUrl('creator_promotion_links?on_conflict=user_id,item_kind,item_id'), {
      method: 'POST', headers: { ...creatorHeaders, Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({ user_id: identity.user.id, item_kind: item.kind, item_id: item.id }),
    }));
    return NextResponse.json({ ...item, path: `/go/${rows[0].id}`, caption: promotionCaption(item) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ error: 'Could not prepare your promotion. Please try again.' }, { status: 503 });
  }
}
