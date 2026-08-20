import { notFound } from 'next/navigation'
import ShowTvExperience from '@/components/ShowTvExperience'
import { flowV2Flags } from '@/lib/feature-flags'
import { getPublicProgramme, getPublicShowEvent } from '@/lib/station-content'
import { resolveShowPhase } from '@/lib/show-events'

export default async function ShowWatchPage({ params }: { params: Promise<{ slug: string }> }) {
  if (!flowV2Flags.tvExperience) notFound()
  const { slug } = await params
  const [show, event] = await Promise.all([getPublicProgramme(slug), getPublicShowEvent(slug)])
  if (!show || !event) notFound()
  const phase = resolveShowPhase(event)
  const videoUrl = phase === 'live' ? event.liveVideoUrl : phase === 'archived' ? event.replayVideoUrl : null
  if (!videoUrl) notFound()
  return <ShowTvExperience slug={slug} title={event.title || show.title} videoUrl={videoUrl} poster={show.image} replay={phase === 'archived'} />
}
