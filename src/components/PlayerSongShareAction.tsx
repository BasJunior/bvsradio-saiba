"use client";

import { useRef } from "react";
import type { StationTrack } from "@/lib/station";
import { openBvsShareCard } from "@/lib/share-card";

const PUBLIC_MEDIA_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function canSharePlayerTrack(track?: StationTrack) {
  return Boolean(track?.id && PUBLIC_MEDIA_ID.test(track.id));
}

export default function PlayerSongShareAction({ track, onSelect, menu = false }: {
  track?: StationTrack;
  onSelect?: () => void;
  menu?: boolean;
}) {
  if (!track?.id || !canSharePlayerTrack(track)) return null;
  const beat = track.kind === "beat";
  return (
    <button
      type="button"
      className={menu
        ? "min-h-11 w-full px-4 py-3 text-left text-sm hover:bg-white/10 focus-visible:outline focus-visible:outline-brand"
        : "min-h-11 rounded-[4px] border border-white/15 px-4 text-sm font-semibold text-white/80 hover:border-brand/40 hover:text-white focus-visible:outline focus-visible:outline-brand"}
      onClick={() => {
        onSelect?.();
        openBvsShareCard({
          title: track.title || "BVS Radio",
          text: track.artist || "Listen on BVS Radio",
          path: `/${beat ? "beat" : "song"}/${encodeURIComponent(track.id!)}`,
          image: track.artwork,
          kicker: beat ? "BeatStore" : "Music",
        });
      }}
    >
      Share {beat ? "beat" : "song"}
    </button>
  );
}

export function PlayerMoreMenu({ track }: { track?: StationTrack }) {
  const details = useRef<HTMLDetailsElement>(null);
  if (!canSharePlayerTrack(track)) return null;
  return (
    <details ref={details} className="relative" onKeyDown={(event) => {
      if (event.key === "Escape" && details.current?.open) {
        event.stopPropagation();
        details.current.open = false;
        details.current.querySelector("summary")?.focus();
      }
    }}>
      <summary aria-label="More track actions" className="grid h-11 w-11 cursor-pointer list-none place-items-center rounded-[4px] border border-white/15 bg-white/5 text-xl backdrop-blur-sm marker:content-none [&::-webkit-details-marker]:hidden focus-visible:outline focus-visible:outline-brand">⋯</summary>
      <div className="absolute right-0 top-full z-20 mt-2 w-44 overflow-hidden rounded-[4px] border border-white/15 bg-[#141414]/95 shadow-xl backdrop-blur-md">
        <PlayerSongShareAction track={track} menu onSelect={() => { if (details.current) details.current.open = false; }} />
      </div>
    </details>
  );
}
