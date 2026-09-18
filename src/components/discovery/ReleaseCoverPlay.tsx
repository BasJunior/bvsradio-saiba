"use client";

import Image from "next/image";
import type { PublicRelease } from "@/lib/public-releases";

export default function ReleaseCoverPlay({
  release,
}: {
  release: PublicRelease;
}) {
  const playable = release.tracks.filter((track) => track.src);
  const play = (startIndex = 0) => {
    const ordered = [
      ...playable.slice(startIndex),
      ...playable.slice(0, startIndex),
    ].map((track) => ({
      id: track.id,
      title: track.title,
      artist: release.artist,
      src: track.src,
      artwork: release.cover,
      project: release.title,
      genre: release.genre,
    }));
    if (!ordered.length) return;
    window.dispatchEvent(
      new CustomEvent("bvs:queue", {
        detail: { action: "play-all", tracks: ordered, from: release.title },
      }),
    );
  };

  return (
    <div className="relative aspect-square overflow-hidden bg-black/30">
      <Image
        src={release.cover}
        alt={`${release.title} cover`}
        fill
        unoptimized={/^https?:\/\//i.test(release.cover)}
        className="object-cover"
        priority
      />
      {playable.length ? (
        <button
          type="button"
          onClick={() => play(0)}
          title="Play in site player"
          aria-label={`Play ${release.title}`}
          className="absolute inset-0 grid place-items-center bg-black/10 transition hover:bg-black/25"
        >
          <span className="grid h-14 w-14 place-items-center rounded-full bg-brand text-xl font-semibold text-black shadow-[0_12px_32px_rgba(212,175,55,.35)]">
            ▶
          </span>
        </button>
      ) : null}
    </div>
  );
}
