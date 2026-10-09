"use client";

import SongShareButton from "@/components/SongShareButton";
import { useStationPlayer } from "@/components/StationPlayer";

export default function PlayerSongShareAction() {
  const player = useStationPlayer();
  const track = player.current;
  if (!player.nowPlayingOpen || !track?.id) return null;

  return (
    <div className="fixed right-4 top-[max(5.25rem,calc(env(safe-area-inset-top)+4.5rem))] z-[80] sm:right-8 sm:top-[max(6rem,calc(env(safe-area-inset-top)+5rem))]">
      <div className="rounded-full border border-white/15 bg-black/45 p-1 shadow-xl backdrop-blur-xl">
        <SongShareButton
          id={track.id}
          title={track.title || "BVS Radio"}
          artist={track.artist}
          image={track.artwork}
          compact
          triggerLabel="Share song"
        />
      </div>
    </div>
  );
}
