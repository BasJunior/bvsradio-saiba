'use client'

import Image from 'next/image'
import LibraryAction from '@/components/LibraryAction'
import { playAllOnBvs, playOnBvs } from '@/lib/bvs-playback'
import type { PublicArtistTrack } from '@/lib/artist-content'
import type { DiscoveryItem } from '@/lib/discovery'

function creditLabel(person: string, role: string) {
  const rawPerson = person.trim()
  const cleanPerson = rawPerson.toLowerCase() === 'wolfbridges' ? 'Wolf Bridges' : rawPerson
  const cleanRole = role.trim()
  return `${cleanPerson} — ${cleanRole.toLowerCase() === cleanPerson.toLowerCase() ? 'Artist' : cleanRole}`
}

export default function ArtistProfileMusic({ artist, username, tracks }: { artist: string; username: string; tracks: PublicArtistTrack[] }) {
  const playable = tracks.filter(track => Boolean(track.audio_url))
  const stationTracks = playable.map(track => ({ id: track.id, title: track.title, artist, src: track.audio_url!, artwork: track.artwork_url, project: `${artist} on BVS`, genre: track.genre }))

  return <section id="music" className="mt-8 scroll-mt-24 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="text-xs uppercase tracking-[0.2em] text-brand">BVS catalogue</p><h2 className="mt-1 text-2xl font-semibold">Published music</h2></div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-text-secondary">{tracks.length} {tracks.length === 1 ? 'track' : 'tracks'}</span>
        {stationTracks.length > 0 && <button type="button" onClick={() => playAllOnBvs(stationTracks, { from: `${artist} profile` })} className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-black">▶ Play all</button>}
      </div>
    </div>
    <div className="mt-5 space-y-3">
      {tracks.map(track => {
        const stationTrack = stationTracks.find(item => item.id === track.id)
        const focusId = `track:${track.id}`
        const href = `/artist/${encodeURIComponent(username)}?focus=${encodeURIComponent(focusId)}#music`
        const item: DiscoveryItem = { id: track.id, kind: 'track', title: track.title, subtitle: artist, image: track.artwork_url, href }
        return <article
          key={track.id}
          className="scroll-mt-28 cursor-pointer rounded-xl border border-white/10 p-3 transition hover:border-brand/35"
          data-flow-focus-id={focusId}
          data-flow-detail-trigger="track"
          data-flow-detail-id={track.id}
          data-flow-detail-title={track.title}
          data-flow-detail-artist={artist}
          data-flow-detail-image={track.artwork_url || ''}
          data-flow-detail-collection={`${artist} on BVS`}
          data-flow-detail-src={track.audio_url || ''}
          data-flow-detail-href={href}
          tabIndex={0}
          role="button"
          aria-label={`Open details for ${track.title}`}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              event.currentTarget.click()
            }
          }}
        >
          <div className="flex gap-3 sm:gap-4">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-white/5">{track.artwork_url ? <Image src={track.artwork_url} alt={`${track.title} artwork`} fill unoptimized={/^https?:\/\//i.test(track.artwork_url)} className="object-cover" /> : <div className="grid h-full place-items-center text-2xl text-brand/50">♪</div>}</div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0"><h3 className="truncate font-semibold">{track.title}</h3><p className="text-xs text-text-secondary">{track.genre || 'Music'}{track.in_rotation ? ' · In BVS rotation' : ''}</p></div>
                <div data-flow-detail-skip="true" className="flex flex-wrap gap-2">
                  {stationTrack ? <button type="button" onClick={() => playOnBvs(stationTrack, { from: `${artist} profile` })} className="rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-black">▶ Play</button> : null}
                  <LibraryAction item={item} compact />
                  {track.spotify_url ? <a href={track.spotify_url} target="_blank" rel="noreferrer" className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-text-secondary hover:border-brand">Spotify ↗</a> : null}
                </div>
              </div>
              {track.credits.length > 0 && <p className="mt-3 border-t border-white/10 pt-2 text-xs text-text-secondary">Verified credits: {track.credits.map(credit => creditLabel(credit.person_name, credit.credit_role)).join(' · ')}</p>}
            </div>
          </div>
        </article>
      })}
    </div>
  </section>
}
