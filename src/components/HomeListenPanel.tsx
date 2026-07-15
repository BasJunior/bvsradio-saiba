"use client";

import Link from "next/link";
import { useStationPlayer } from "@/components/StationPlayer";

export default function HomeListenPanel() {
  const player = useStationPlayer();

  return (
    <div className="rounded-3xl border border-white/15 bg-black/55 p-5 text-left shadow-2xl backdrop-blur-xl sm:p-6">
      <div className="flex items-start justify-between gap-5">
        <div className="min-w-0">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[.2em] text-brand">BVS continuous rotation</p>
          <h2 className="truncate text-2xl font-semibold">{player.current?.title || "Library being prepared"}</h2>
          <p className="truncate text-sm text-text-secondary">{player.current?.artist || "BVS Radio"}</p>
        </div>
        <button
          type="button"
          onClick={player.toggle}
          disabled={!player.current}
          className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-brand text-lg font-bold text-black transition hover:bg-brand-dark disabled:opacity-40"
          aria-label={player.isPlaying ? "Pause BVS rotation" : "Play BVS rotation"}
        >
          {player.isPlaying ? "Ⅱ" : "▶"}
        </button>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-white/10 pt-4 text-sm">
        <span className="rounded-full bg-white/10 px-3 py-1 text-text-secondary">Automated library · not a live broadcast</span>
        <Link href="/radio" className="font-medium text-brand hover:underline">Player, schedule &amp; recently played →</Link>
      </div>
    </div>
  );
}
