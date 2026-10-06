import { NextResponse } from 'next/server';
import { creatorHeaders, creatorIdentity, creatorJson, creatorUrl } from '@/lib/creator-server';
import { creatorGrowth, type GrowthMetrics, type GrowthRole, type PromotionItem } from '@/lib/creator-growth';
import { mediaUrlForStoredValue } from '@/lib/media-url';
import { promotionRows } from '@/lib/creator-promotion-server';

export async function GET(request: Request) {
  const identity = await creatorIdentity(request);
  if (!identity) return NextResponse.json({ error: 'Sign in to view your goals.' }, { status: 401 });
  if (!identity.profile || (identity.profile.role === 'listener' && !identity.profile.is_producer)) return NextResponse.json({ error: 'Creator access required.' }, { status: 403 });
  const owner = identity.user.id;
  const role: GrowthRole = identity.profile.role === 'show_creator' ? 'show_creator' : identity.profile.is_producer && identity.profile.role !== 'artist' ? 'producer' : 'artist';
  const requested = new URL(request.url).searchParams.get('role');
  const selected: GrowthRole = requested === 'producer' && (identity.profile.is_producer || identity.profile.role === 'admin') ? 'producer' : role;
  try {
    const rpc = async (name: string, body: object) => creatorJson(await fetch(creatorUrl(`rpc/${name}`), { method: 'POST', headers: creatorHeaders, body: JSON.stringify(body), cache: 'no-store' }));
    const [metrics, results, tracks, beats, episodes] = await Promise.all([
      rpc('creator_growth_metrics', { owner_id: owner, owner_email: identity.user.email || '', content_kind: selected === 'producer' ? 'beat' : selected === 'show_creator' ? 'episode' : 'track' }) as Promise<GrowthMetrics>,
      rpc('creator_promotion_results', { owner_id: owner }),
      promotionRows(`tracks?user_id=eq.${owner}&is_public=eq.true&editorial_status=eq.approved&select=id,title,artwork_url&order=created_at.desc&limit=100`),
      promotionRows(`beats?producer_user_id=eq.${owner}&is_public=eq.true&status=eq.published&rights_confirmed=eq.true&select=id,title,artwork_path&order=created_at.desc&limit=100`),
      promotionRows(`show_episodes?creator_id=eq.${owner}&status=eq.published&select=id,title,show_creator_profiles!inner(slug,status,artwork_url)&show_creator_profiles.status=eq.approved&order=created_at.desc&limit=100`),
    ]);
    const items: PromotionItem[] = [
      ...tracks.map((row: { id: string; title: string; artwork_url?: string }) => ({ id: row.id, title: row.title, kind: 'track' as const, path: `/song/${row.id}`, image: mediaUrlForStoredValue(row.artwork_url) })),
      ...beats.map((row: { id: string; title: string; artwork_path?: string }) => ({ id: row.id, title: row.title, kind: 'beat' as const, path: `/beat/${row.id}#beat-licences`, image: mediaUrlForStoredValue(row.artwork_path) })),
      ...episodes.map((row: { id: string; title: string; show_creator_profiles: { slug: string; artwork_url?: string } }) => ({ id: row.id, title: row.title, kind: 'episode' as const, path: `/shows/${encodeURIComponent(row.show_creator_profiles.slug)}#episode-${row.id}`, image: mediaUrlForStoredValue(row.show_creator_profiles.artwork_url) })),
    ];
    if (selected !== 'artist') metrics.listeners = 0;
    const growth = creatorGrowth(metrics, selected);
    const earned = [
      metrics.live > 0 ? selected === 'producer' ? 'beat_maker' : selected === 'show_creator' ? 'on_air' : 'first_release' : null,
      metrics.listeners >= 10 ? 'first_audience' : null,
      metrics.listeners >= 100 ? 'first_100' : null,
      metrics.sales > 0 ? 'first_sale' : null,
      ...growth.levels.filter(level => level.complete).map(level => level.id),
    ].filter(Boolean);
    if (earned.length) await creatorJson(await fetch(creatorUrl('creator_achievements?on_conflict=user_id,badge_id'), { method: 'POST', headers: { ...creatorHeaders, Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify(earned.map(badge_id => ({ user_id: owner, badge_id }))) }));
    const badges = await promotionRows(`creator_achievements?user_id=eq.${owner}&select=badge_id,earned_at&order=earned_at.desc`);
    return NextResponse.json({ role: selected, canMakeMusic: ['artist','admin'].includes(identity.profile.role), canProduce: Boolean(identity.profile.is_producer) || identity.profile.role === 'admin', metrics, ...growth, items, results, badges }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ error: 'Your goals are temporarily unavailable. Try again shortly.' }, { status: 503 });
  }
}
