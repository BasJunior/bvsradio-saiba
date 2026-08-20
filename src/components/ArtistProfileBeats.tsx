'use client'

import Image from 'next/image'
import { useStationPlayer } from '@/components/StationPlayer'
import type { PublicArtist } from '@/lib/artist-content'

export default function ArtistProfileBeats({ artist, username, beats }: { artist: string; username: string; beats: NonNullable<PublicArtist['beats']> }) {
  const player = useStationPlayer()
  return <section id="beats" className="mt-8 scroll-mt-24">
    <div className="mb-4 flex items-end justify-between gap-4"><div><p className="text-xs uppercase tracking-[.18em] text-brand">BVS BeatStore</p><h2 className="mt-1 text-2xl font-semibold">Beats by {artist}</h2></div><span className="text-sm text-text-secondary">{beats.length} published</span></div>
    <div className="grid gap-4 sm:grid-cols-2">{beats.map(beat => {
      const media = beat.preview_url ? { id: beat.id, title: beat.title, artist, src: beat.preview_url, artwork: beat.artwork_url, project: 'BVS BeatStore', genre: beat.genre } : null
      const focusId = `beat:${beat.id}`
      return <article key={beat.id} data-flow-focus-id={focusId} className="scroll-mt-28 overflow-hidden rounded-2xl border border-white/10 bg-white/[.03]">
        <div className="relative aspect-[16/9] bg-white/5">{beat.artwork_url ? <Image src={beat.artwork_url} alt={`${beat.title} artwork`} fill unoptimized={/^https?:\/\//i.test(beat.artwork_url)} className="object-cover" /> : <div className="grid h-full place-items-center text-3xl text-brand/50">♫</div>}</div>
        <div className="p-4"><h3 className="font-semibold">{beat.title}</h3><p className="mt-1 text-xs text-text-secondary">{beat.genre || 'Beat'} · Licences from ${Number(beat.starting_price || 29).toFixed(2)}</p><div className="mt-4 flex gap-2">{media ? <button type="button" onClick={() => player.playNow(media, { from: `${artist} BeatStore` })} className="rounded-full bg-brand px-4 py-2 text-xs font-semibold text-black">▶ Preview</button> : null}<a data-flow-detail-skip="true" href={`/catalogue?type=beat&producer=${encodeURIComponent(username)}&q=${encodeURIComponent(beat.title)}&focus_title=${encodeURIComponent(beat.title)}#browse`} className="rounded-full border border-white/15 px-4 py-2 text-xs">Licence options →</a></div></div>
      </article>
    })}</div>
  </section>
}
