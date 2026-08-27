import SongWorkspace from '@/components/SongWorkspace'

export default async function SongWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  return <SongWorkspace id={(await params).id} />
}
