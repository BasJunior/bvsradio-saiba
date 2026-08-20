import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import CommunityChat from '@/components/CommunityChat'
import ShowFollowButton from '@/components/ShowFollowButton'
import ShowVideo from '@/components/ShowVideo'
import { flowV2Flags } from '@/lib/feature-flags'
import { shows } from '@/lib/station'
import { getPublicProgramme, getPublicShowEvent } from '@/lib/station-content'
import { resolveShowPhase, showPhaseLabel } from '@/lib/show-events'

export function generateStaticParams() {
  return shows.map(({ slug }) => ({ slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const show = await getPublicProgramme((await params).slug)
  return show ? { title: show.title, description: show.description } : {}
}

function dateLabel(value: string | null) {
  if (!value) return null
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Africa/Harare',
  }).format(new Date(value)) + ' CAT'
}

export default async function ShowPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const eventPromise = flowV2Flags.showRooms || flowV2Flags.tvExperience
    ? getPublicShowEvent(slug)
    : Promise.resolve(null)
  const [show, event] = await Promise.all([getPublicProgramme(slug), eventPromise])
  if (!show) notFound()

  const phase = event ? resolveShowPhase(event) : null
  const mediaUrl = phase === 'live' ? event?.liveVideoUrl : phase === 'archived' ? event?.replayVideoUrl : null
  const hasWatchExperience = Boolean(flowV2Flags.tvExperience && mediaUrl)
  const showRoom = Boolean(flowV2Flags.showRooms && event && (phase === 'live' || phase === 'archived'))

  return (
    <div className="mx-auto max-w-5xl px-6 py-14">
      <Link href="/shows" className="text-sm text-brand hover:underline">← All shows</Link>
      <section className="mt-8 grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(18rem,.8fr)]">
        <div>
          <span className="rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs text-brand">
            {phase ? showPhaseLabel(phase) : 'Programme preview'}
          </span>
          <h1 className="mt-5 text-5xl font-semibold">{show.title}</h1>
          <p className="mt-3 text-xl text-brand">{show.tagline}</p>
          <p className="mt-6 text-lg text-text-secondary">{show.description}</p>
          <dl className="mt-8 grid gap-5 rounded-2xl border border-white/10 bg-white/[.03] p-6 sm:grid-cols-2">
            <div><dt className="text-xs uppercase tracking-wider text-text-secondary">Presented by</dt><dd className="mt-1 font-medium">{show.host}</dd></div>
            <div><dt className="text-xs uppercase tracking-wider text-text-secondary">{event?.startsAt ? 'Broadcast time' : 'Planned slot'}</dt><dd className="mt-1 font-medium">{dateLabel(event?.startsAt || null) || show.schedule}</dd></div>
          </dl>
          {flowV2Flags.showRooms ? (
            <div className="mt-6 flex flex-wrap gap-3">
              <ShowFollowButton slug={slug} title={show.title} subtitle={show.tagline} image={show.image} />
              {hasWatchExperience ? <Link href={`/shows/${slug}/watch`} className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-5 font-semibold hover:border-brand/40">Open TV mode</Link> : null}
            </div>
          ) : null}
          {!event ? (
            <div className="mt-8 rounded-xl border border-white/10 p-5">
              <h2 className="font-semibold">Episodes will appear here</h2>
              <p className="mt-2 text-sm text-text-secondary">We will publish real recordings, guest details and track information after production begins—no filler episodes or invented play counts.</p>
            </div>
          ) : phase === 'scheduled' ? (
            <div className="mt-8 rounded-xl border border-brand/20 bg-brand/[.04] p-5">
              <h2 className="font-semibold">Before the broadcast</h2>
              <p className="mt-2 text-sm text-text-secondary">Follow the show to keep it in Your BVS. The live room and video appear only after editorial starts the event.</p>
            </div>
          ) : phase === 'ended' ? (
            <div className="mt-8 rounded-xl border border-white/10 p-5">
              <h2 className="font-semibold">The broadcast has ended</h2>
              <p className="mt-2 text-sm text-text-secondary">A replay will appear only after BVS editorial publishes the verified recording.</p>
            </div>
          ) : null}
        </div>
        <div className="relative aspect-square overflow-hidden rounded-2xl border border-white/10">
          <Image src={show.image} alt={`${show.title} programme artwork`} fill priority className="object-cover" />
        </div>
      </section>

      {mediaUrl ? (
        <section className="mt-12" aria-labelledby="show-video-heading">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div><p className="text-xs uppercase tracking-[.2em] text-brand">{phase === 'live' ? 'Live broadcast' : 'Published archive'}</p><h2 id="show-video-heading" className="mt-1 text-3xl font-semibold">{event?.title || show.title}</h2></div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-white/10"><ShowVideo src={mediaUrl} poster={show.image} title={show.title} replay={phase === 'archived'} /></div>
          <p className="mt-3 text-sm text-text-secondary">Starting video pauses BVS music and preserves your queue. Music resumes only when you choose it.</p>
        </section>
      ) : null}

      {showRoom && event ? (
        <section className="mt-12" aria-labelledby="show-room-heading">
          <p className="text-xs uppercase tracking-[.2em] text-brand">BVS Room</p>
          <h2 id="show-room-heading" className="mt-1 text-3xl font-semibold">Conversation around the show</h2>
          <div className="mt-5"><CommunityChat roomId={event.roomId} roomTitle={`${show.title} room`} loginNext={`/shows/${slug}`} /></div>
        </section>
      ) : null}
    </div>
  )
}
