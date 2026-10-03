"use client";

import { useStationPlayer } from "@/components/StationPlayer";
import type { PublishedEpisode } from "@/lib/published-shows";

export default function ShowEpisodeList({ episodes }: { episodes: PublishedEpisode[] }) {
  const player = useStationPlayer();
  const recordings = episodes.map(episode => ({ id: `episode-${episode.id}`, title: episode.title, artist: episode.showTitle, project: "BVS Shows", src: episode.audioUrl, artwork: episode.artwork }));
  if (!episodes.length) {
    return (
      <div className="mt-8 rounded-xl border border-white/10 p-5">
        <h2 className="font-semibold">Episodes will appear here</h2>
        <p className="mt-2 text-sm text-text-secondary">We will publish real recordings, guest details and track information after production begins—no filler episodes or invented play counts.</p>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-4">
      <h2 className="font-semibold">Episodes</h2>
      {episodes.map((episode) => (
        <article id={`episode-${episode.id}`} key={episode.id} className="rounded-xl border border-white/10 p-5">
          <p className="text-xs uppercase tracking-wider text-brand">
            {episode.episodeNumber ? `Episode ${episode.episodeNumber}` : "Episode"}
            {episode.durationLabel ? ` · ${episode.durationLabel}` : ""}
          </p>
          <h3 className="mt-1 text-lg font-semibold">{episode.title}</h3>
          {episode.description ? <p className="mt-2 text-sm text-text-secondary">{episode.description}</p> : null}
          <button type="button" aria-label={`${player.current?.id === `episode-${episode.id}` && player.isPlaying ? "Pause" : "Play"} ${episode.title}`} className="mt-4 inline-flex min-h-11 items-center rounded-full bg-brand px-5 py-2 text-sm font-semibold text-black" onClick={() => {
            if (player.current?.id === `episode-${episode.id}`) player.toggle();
            else player.playNow(recordings.find(track => track.id === `episode-${episode.id}`)!, { from: episode.showTitle, related: recordings.filter(track => track.id !== `episode-${episode.id}`) });
          }}>{player.current?.id === `episode-${episode.id}` && player.isPlaying ? "Pause" : "Play episode"}</button>
        </article>
      ))}
    </div>
  );
}
