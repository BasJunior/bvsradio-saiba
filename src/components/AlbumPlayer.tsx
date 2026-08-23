'use client'

import { playAllOnBvs } from '@/lib/bvs-playback'
import type { PublicRelease } from '@/lib/public-releases'

export default function AlbumPlayer({ release }: { release: PublicRelease }) {
  const stationTracks = release.tracks.map((track) => ({
    id: track.id,
    title: track.title,
    artist: release.artist,
    src: track.src,
    artwork: release.cover,
    project: release.title,
    genre: release.genre,
  }))
  const dispatch = (startIndex = 0) => {
    const ordered = [...stationTracks.slice(startIndex), ...stationTracks.slice(0, startIndex)].filter((track) => track.src)
    playAllOnBvs(ordered, { from: release.title })
  }

  return (
    <div>
      <button type="button" onClick={() => dispatch(0)} className="rounded-full bg-brand px-6 py-3 font-semibold text-black hover:bg-brand-dark">
        Play album from the beginning
      </button>
      <ol className="mt-8 divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10">
        {release.tracks.map((track, index) => (
          <li key={track.id} className="bg-white/[.025] p-4">
            <div className="flex items-start gap-4">
              <button type="button" onClick={() => dispatch(index)} aria-label={`Play ${track.title} and continue`} className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-brand/50 text-brand">▶</button>
              <div className="min-w-0 flex-1">
                <p className="font-semibold"><span className="mr-2 text-text-secondary">{track.position}.</span>{track.title}</p>
                {track.credits.length > 0 && (
                  <p className="mt-1 text-xs text-text-secondary">
                    {track.credits.map((credit) => `${credit.credit_role.replaceAll('_', ' ')}: ${credit.person_name}`).join(' · ')}
                  </p>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
