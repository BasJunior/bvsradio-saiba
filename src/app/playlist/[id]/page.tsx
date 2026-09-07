import PlaylistDetailView from '@/components/library/PlaylistDetailView'

export default async function PlaylistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <PlaylistDetailView id={id} />
}
