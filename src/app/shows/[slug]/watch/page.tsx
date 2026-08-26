import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import LiveShowViewer from '@/components/LiveShowViewer'
import ShowTvExperience from '@/components/ShowTvExperience'
import { flowV2Flags } from '@/lib/feature-flags'
import { getPublicProgramme, getPublicShowContext, getPublicShowEvent } from '@/lib/station-content'
import { resolveShowPhase, showPhaseLabel } from '@/lib/show-events'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const show = await getPublicProgramme((await params).slug)
  return show ? { title: `${show.title} Live`, description: show.description } : {}
}

export default async function ShowWatchPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [show, event] = await Promise.all([getPublicProgramme(slug), getPublicShowEvent(slug)])
  if (!show) notFound()

  if (flowV2Flags.tvExperience && event) {
    const phase = resolveShowPhase(event)
    const videoUrl = phase === 'live' ? event.liveVideoUrl : phase === 'archived' ? event.replayVideoUrl : null
    if (videoUrl) {
      const context = await getPublicShowContext(event.id)
      const now = Date.now()
      const played = context.setlist
        .filter(item => item.playedAt && Date.parse(item.playedAt) <= now)
        .sort((a, b) => Date.parse(a.playedAt || '') - Date.parse(b.playedAt || ''))
      const currentItem = phase === 'live' ? played[played.length - 1] || context.setlist[0] : context.setlist[0]
      const currentArtist = currentItem?.artistName || context.creators[0]?.publicName
      return (
        <ShowTvExperience
          slug={slug}
          title={event.title || show.title}
          videoUrl={videoUrl}
          poster={show.image}
          replay={phase === 'archived'}
          phaseLabel={showPhaseLabel(phase)}
          currentTitle={currentItem?.title}
          currentArtist={currentArtist}
        />
      )
    }
  }

  return (
    <LiveShowViewer
      slug={slug}
      fallbackShow={{
        slug: show.slug,
        title: show.title,
        host: show.host,
        artwork: show.image,
        schedule: show.schedule,
        description: show.description,
        tagline: show.tagline,
      }}
    />
  )
}
