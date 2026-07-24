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
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-bg-card/70 backdrop-blur-xl">
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
        <div className="h-full bg-white transition-[width] duration-100 ease-linear" style={{ width: `${pct}%` }} />
      </div>

      <div className="grid gap-0 lg:grid-cols-[1fr_1.05fr]">
        <div className="p-7 text-center lg:text-left">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[.2em] text-brand">
            Playing from {player.playingFrom}
          </p>
          {player.current?.artwork && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={player.current.artwork}
              alt=""
              className="mx-auto mb-5 h-40 w-40 rounded-2xl border border-white/10 object-cover shadow-lg lg:mx-0"
            />
          )}
          <h2 className="truncate text-2xl font-semibold">{player.current?.title || "BVS Radio rotation"}</h2>
          <p className="mt-1 text-sm text-text-secondary">{player.current?.artist || "BVS Radio"}</p>

          <p className="mt-3 tabular-nums text-sm text-white/70" aria-live="polite">
            {player.duration > 0
              ? `${formatTime(player.elapsed)} / ${formatTime(player.duration)}`
              : player.isPlaying
                ? "Loading time…"
                : "— / —"}
          </p>

          {player.error && <p className="mt-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-300">{player.error}</p>}
          {player.notice && !player.error && (
            <p className="mt-4 rounded-lg bg-brand/10 p-3 text-sm text-brand">{player.notice}</p>
          )}

          <div className="my-7 flex items-center justify-center gap-4 lg:justify-start">
            <button
              type="button"
              onClick={player.toggleShuffle}
              className={`rounded-full px-3 py-2 text-xs ${player.shuffle ? "bg-brand/20 text-brand" : "bg-white/5 hover:bg-white/10"}`}
              aria-pressed={player.shuffle}
            >
              Shuffle
            </button>
            <button type="button" onClick={player.previous} className="rounded-full bg-white/5 px-4 py-3 hover:bg-white/10" aria-label="Previous">
              ◀
            </button>
            <button
              type="button"
              onClick={player.toggle}
              disabled={!player.current}
              className="grid h-20 w-20 place-items-center rounded-full bg-brand text-2xl text-black disabled:opacity-40"
              aria-label={player.isPlaying ? "Pause" : "Play"}
            >
              {player.isPlaying ? "Ⅱ" : "▶"}
            </button>
            <button type="button" onClick={player.next} className="rounded-full bg-white/5 px-4 py-3 hover:bg-white/10" aria-label="Next">
              ▶
            </button>
            <button
              type="button"
              onClick={player.toggleAutoplay}
              className={`rounded-full px-3 py-2 text-xs ${player.autoplay ? "bg-brand/20 text-brand" : "bg-white/5 hover:bg-white/10"}`}
              aria-pressed={player.autoplay}
            >
              Auto-play
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-start">
            <button
              type="button"
              onClick={() => player.setQueueOpen(true)}
              className="rounded-full border border-white/15 px-4 py-2 text-sm hover:bg-white/5"
            >
              Open queue · {player.upNext.length}
            </button>
            {player.mode === "ondemand" ? (
              <button type="button" onClick={player.backToStation} className="rounded-full border border-brand/30 bg-brand/10 px-4 py-2 text-sm text-brand hover:bg-brand/20">
                Back to BVS station
              </button>
            ) : (
              <span className="text-sm text-text-secondary">{player.tracks.length} in editorial rotation</span>
            )}
          </div>
        </div>

        <div className="border-t border-white/10 bg-black/20 p-5 lg:border-l lg:border-t-0">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand">Up next</p>
              <p className="text-xs text-text-secondary">Skip, jump, or remove — you steer the list</p>
            </div>
            <button type="button" onClick={player.clearQueue} className="text-xs text-text-secondary hover:text-white">
              Clear
            </button>
          </div>
          <ol className="max-h-[22rem] space-y-1 overflow-y-auto pr-1">
            {player.upNext.length === 0 && (
              <li className="rounded-xl border border-dashed border-white/10 px-3 py-8 text-center text-sm text-text-secondary">
                Queue empty{player.autoplay ? " — auto-play will refill." : "."}
              </li>
            )}
            {player.upNext.map((item, i) => (
              <li key={item.key} className="flex items-center gap-2 rounded-xl px-2 py-2 hover:bg-white/5">
                <span className="w-5 text-center text-[11px] text-text-secondary">{i + 1}</span>
                <button type="button" onClick={() => player.jumpToQueueItem(item.key)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-white/5">
                    {item.track.artwork ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.track.artwork} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{item.track.title}</span>
                    <span className="block truncate text-xs text-text-secondary">
                      {item.track.artist}
                      {item.source === "user" ? " · You" : item.source === "mix" ? " · Similar" : ""}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => player.removeFromQueue(item.key)}
                  className="rounded-full px-2 py-1 text-xs text-text-secondary hover:bg-white/10"
                  aria-label="Remove"
                >
                  ✕
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
