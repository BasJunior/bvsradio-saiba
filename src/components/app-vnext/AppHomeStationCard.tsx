"use client";

import { useStationPlayer } from "@/components/StationPlayer";

export default function AppHomeStationCard() {
  const player = useStationPlayer();

  const openPlayer = () => {
    player.setQueueOpen(false);
    player.openNowPlaying();
  };

  return (
    <section id="listen" className="scroll-mt-24 rounded-[1.65rem] border border-white/[.07] bg-white/[.025] p-5 sm:p-6" aria-labelledby="app-station-heading">
      <div className="flex flex-wrap items-center gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-brand">BVS rotation</p>
          <h2 id="app-station-heading" className="mt-2 truncate text-2xl font-semibold">{player.current?.title || "Listen across BVS"}</h2>
          <p className="mt-1 truncate text-sm text-white/42">{player.current ? `${player.current.artist} · ${player.playingFrom || "Continuous rotation"}` : "The persistent player stays with you across every tab."}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={player.toggle} disabled={!player.current} className="grid h-12 w-12 place-items-center rounded-full bg-brand font-bold text-black disabled:opacity-40" aria-label={player.isPlaying ? "Pause BVS rotation" : "Play BVS rotation"}>{player.isPlaying ? "Ⅱ" : "▶"}</button>
          <button type="button" onClick={openPlayer} className="min-h-12 rounded-full border border-white/12 px-5 text-sm font-semibold text-white/82">Open player</button>
        </div>
      </div>
    </section>
  );
}
