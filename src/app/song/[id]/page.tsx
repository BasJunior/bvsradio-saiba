import SongDetail, { songMetadata } from '@/components/SongDetail';
export const dynamic = 'force-dynamic';
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) { return songMetadata((await params).id); }
export default async function SongPage({ params }: { params: Promise<{ id: string }> }) { return <SongDetail id={(await params).id} />; }
