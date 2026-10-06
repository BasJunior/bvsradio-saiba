import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { creatorHeaders, creatorJson, creatorUrl } from '@/lib/creator-server';
import { mediaUrlForStoredValue } from '@/lib/media-url';
import type { PromotionItem } from '@/lib/creator-growth';

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function promotionRows(path: string) {
  return creatorJson(await fetch(creatorUrl(path), { headers: creatorHeaders, cache: 'no-store', signal: AbortSignal.timeout(8000) }));
}
export async function promotionItem(kind: string, id: string, owner?: string): Promise<PromotionItem | null> {
  if (!UUID.test(id)) return null;
  if (kind === 'track') {
    const row = (await promotionRows(`tracks?id=eq.${id}&is_public=eq.true&editorial_status=eq.approved${owner ? `&user_id=eq.${owner}` : ''}&select=id,title,artwork_url&limit=1`))[0];
    return row ? { id, kind, title: row.title, path: `/song/${id}`, image: mediaUrlForStoredValue(row.artwork_url) } : null;
  }
  if (kind === 'beat') {
    const row = (await promotionRows(`beats?id=eq.${id}&is_public=eq.true&status=eq.published&rights_confirmed=eq.true${owner ? `&producer_user_id=eq.${owner}` : ''}&select=id,title,artwork_path&limit=1`))[0];
    return row ? { id, kind, title: row.title, path: `/beat/${id}#beat-licences`, image: mediaUrlForStoredValue(row.artwork_path) } : null;
  }
  if (kind === 'episode') {
    const row = (await promotionRows(`show_episodes?id=eq.${id}&status=eq.published${owner ? `&creator_id=eq.${owner}` : ''}&select=id,title,show_creator_profiles!inner(slug,status,artwork_url)&show_creator_profiles.status=eq.approved&limit=1`))[0];
    return row ? { id, kind, title: row.title, path: `/shows/${encodeURIComponent(row.show_creator_profiles.slug)}#episode-${id}`, image: mediaUrlForStoredValue(row.show_creator_profiles.artwork_url) } : null;
  }
  return null;
}
const signature = (value: string) => createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY || '').update(`bvs-promotion-v1:${value}`).digest('hex');
export function promotionCookie(id: string) {
  const payload = `${id}.${Math.floor(Date.now()/1000)+7*86400}`;
  return `${payload}.${signature(payload)}`;
}
export function readPromotionCookie(request: Request) {
  const raw = request.headers.get('cookie')?.split(';').map(x => x.trim()).find(x => x.startsWith('bvs_promotion='))?.slice(14) || '';
  const [id, expires, sig] = raw.split('.');
  if (!UUID.test(id || '') || !/^\d+$/.test(expires || '') || Number(expires)<Date.now()/1000 || !/^[a-f0-9]{64}$/.test(sig || '')) return null;
  return timingSafeEqual(Buffer.from(sig), Buffer.from(signature(`${id}.${expires}`))) ? id : null;
}
export async function attachPromotion(request: Request, properties: Record<string, string | number | boolean | null>, userId: string | null) {
  // Never trust a caller-supplied campaign id. Attribution is reporting only.
  delete properties.promotion_id;
  const id = readPromotionCookie(request);
  if (!id) return;
  const row = (await promotionRows(`creator_promotion_links?id=eq.${id}&select=user_id,item_id,item_kind&limit=1`))[0];
  if (!row || row.user_id === userId) return;
  const itemId = String(properties.track_id || properties.beat_id || '').replace(/^episode-/, '');
  if (itemId === row.item_id) properties.promotion_id = id;
}
