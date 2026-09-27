"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useStationPlayer } from "@/components/StationPlayer";
import { useAppSurface } from "@/components/app/AppSurfaceProvider";
import { appLibrary } from "@/lib/app-surface";
import type { DiscoveryItem } from "@/lib/discovery";
import { trackEvent } from "@/lib/analytics";
import { readLibrary } from "@/lib/library";

export default function HomeContinueListening() {
  const player = useStationPlayer();
  const { surface, appChrome } = useAppSurface();
  const [history, setHistory] = useState<DiscoveryItem[]>([]);

  useEffect(() => {
    const sync = () => setHistory(readLibrary("history"));
    sync();
    window.addEventListener("bvs:library-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("bvs:library-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const playable = useMemo(() => {
    const byId = new Map(
      player.tracks
        .filter((track) => track.id)
        .map((track) => [track.id as string, track] as const),
    );
    return history
      .filter((item) => item.kind === "track")
      .map((item) => ({ item, track: byId.get(item.id) }))
      .filter((entry): entry is { item: DiscoveryItem; track: NonNullable<typeof entry.track> } => Boolean(entry.track))
      .slice(0, 3);
  }, [history, player.tracks]);

  if (!playable.length) return null;

  const libraryHref = appChrome && surface ? appLibrary(surface) : "/library?section=recent";

  const resume = (index: number) => {
    const selected = playable[index];
    if (!selected) return;
    const related = playable
      .filter((_, position) => position !== index)
      .map((entry) => entry.track);

    player.playNow(selected.track, {
      from: "Continue listening",
      related,
    });
    player.setQueueOpen(false);
    trackEvent("engagement_action_open", {
      activity: "continue_listening",
      source: "home",
      track_id: selected.track.id || null,
      position: index + 1,
    });
  };

  return (
    <section
      data-home-accent="listen"
      className="mt-5 overflow-hidden rounded-[1.55rem] border border-white/[.08] bg-white/[.025] p-4 sm:p-5"
      aria-labelledby="home-continue-listening-title"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="bvs-home-accent-label text-[10px] font-semibold uppercase tracking-[.18em]">
            Back to the sound
          </p>
          <h2 id="home-continue-listening-title" className="mt-1 text-xl font-semibold sm:text-2xl">
            Continue listening.
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            Pick up from something you already chose to hear.
          </p>
        </div>
        <Link href={libraryHref} className="shrink-0 text-sm font-semibold text-brand hover:underline">
          Recent listening →
        </Link>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {playable.map(({ item, track }, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => resume(index)}
            className="group flex min-w-0 items-center gap-3 rounded-[1.15rem] border border-white/[.08] bg-black/10 p-3 text-left transition hover:border-brand/30 hover:bg-white/[.04]"
            aria-label={`Continue listening to ${track.title} by ${track.artist}`}
          >
            <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-white/[.06] bg-white/[.04]">
              {track.artwork ? (
                // eslint-disable-next-line @next/next/no-img-element -- live editorial artwork
                <img src={track.artwork} alt="" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <span className="absolute inset-0 grid place-items-center text-[10px] font-semibold text-brand">BVS</span>
              )}
              <span className="absolute inset-0 grid place-items-center bg-black/25 text-sm text-white opacity-0 transition group-hover:opacity-100" aria-hidden="true">
                ▶
              </span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{track.title}</span>
              <span className="mt-0.5 block truncate text-xs text-text-secondary">{track.artist}</span>
            </span>
            <span className="shrink-0 text-brand" aria-hidden="true">▶</span>
          </button>
        ))}
      </div>
    </section>
  );
}
