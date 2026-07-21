"use client";

import { useStationPlayer } from "./StationPlayer";

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.floor(seconds);
  const m = Math.floor(whole / 60);
  const s = whole % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function RadioPlayer() {
  const player = useStationPlayer();
  const pct = player.duration > 0 ? Math.min(100, (player.elapsed / player.duration) * 100) : 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-bg-card/70 text-center backdrop-blur-xl">
      {/* Runtime line: fills white through the track */}
      <div
        className="h-1.5 w-full cursor-pointer bg-white/15"
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
        <div
          className="h-full bg-white transition-[width] duration-100 ease-linear"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="p-7">
        {player.current?.artwork && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={player.current.artwork}
            alt=""
            className="mx-auto mb-5 h-40 w-40 rounded-2xl border border-white/10 object-cover shadow-lg"
          />
        )}
        <p className="mb-2 text-xs font-semibold uppercase tracking-[.2em] text-brand">
          {player.current?.project || "BVS continuous rotation"}
        </p>
        <h2 className="truncate text-2xl font-semibold">{player.current?.title || "BVS Radio rotation"}</h2>
        <p className="mt-1 text-sm text-text-secondary">{player.current?.artist || "BVS Radio"}</p>

        <p className="mt-3 tabular-nums text-sm text-white/70" aria-live="polite">
          {player.duration > 0
            ? `${formatTime(player.elapsed)} / ${formatTime(player.duration)}`
            : isPlayingLabel(player.isPlaying)}
        </p>

        {player.error && <p className="mt-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-300">{player.error}</p>}

        <div className="my-7 flex items-center justify-center gap-5">
          <button onClick={player.previous} className="rounded-full bg-white/5 px-4 py-3 hover:bg-white/10" aria-label="Previous">◀</button>
          <button
            onClick={player.toggle}
            disabled={!player.current}
            className="grid h-20 w-20 place-items-center rounded-full bg-brand text-2xl text-black disabled:opacity-40"
            aria-label={player.isPlaying ? "Pause" : "Play"}
          >
            {player.isPlaying ? "Ⅱ" : "▶"}
          </button>
          <button onClick={player.next} className="rounded-full bg-white/5 px-4 py-3 hover:bg-white/10" aria-label="Next">▶</button>
        </div>
        <p className="text-sm text-text-secondary">{player.tracks.length} recordings in the current library · playback continues as you browse</p>
      </div>
    </div>
  );
}

function isPlayingLabel(playing: boolean) {
  return playing ? "Loading time…" : "— / —";
}
