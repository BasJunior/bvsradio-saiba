"use client";

/* eslint-disable @next/next/no-img-element -- covers come from signed media redirects */
import Link from "next/link";
import { useEffect, useState } from "react";
import { useStationPlayer } from "@/components/StationPlayer";
import { LibIcon } from "@/components/app-vnext/LibraryVisuals";
import type { TrendingBoard, TrendingEntry } from "@/lib/trending";
import type { MobileSurface } from "@/lib/station-library";

/** "Top 5 this week" as a real list on app Home: rank, cover, title and play. */
export default function AppHomeTopFive({ surface }: { surface: MobileSurface }) {
  const player = useStationPlayer();
  const [entries, setEntries] = useState<TrendingEntry[] | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const load = async (window: "week" | "now") => {
      const response = await fetch(`/api/trending?window=${window}`, { signal: controller.signal });
      if (!response.ok) throw new Error("Unavailable");
      return ((await response.json()) as TrendingBoard).entries || [];
    };
    load("week")
      .then(async (week) => (week.length ? week : load("now")))
      .then((rows) => { if (!controller.signal.aborted) setEntries(rows.slice(0, 5)); })
      .catch(() => { if (!controller.signal.aborted) setEntries([]); });
    return () => controller.abort();
  }, []);

  if (entries && !entries.length) return null;
  const queue = (entries || []).map((entry) => ({ id: entry.id, title: entry.title, artist: entry.artist, src: entry.src, artwork: entry.artwork, project: "BVS Top 5" }));

  return (
    <section className="bvs-app-shelf" aria-labelledby="home-top-five-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="home-top-five-heading" className="bvs-app-shelf-title">Top 5 this week</h2>
        <Link href={`/app/${surface}/trending`} className="inline-flex min-h-9 shrink-0 items-center gap-0.5 px-2 text-[13px] font-semibold text-brand">Top 20<LibIcon name="chevron" size={15} /></Link>
      </div>
      <ol className="mt-2">
        {(entries || Array.from({ length: 5 }, () => null)).map((entry, index) => {
          if (!entry) return <li key={index} className="bvs-app-row flex items-center gap-3 py-2.5" aria-hidden="true"><span className="w-5 text-center text-sm text-white/30">{index + 1}</span><span className="bvs-app-skeleton h-12 w-12" /><span className="flex-1 space-y-1.5"><span className="bvs-app-skeleton block h-3.5 w-1/2" /><span className="bvs-app-skeleton block h-3 w-1/3" /></span></li>;
          const active = player.current?.id === entry.id;
          const playing = active && player.isPlaying;
          const play = () => {
            if (active) { player.toggle(); return; }
            player.playAll(queue, { from: "BVS Top 5", startIndex: index });
            player.setQueueOpen(false);
          };
          return (
            <li key={entry.id} className="bvs-app-row flex items-center gap-3 py-2.5">
              <span className={`w-5 shrink-0 text-center text-lg font-bold tabular-nums ${index === 0 ? "text-brand" : "text-white/60"}`}>{index + 1}</span>
              <button type="button" onClick={play} aria-label={`${playing ? "Pause" : "Play"} ${entry.title}`} className="relative h-12 w-12 shrink-0 overflow-hidden bg-white/[.06]">
                {entry.artwork ? <img src={entry.artwork} alt="" className="h-full w-full object-cover" loading="lazy" /> : null}
                {playing ? <span aria-hidden="true" className="absolute inset-0 grid place-items-center bg-black/45 text-brand"><LibIcon name="waveform" size={18} /></span> : null}
              </button>
              <Link href={`/app/${surface}/song/${encodeURIComponent(entry.id)}`} className="min-w-0 flex-1">
                <span className={`block truncate text-[15px] font-semibold ${active ? "text-brand" : ""}`}>{entry.title}</span>
                <span className="block truncate text-[13px] text-white/50">{entry.artist}</span>
              </Link>
              <button type="button" onClick={play} aria-label={`${playing ? "Pause" : "Play"} ${entry.title}`} className="bvs-app-icon-button"><LibIcon name={playing ? "waveform" : "play"} size={18} /></button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
