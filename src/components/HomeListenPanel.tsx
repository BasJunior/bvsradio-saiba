"use client";

import Link from "next/link";
import { useStationPlayer } from "@/components/StationPlayer";

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.floor(seconds);
  const m = Math.floor(whole / 60);
  const s = whole % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function HomeListenPanel() {
  const player = useStationPlayer();
  const pct = player.duration > 0 ? Math.min(100, (player.elapsed / player.duration) * 100) : 0;
  const art = player.current?.artwork;

  return (
    <div className="min-w-0 overflow-hidden rounded-3xl border border-white/15 bg-black/65 text-left text-white shadow-2xl backdrop-blur-xl">
      <div
        className="h-1 w-full cursor-pointer bg-white/15"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={Math.round(player.duration || 0)}
        aria-valuenow={Math.round(player.elapsed)}
        aria-label="Playback progress"
        onClick={(event) => {
          if (player.duration <= 0) return;
          const rect = event.currentTarget.getBoundingClientRect();
          player.seek((event.clientX - rect.left) / rect.width);
        }}
      >
        <div className="h-full bg-white transition-[width] duration-100 ease-linear" style={{ width: `${pct}%` }} />
      </div>
      <div className="p-4 sm:p-6">
        <div className="flex items-center gap-3 sm:gap-4">
          <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/[0.06] sm:h-20 sm:w-20 sm:rounded-2xl">
            {art ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={art} alt="" decoding="async" className="absolute inset-0 h-full w-full object-cover object-center" />
            ) : (
              <span className="absolute inset-0 grid place-items-center text-[10px] font-semibold text-white/50">BVS</span>
            )}
          </span>

          <div className="min-w-0 flex-1">
            <p className="mb-1 truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-brand sm:text-[11px] sm:tracking-[0.18em]">
              Playing from {player.playingFrom || "BVS continuous rotation"}
            </p>
            <h2 className="truncate text-lg font-semibold leading-snug sm:text-2xl">
              {player.current?.title || "Library being prepared"}
            </h2>
            <p className="mt-0.5 truncate text-sm text-white/70">
              {player.current?.artist || "BVS Radio"}
            </p>
            {player.duration > 0 && (
              <p className="mt-1.5 tabular-nums text-xs text-white/65">
                {formatTime(player.elapsed)} / {formatTime(player.duration)}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={player.toggle}
            disabled={!player.current}
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand text-lg font-bold text-black transition hover:bg-brand-dark disabled:opacity-40 sm:h-14 sm:w-14"
            aria-label={player.isPlaying ? "Pause BVS rotation" : "Play BVS rotation"}
          >
            {player.isPlaying ? "Ⅱ" : "▶"}
          </button>
        </div>
        <div className="mt-4 flex flex-col gap-2 border-t border-white/10 pt-4 text-sm sm:mt-5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
          <span className="w-fit rounded-full bg-white/10 px-3 py-1 text-xs text-white/70 sm:text-sm">
            {player.mode === "ondemand" ? "On demand queue" : "Editorial rotation"} · {player.upNext.length} up next
          </span>
          <button
            type="button"
            onClick={() => player.setQueueOpen(true)}
            className="font-medium text-white/80 hover:text-white hover:underline"
          >
            Open queue
          </button>
          <Link href="/radio" className="font-medium text-brand hover:underline">
            Full player →
          </Link>
        </div>
      </div>
    </div>
  );
}
