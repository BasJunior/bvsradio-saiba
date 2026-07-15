"use client";

import { useStationPlayer } from "./StationPlayer";

export default function RadioPlayer() {
  const player = useStationPlayer();
  return <div className="rounded-2xl border border-white/10 bg-bg-card/70 p-7 text-center backdrop-blur-xl">
    <p className="mb-2 text-xs font-semibold uppercase tracking-[.2em] text-brand">BVS continuous rotation</p>
    <h2 className="truncate text-2xl font-semibold">{player.current?.title || "Library coming soon"}</h2>
    <p className="mt-1 text-sm text-text-secondary">{player.current?.artist || "BVS Radio"}</p>
    {player.error && <p className="mt-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-300">{player.error}</p>}
    <div className="my-7 flex items-center justify-center gap-5">
      <button onClick={player.previous} className="rounded-full bg-white/5 px-4 py-3 hover:bg-white/10" aria-label="Previous">◀</button>
      <button onClick={player.toggle} disabled={!player.current} className="grid h-20 w-20 place-items-center rounded-full bg-brand text-2xl text-black disabled:opacity-40" aria-label={player.isPlaying ? "Pause" : "Play"}>{player.isPlaying ? "Ⅱ" : "▶"}</button>
      <button onClick={player.next} className="rounded-full bg-white/5 px-4 py-3 hover:bg-white/10" aria-label="Next">▶</button>
    </div>
    <p className="text-sm text-text-secondary">{player.tracks.length} recordings in the current library · playback continues as you browse</p>
  </div>;
}
