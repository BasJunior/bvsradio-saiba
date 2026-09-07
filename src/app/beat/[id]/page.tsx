import { notFound } from 'next/navigation'
import BeatWorkspace from '@/components/beats/BeatWorkspace'

export default async function BeatPage({ params }: { params: Promise<{ id: string }> }) {
  const id = String((await params).id || '').trim()
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  return <BeatWorkspace beatId={id} />
}
