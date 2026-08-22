import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import CommunityChat from '@/components/CommunityChat'
import ShowFollowButton from '@/components/ShowFollowButton'
import ShowVideo from '@/components/ShowVideo'
import { flowV2Flags } from '@/lib/feature-flags'
import { shows } from '@/lib/station'
import { getPublicProgramme, getPublicShowContext, getPublicShowEvent, type PublicShowSetlistItem } from '@/lib/station-content'
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

function currentLiveSetlistItem(items: PublicShowSetlistItem[]) {
  if (!items.length) return null
  const now = Date.now()
  const played = items
    .filter(item => item.playedAt && Date.parse(item.playedAt) <= now)
    .sort((a, b) => Date.parse(a.playedAt || '') - Date.parse(b.playedAt || ''))
  return played[played.length - 1] || items[0]
}

export default async function ShowPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const eventPromise = flowV2Flags.showRooms || flowV2Flags.tvExperience
    ? getPublicShowEvent(slug)
    : Promise.resolve(null)
  const [show, event] = await Promise.all([getPublicProgramme(slug), eventPromise])
  if (!show) notFound()

  const context = event && (flowV2Flags.showRooms || flowV2Flags.tvExperience)
    ? await getPublicShowContext(event.id)
    : { creators: [], setlist: [] }
  const phase = event ? resolveShowPhase(event) : null
  const mediaUrl = phase === 'live' ? event?.liveVideoUrl : phase === 'archived' ? event?.replayVideoUrl : null
  const hasWatchExperience = Boolean(flowV2Flags.tvExperience && mediaUrl)
  const showRoom = Boolean(flowV2Flags.showRooms && event && (phase === 'live' || phase === 'archived'))
  const currentSetlistItem = phase === 'live' ? currentLiveSetlistItem(context.setlist) : null
  const setlistHeading = phase === 'live' ? 'Live setlist' : phase === 'archived' ? 'Music in this show' : 'Planned setlist'

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
          <div className="mt-6 flex flex-wrap gap-3">
            <ShowFollowButton slug={slug} title={show.title} subtitle={show.tagline} image={show.image} />
            {hasWatchExperience ? <Link href={`/shows/${slug}/watch`} className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-5 font-semibold hover:border-brand/40">Open TV mode</Link> : null}
          </div>

          {context.creators.length ? (
            <div className="mt-7">
              <p className="text-xs font-semibold uppercase tracking-[.18em] text-brand">Featuring</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {context.creators.map(creator => creator.username ? (
                  <Link
                    key={creator.id}
                    href={`/artist/${creator.username}`}
                    className="min-h-11 rounded-full border border-white/10 bg-white/[.03] px-4 py-2.5 text-sm hover:border-brand/40 hover:text-brand"
                  >
                    {creator.publicName} · {creator.role}
                  </Link>
                ) : (
                  <span key={creator.id} className="inline-flex min-h-11 items-center rounded-full border border-white/10 bg-white/[.03] px-4 py-2.5 text-sm text-text-secondary">
                    {creator.publicName} · {creator.role}
                  </span>
                ))}
              </div>
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

      {currentSetlistItem ? (
        <section className="mt-10 rounded-[2rem] border border-brand/25 bg-gradient-to-br from-brand/[.10] to-white/[.02] p-6 sm:p-8" aria-label="Current setlist item">
          <p className="text-xs font-semibold uppercase tracking-[.2em] text-brand">Now in the set</p>
          <h2 className="mt-2 text-3xl font-semibold">{currentSetlistItem.title}</h2>
          <p className="mt-1 text-lg text-text-secondary">{currentSetlistItem.artistName}</p>
          <Link href={`/search?q=${encodeURIComponent(currentSetlistItem.title)}`} className="mt-5 inline-flex min-h-11 items-center rounded-full border border-white/15 px-5 text-sm font-semibold hover:border-brand/50 hover:text-brand">
            Explore this music
          </Link>
        </section>
      ) : null}

      {context.setlist.length ? (
        <section className="mt-12" aria-labelledby="show-setlist-heading">
          <p className="text-xs uppercase tracking-[.2em] text-brand">Music context</p>
          <h2 id="show-setlist-heading" className="mt-1 text-3xl font-semibold">{setlistHeading}</h2>
          <ol className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-white/[.02]">
            {context.setlist.map((item, index) => {
              const active = currentSetlistItem?.id === item.id
              return (
                <li key={item.id} className={`flex items-center gap-4 border-b border-white/10 px-4 py-4 last:border-b-0 ${active ? 'bg-brand/[.07]' : ''}`}>
                  <span className={`w-8 shrink-0 text-center text-sm tabular-nums ${active ? 'text-brand' : 'text-text-secondary'}`}>{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/search?q=${encodeURIComponent(item.title)}`} className="font-medium hover:text-brand">{item.title}</Link>
                    <p className="mt-0.5 truncate text-sm text-text-secondary">{item.artistName}</p>
                  </div>
                  {active ? <span className="rounded-full bg-brand/15 px-3 py-1 text-xs font-semibold text-brand">Now</span> : null}
                </li>
              )
            })}
          </ol>
        </section>
      ) : null}

      {showRoom && event ? (
        <section className="mt-12" aria-labelledby="show-room-heading" id="room">
          <p className="text-xs uppercase tracking-[.2em] text-brand">BVS Room</p>
          <h2 id="show-room-heading" className="mt-1 text-3xl font-semibold">Conversation around the show</h2>
          <p className="mt-2 max-w-2xl text-sm text-text-secondary">Talk around the programme without losing the music context. Reporting and existing BVS posting rules still apply.</p>
          <div className="mt-5"><CommunityChat roomId={event.roomId} roomTitle={`${show.title} room`} loginNext={`/shows/${slug}#room`} /></div>
        </section>
      ) : null}
    </div>
  )
}
