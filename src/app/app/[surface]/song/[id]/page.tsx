import { notFound } from 'next/navigation';
import SongDetail, { songMetadata } from '@/components/SongDetail';
export const dynamic = 'force-dynamic';
export async function generateMetadata({ params }: { params: Promise<{ surface: string; id: string }> }) { return songMetadata((await params).id); }
export default async function AppSongPage({ params }: { params: Promise<{ surface: string; id: string }> }) {
  const { surface, id } = await params;
  if (surface !== 'ios' && surface !== 'android') notFound();
  return <SongDetail id={id} surface={surface} />;
}
