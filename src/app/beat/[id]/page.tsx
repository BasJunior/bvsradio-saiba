import { notFound } from 'next/navigation'
import BeatWorkflow from '@/components/beatstore/BeatWorkflow'
import { listPublishedBeats, loadProducerProfile, publicStorageUrl } from '@/lib/beatstore-server'
import { producerPublicName } from '@/lib/public-name'

export const dynamic = 'force-dynamic'

export default async function BeatPage({ params }: { params: Promise<{ id: string }> }) {
  const id = String((await params).id || '').trim()
  const beats = await listPublishedBeats(180)
  const beat = beats.find((item) => item.id === id)
  if (!beat) notFound()

  const producer = await loadProducerProfile(beat.producer_user_id).catch(() => null)
  const producerName = producerPublicName({
    publicName: producer?.display_name,
    username: producer?.username,
  }) || 'BVS producer'

  const licences = (beat.beat_licence_options || [])
    .filter((licence) => licence.is_active !== false && !licence.is_sold_out)
    .sort((a, b) => Number(a.price_usd) - Number(b.price_usd))
    .map((licence) => ({
      id: licence.id,
      licence_code: licence.licence_code,
      licence_name: licence.licence_name,
      price_usd: Number(licence.price_usd),
      terms_summary: licence.terms_summary,
    }))

  const prices = licences.map((licence) => licence.price_usd).filter((price) => Number.isFinite(price) && price > 0)

  return <BeatWorkflow beat={{
    id: beat.id,
    slug: beat.slug,
    title: beat.title,
    producerName,
    description: beat.description,
    genre: beat.genre,
    mood: beat.mood,
    bpm: beat.bpm,
    musicalKey: beat.musical_key,
    artworkUrl: publicStorageUrl(beat.artwork_path),
    previewUrl: publicStorageUrl(beat.preview_path),
    startingPrice: prices.length ? Math.min(...prices) : null,
    licences,
  }} />
}
