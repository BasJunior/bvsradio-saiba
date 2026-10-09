'use client'

import Image from 'next/image'
import Link from 'next/link'
import DiscoverMoreActions from '@/components/DiscoverMoreActions'
import LibraryAction from '@/components/LibraryAction'
import SongShareButton from '@/components/SongShareButton'
import { useStationPlayer } from '@/components/StationPlayer'
import { trackEvent } from '@/lib/analytics'
import { toDiscoveryTrack, type DiscoveryShelf, type SearchItem, type SearchKind } from '@/lib/discovery-experience'

function DiscoveryArtwork({ item }: { item: SearchItem }) {
  return <div className={`relative aspect-square overflow-hidden bg-white/[.045] ${item.kind === 'artist' || item.kind === 'producer' ? 'rounded-full' : 'rounded-2xl'}`}>
    {item.image ? <Image src={item.image} alt="" fill sizes="(max-width: 639px) 42vw, (max-width: 1023px) 25vw, 180px" unoptimized={/^https?:\/\//.test(item.image)} className="object-cover transition duration-300 group-hover:scale-105" /> : <span className="absolute inset-0 grid place-items-center text-3xl font-semibold text-brand/60" aria-hidden="true">{item.title.slice(0, 2).toUpperCase()}</span>}
  </div>
}

export default function DiscoverShelves({ shelves, round, onMore, onBrowse, onDetails }: {
  shelves: DiscoveryShelf[]
  round: number
  onMore: () => void
  onBrowse: (kind: SearchKind) => void
  onDetails: (item: SearchItem) => void
}) {
  const player = useStationPlayer()
  const picks = shelves.find(shelf => shelf.id === 'listen')?.items || []
  const queue = picks.flatMap(item => { const track = toDiscoveryTrack(item); return track ? [track] : [] })
  function playItem(item: SearchItem) {
    const track = toDiscoveryTrack(item)
    if (!track) return
    if (player.current?.id === track.id) { player.toggle(); return }
    player.playNow(track, { from: item.kind === 'beat' ? 'BVS BeatStore' : 'Discover BVS', related: item.kind === 'track' ? queue : undefined })
    trackEvent('flow_object_play', { object_kind: item.kind, object_id: item.id })
  }
  return <div className="mt-7 space-y-10" data-discovery-shelves="true">
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-brand/20 bg-brand/[.035] px-5 py-4">
      <div><p className="text-lg font-semibold">Let your next favourite find you.</p><p className="mt-1 text-sm text-text-secondary">Start listening, or take another turn through the catalogue.</p></div>
      <div className="flex flex-wrap gap-2">
        {queue.length ? <button type="button" onClick={() => { player.playAll(queue, { from: 'Discover BVS' }); trackEvent('flow_object_play', { object_kind: 'mix', source: 'discover', count: queue.length }) }} className="min-h-11 rounded-full bg-brand px-5 text-sm font-semibold text-black">▶ Play discoveries</button> : null}
        <button type="button" onClick={onMore} className="min-h-11 rounded-full border border-white/20 px-4 text-sm text-white hover:border-brand/60">Show me something new</button>
      </div>
      <span className="sr-only" role="status">Discovery selection {round + 1}</span>
    </div>
    {shelves.map(shelf => <section key={shelf.id} className={shelf.kind === 'artist' || shelf.kind === 'producer' ? 'bvs-discover-creators' : ''} aria-labelledby={`discover-${shelf.id}`}>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div><h2 id={`discover-${shelf.id}`} className="text-xl font-semibold sm:text-2xl">{shelf.title}</h2><p className="mt-1 max-w-xl text-sm text-text-secondary">{shelf.description}</p></div>
        <button type="button" onClick={() => onBrowse(shelf.kind)} className="min-h-11 shrink-0 text-sm text-brand" aria-label={`Browse all ${shelf.kind === 'artist' ? 'creators' : shelf.kind === 'release' ? 'fresh arrivals' : shelf.kind === 'story' ? 'stories' : `${shelf.kind}s`}`}>Browse all →</button>
      </div>
      <p className="mb-3 text-xs text-text-secondary">Scroll sideways → · Tap artwork to listen or explore</p>
      <div className="discovery-shelf-grid bvs-discover-rail" tabIndex={0} role="region" aria-label={`${shelf.title} — scroll horizontally`}>
        {shelf.items.map(item => {
          const playable = toDiscoveryTrack(item)
          const playing = Boolean(playable && player.current?.id === playable.id && player.isPlaying)
          const creator = item.kind === 'artist' || item.kind === 'producer'
          return <article key={item.id} className="group min-w-0" data-discovery-item={item.id} data-discovery-kind={item.kind}>
            {playable ? <button type="button" onClick={() => playItem(item)} className="relative block w-full text-left focus-visible:outline-2 focus-visible:outline-brand" aria-label={`${playing ? 'Pause' : item.kind === 'beat' ? 'Preview' : 'Play'} ${item.title}`}><DiscoveryArtwork item={item} /><span aria-hidden="true" className="absolute bottom-2 right-2 grid h-11 w-11 place-items-center bg-black/75 text-white">{playing ? 'Ⅱ' : '▶'}</span></button> : item.detail ? <button type="button" onClick={() => onDetails(item)} className="block w-full text-left focus-visible:outline-2 focus-visible:outline-brand" aria-label={`Details for ${item.title}`}><DiscoveryArtwork item={item} /></button> : <Link href={item.href} aria-label={`Open ${item.title}`} className="block focus-visible:outline-2 focus-visible:outline-brand"><DiscoveryArtwork item={item} /></Link>}
            <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-brand">{item.badge || (item.onBvs ? 'On BVS radio' : item.kind)}</p>
            {item.detail ? <button type="button" onClick={() => onDetails(item)} className="mt-1 block w-full text-left"><h3 className="line-clamp-2 text-sm font-semibold text-white sm:text-base">{item.title}</h3></button> : <Link href={item.href} className="mt-1 block"><h3 className="line-clamp-2 text-sm font-semibold text-white sm:text-base">{item.title}</h3></Link>}
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-text-secondary">{item.subtitle}</p>
            {creator || playable ? <DiscoverMoreActions title={item.title}>
              {creator || item.kind === 'track' || item.kind === 'beat' ? <LibraryAction item={{ ...item, kind: creator ? 'artist' : item.kind as 'track' | 'beat' }} section={creator ? 'follows' : 'favourites'} compact analyticsSource="discover" /> : null}
              {item.kind === 'track' ? <SongShareButton id={item.id} title={item.title} artist={item.subtitle} image={item.image} compact /> : null}
              {item.detail ? <button type="button" onClick={() => onDetails(item)} className="min-h-11 text-left text-sm text-brand">View details</button> : <Link href={item.href} className="inline-flex min-h-11 items-center text-sm text-brand">View details →</Link>}
            </DiscoverMoreActions> : null}
          </article>
        })}
      </div>
    </section>)}
  </div>
}
