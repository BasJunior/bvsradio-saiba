"use client";

import Image from "next/image";
import { shouldBypassImageOptimizer } from "@/lib/image-optimization";
import { useStationPlayer, useStationPlayerProgress } from "./StationPlayer";

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${(whole % 60).toString().padStart(2, "0")}`;
}

export default function RadioPlayer() {
  const player = useStationPlayer();
  const timeline = useStationPlayerProgress();
  const duration = Number.isFinite(timeline.duration) ? Math.max(0, timeline.duration) : 0;
  const elapsed = Number.isFinite(timeline.elapsed) ? Math.max(0, Math.min(duration, timeline.elapsed)) : 0;

  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#19191c] p-5 sm:p-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
        <button type="button" onClick={player.openNowPlaying} className="relative mx-auto aspect-square w-44 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-xl sm:mx-0 sm:w-56 lg:w-64" aria-label="Open full player">
          {player.current?.artwork ? (
            <Image src={player.current.artwork} alt="" fill sizes="(min-width: 1024px) 256px, (min-width: 640px) 224px, 176px" unoptimized={shouldBypassImageOptimizer(player.current.artwork)} className="object-cover" />
          ) : (
            <span className="grid h-full place-items-center text-3xl font-semibold tracking-tight text-white/40">BVS Radio</span>
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[.18em]">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-white/75">{player.mode === "ondemand" ? "Your selection" : "Station rotation"}</span>
            <span className="text-text-secondary">{player.isPlaying ? "Playing" : player.current ? "Ready to listen" : "Loading station…"}</span>
          </div>
          <h2 className="mt-4 break-words text-3xl font-semibold leading-tight tracking-tight sm:text-4xl lg:text-5xl">{player.current?.title || "Independent sound. Non-stop."}</h2>
          <p className="mt-2 truncate text-base text-text-secondary sm:text-lg">{player.current?.artist || "Music from the BVS community"}</p>

          <div className="mt-6 flex items-center gap-3">
            <button type="button" onClick={player.previous} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/5 hover:bg-white/10" aria-label="Previous recording">◀</button>
            <button type="button" onClick={player.toggle} disabled={!player.current} className="flex min-h-14 items-center justify-center gap-3 rounded-full bg-brand px-7 text-sm font-semibold text-black hover:brightness-110 disabled:opacity-40" aria-label={player.isPlaying ? "Pause radio" : "Play radio"}>
              <span aria-hidden="true">{player.isPlaying ? "Ⅱ" : "▶"}</span>
              {player.isPlaying ? "Pause" : "Listen now"}
            </button>
            <button type="button" onClick={player.next} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/5 hover:bg-white/10" aria-label="Next recording">▶</button>
          </div>

          <div className="mt-5">
            <input type="range" min={0} max={duration || 1} step={0.1} value={elapsed} disabled={duration <= 0} onChange={event => { if (duration > 0) player.seek(Number(event.target.value) / duration); }} aria-label="Playback position" aria-valuetext={`${formatTime(elapsed)} of ${formatTime(duration)}`} className="block h-5 w-full cursor-pointer accent-brand disabled:cursor-default" />
            <div className="mt-1 flex justify-between text-[11px] tabular-nums text-text-secondary"><span>{formatTime(elapsed)}</span><span>{duration > 0 ? formatTime(duration) : "—"}</span></div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button type="button" onClick={player.toggleShuffle} aria-pressed={player.shuffle} className={`min-h-10 rounded-full border px-3 py-2 text-xs ${player.shuffle ? "border-brand/30 bg-brand/10 text-brand" : "border-white/10 text-text-secondary hover:text-white"}`}>Shuffle</button>
            <button type="button" onClick={player.toggleAutoplay} aria-pressed={player.autoplay} className={`min-h-10 rounded-full border px-3 py-2 text-xs ${player.autoplay ? "border-brand/30 bg-brand/10 text-brand" : "border-white/10 text-text-secondary hover:text-white"}`}>Auto-play</button>
            {player.mode === "ondemand" ? <button type="button" onClick={player.backToStation} className="min-h-10 rounded-full border border-white/15 px-3 py-2 text-xs hover:bg-white/5">Back to station</button> : <span className="px-2 text-xs text-text-secondary">{player.tracks.length ? `${player.tracks.length} recordings in rotation` : "Getting the rotation ready"}</span>}
          </div>
        </div>
      </div>
      {player.error ? <p role="alert" className="mt-5 rounded-xl bg-red-500/10 p-3 text-sm text-red-300">{player.error}</p> : player.notice ? <p role="status" className="mt-5 rounded-xl bg-white/5 p-3 text-sm text-text-secondary">{player.notice}</p> : null}
    </div>
  );
}
