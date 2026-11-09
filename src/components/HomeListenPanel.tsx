"use client";

import { useState } from "react";
import { useStationPlayer, useStationPlayerProgress } from "@/components/StationPlayer";
import BvsSignalPanel from "@/components/BvsSignalPanel";
import HomeArtistNote from "@/components/home/HomeArtistNote";
import FlowRelationships from "@/components/flow/FlowRelationships";

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.floor(seconds);
  const m = Math.floor(whole / 60);
  const s = whole % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Keep frequent timeline updates inside the control, away from artwork and relationships.
function ListenTimeline() {
  const player = useStationPlayer();
  const timeline = useStationPlayerProgress();
  const duration = Number.isFinite(timeline.duration) ? Math.max(0, timeline.duration) : 0;
  const elapsed = Number.isFinite(timeline.elapsed) ? Math.max(0, Math.min(duration, timeline.elapsed)) : 0;
  return (
    <div className="mt-5">
      <input type="range" min={0} max={duration || 1} step={0.1} value={elapsed}
        disabled={duration <= 0} onChange={event => player.seek(Number(event.target.value) / duration)}
        aria-label="Playback position" aria-valuetext={`${formatTime(elapsed)} of ${formatTime(duration)}`}
        className="block h-6 w-full cursor-pointer accent-brand disabled:cursor-default" />
      <div className="flex justify-between text-[11px] tabular-nums text-white/60">
        <span>{formatTime(elapsed)}</span><span>{duration > 0 ? formatTime(duration) : "—"}</span>
      </div>
    </div>
  );
}

export default function HomeListenPanel() {
  const player = useStationPlayer();
  const [failedArtwork, setFailedArtwork] = useState("");
  const art = player.current?.artwork;
  const next = player.upNext[0]?.track;

  return (
    <div className="bvs-culture-station relative min-w-0 overflow-hidden border border-white/15 bg-[#171719] text-left text-white">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(212,175,55,.12),transparent_65%)]" />
      <div className="relative p-5 sm:p-7">
        <div className="mb-5 flex items-center justify-between gap-3 border-b border-white/10 pb-4">
          <span className="text-[10px] font-semibold uppercase tracking-[.2em] text-brand">The BVS listening room</span>
          <span className="inline-flex items-center gap-2 text-[10px] font-medium text-white/65">
            <span className={`h-1.5 w-1.5 rounded-full ${player.isPlaying ? "bg-brand" : "bg-white/30"}`} aria-hidden="true" />
            {player.isPlaying ? "Playing" : "Press play"}
          </span>
        </div>
        <div className="flex items-center gap-4 sm:gap-6">
          <button type="button" onClick={player.openNowPlaying} className="relative aspect-square w-24 shrink-0 overflow-hidden border border-white/10 bg-white/[.04] sm:w-36" aria-label="Open full player">
            {art && failedArtwork !== art ? (
              // eslint-disable-next-line @next/next/no-img-element -- live editorial artwork
              <img src={art} alt="" decoding="async" onError={() => setFailedArtwork(art)} className="absolute inset-0 h-full w-full object-cover" />
            ) : <span className="absolute inset-0 grid place-items-center bg-[linear-gradient(145deg,#363326,#151515)] text-2xl font-black tracking-tighter text-brand">BVS<span className="sr-only"> Radio</span></span>}
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[10px] font-semibold uppercase tracking-[.12em] text-white/50">{player.playingFrom || "Independent sound. Non-stop."}</p>
            <h2 className="mt-2 break-words text-xl font-semibold leading-tight tracking-tight sm:text-3xl">{player.current?.title || "Your next favourite is here."}</h2>
            <p className="mt-2 truncate text-sm text-white/65">{player.current?.artist || "BVS Radio · Independent sound, worldwide"}</p>
          </div>
        </div>
        <ListenTimeline />
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button type="button" onClick={player.toggle} disabled={!player.current} className="flex min-h-12 items-center gap-3 rounded-full bg-brand px-5 text-sm font-bold text-black transition hover:brightness-110 disabled:opacity-40" aria-label={player.isPlaying ? "Pause BVS rotation" : "Play BVS rotation"}>
              <span aria-hidden="true">{player.isPlaying ? "Ⅱ" : "▶"}</span>{player.isPlaying ? "Pause" : "Listen now"}
            </button>
            <button type="button" onClick={player.next} disabled={!player.current} aria-label="Next recording" className="grid h-12 w-12 place-items-center rounded-full border border-white/15 text-sm hover:bg-white/10 disabled:opacity-40">▶|</button>
          </div>
          <button type="button" onClick={() => player.setQueueOpen(true)} className="min-h-11 px-2 text-xs font-medium text-white/70 hover:text-white" aria-label={`Open queue, ${player.upNext.length} recordings up next`}>Queue <span className="ml-1 text-brand">{player.upNext.length}</span></button>
        </div>
        {player.error ? <p role="alert" className="mt-4 border-l-2 border-red-300 bg-red-500/10 p-3 text-sm text-red-200">{player.error}</p> : player.notice ? <p role="status" className="mt-4 text-xs text-white/65">{player.notice}</p> : null}
        {next ? <button type="button" onClick={() => player.setQueueOpen(true)} className="mt-5 flex min-h-12 w-full items-center gap-3 border-t border-white/10 pt-4 text-left">
          <span className="shrink-0 text-[9px] font-bold uppercase tracking-[.16em] text-white/40">Up next</span>
          <span className="min-w-0 flex-1 truncate text-xs text-white/75">{next.title} <span className="text-white/40">· {next.artist}</span></span>
          <span aria-hidden="true" className="text-brand">↗</span>
        </button> : null}
        <BvsSignalPanel trackId={player.current?.id} source="station" title={player.current?.title} artist={player.current?.artist} artwork={player.current?.artwork} compact />
        <FlowRelationships kind="track" id={player.current?.id} compact fallbackArtist={player.current?.artist} fallbackArtwork={player.current?.artwork} />
        <HomeArtistNote />
      </div>
    </div>
  );
}
