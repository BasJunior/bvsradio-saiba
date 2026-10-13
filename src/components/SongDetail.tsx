import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import AppCreatorPlayback from '@/components/app-vnext/AppCreatorPlayback';
import LibraryAction from '@/components/LibraryAction';
import AppShareButton from '@/components/app-vnext/AppShareButton';
import { promotionRows, UUID } from '@/lib/creator-promotion-server';
import { mediaUrlForStoredValue } from '@/lib/media-url';
async function load(id: string) {
  if (!UUID.test(id)) return null;
  return (await promotionRows(`tracks?id=eq.${id}&is_public=eq.true&editorial_status=eq.approved&select=id,title,artist_name,user_id,artwork_url,genre,profiles!tracks_user_id_fkey(username)&limit=1`))[0] || null;
}
export async function songMetadata(id: string): Promise<Metadata> {
  const track = await load(id);
  return track ? { title: `${track.title} · ${track.artist_name}`, description: `Listen to ${track.title} on BVS Radio. Save the music and follow ${track.artist_name}.` } : { title: 'Song unavailable' };
}
export default async function SongDetail({ id, surface }: { id: string; surface?: 'ios' | 'android' }) {
  const track = await load(id);
  if (!track) notFound();
  const image = mediaUrlForStoredValue(track.artwork_url);
  const path = `/song/${track.id}`;
  return <main className="mx-auto max-w-4xl px-5 py-12">
    <p className="text-sm text-brand">Listen on BVS Radio</p>
    <div className="mt-6 grid gap-8 sm:grid-cols-2">
      {image ? <Image src={image} alt={`${track.title} artwork`} width={640} height={640} unoptimized className="aspect-square w-full rounded-3xl object-cover" /> : null}
      <div><h1 className="text-4xl font-semibold">{track.title}</h1><p className="mt-3 text-xl text-text-secondary">{track.artist_name}</p>
        <div className="mt-6"><AppCreatorPlayback creatorId={track.user_id} creatorName={track.artist_name || 'Artist'} startTrackId={track.id} surface={surface} compact /></div>
        <div className="mt-5"><LibraryAction item={{ id: track.id, kind: 'track', title: track.title, subtitle: track.artist_name || '', href: surface ? `/app/${surface}${path}` : path, image: image || undefined }} /></div>
        {track.profiles?.username ? <Link className="mt-5 inline-flex min-h-11 items-center text-brand" href={surface ? `/app/${surface}/creator/${encodeURIComponent(track.user_id)}` : `/artist/${encodeURIComponent(track.profiles.username)}`}>Follow {track.artist_name}</Link> : null}
        <div className="mt-4"><AppShareButton title={track.title} text="Listen and save on BVS Radio" path={path} image={image || undefined} kicker="Music" /></div>
      </div>
    </div>
  </main>;
}
