import type { PublishedEpisode } from "@/lib/published-shows";

export default function ShowEpisodeList({ episodes }: { episodes: PublishedEpisode[] }) {
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
        <article key={episode.id} className="rounded-xl border border-white/10 p-5">
          <p className="text-xs uppercase tracking-wider text-brand">
            {episode.episodeNumber ? `Episode ${episode.episodeNumber}` : "Episode"}
            {episode.durationLabel ? ` · ${episode.durationLabel}` : ""}
          </p>
          <h3 className="mt-1 text-lg font-semibold">{episode.title}</h3>
          {episode.description ? <p className="mt-2 text-sm text-text-secondary">{episode.description}</p> : null}
          <audio controls preload="none" src={episode.audioUrl} className="mt-4 w-full">
            <a href={episode.audioUrl}>Listen</a>
          </audio>
        </article>
      ))}
    </div>
  );
}
