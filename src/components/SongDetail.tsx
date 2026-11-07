import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import AppCreatorPlayback from '@/components/app-vnext/AppCreatorPlayback';
import LibraryAction from '@/components/LibraryAction';
import AppShareButton from '@/components/app-vnext/AppShareButton';
import TrendingBadge from '@/components/TrendingBadge';
import BvsSignalPanel from '@/components/BvsSignalPanel';
import { promotionRows, UUID } from '@/lib/creator-promotion-server';
import { mediaUrlForStoredValue } from '@/lib/media-url';
import DetailHero, { DetailSection } from '@/components/DetailHero';
async function load(id: string) {
  if (!UUID.test(id)) return null;
  return (await promotionRows(`tracks?id=eq.${id}&is_public=eq.true&editorial_status=eq.approved&select=id,title,artist_name,user_id,artwork_url,genre,profiles!tracks_user_id_fkey(username)&limit=1`))[0] || null;
}
export async function songMetadata(id: string): Promise<Metadata> {
  const track = await load(id);
  return track ? { title: `${track.title} · ${track.artist_name}`, description: `Listen to ${track.title} on BVS Radio, see its BVS Signal and save the discovery.` } : { title: 'Song unavailable' };
}
export default async function SongDetail({ id, surface }: { id: string; surface?: 'ios' | 'android' }) {
  const track = await load(id);
  if (!track) notFound();
  const image = mediaUrlForStoredValue(track.artwork_url);
  const path = `/song/${track.id}`;
  const creatorHref = surface ? `/app/${surface}/creator/${encodeURIComponent(track.user_id)}` : track.profiles?.username ? `/artist/${encodeURIComponent(track.profiles.username)}` : null;
  const artist = track.artist_name || 'Artist';
  return <main className="bvs-app-page bvs-detail-page mx-auto max-w-4xl px-4 pb-14 sm:px-6" data-app-accent="lime">
    <DetailHero
      image={image}
      imageAlt={`${track.title} artwork`}
      eyebrow="Song"
      title={track.title}
      subtitle={creatorHref ? <Link href={creatorHref}>{artist}</Link> : artist}
      facts={[track.genre]}
      actions={<>
        <AppCreatorPlayback creatorId={track.user_id} creatorName={artist} startTrackId={track.id} surface={surface} compact />
        <LibraryAction item={{ id: track.id, kind: 'track', title: track.title, subtitle: track.artist_name || '', href: surface ? `/app/${surface}${path}` : path, image: image || undefined }} />
        <AppShareButton title={track.title} text="Hear where this track is moving on BVS Radio" path={path} image={image || undefined} kicker="BVS Signal" />
      </>}
    />
    <div className="flex justify-center sm:justify-start"><TrendingBadge trackId={track.id} surface={surface} /></div>
    <BvsSignalPanel trackId={track.id} source="song" title={track.title} artist={track.artist_name} artwork={image || undefined} />
    {creatorHref ? <DetailSection title={`More from ${artist}`}>
      <Link href={creatorHref} className="bvs-app-card flex items-center justify-between gap-3 p-4">
        <span><span className="block font-semibold">{artist}</span><span className="block text-sm text-white/50">Songs, releases and updates</span></span>
        <span className="text-sm font-semibold text-brand">Follow & listen →</span>
      </Link>
    </DetailSection> : null}
  </main>;
}
