"use client";

import { useStationPlayer } from "./StationPlayer";

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.floor(seconds);
  const m = Math.floor(whole / 60);
  const s = whole % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function Cover({ src, className }: { src?: string | null; className?: string }) {
  return (
    <div
      className={`relative shrink-0 overflow-hidden border border-white/10 bg-white/[0.06] shadow-lg ${className || ""}`}
      aria-hidden
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" decoding="async" className="absolute inset-0 h-full w-full object-cover object-center" />
      ) : (
        <span className="absolute inset-0 grid place-items-center text-xs font-semibold tracking-wide text-text-secondary">BVS</span>
      )}
    </div>
  );
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

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <div className="min-w-0 p-4 sm:p-7">
          <p className="mb-3 truncate text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-brand sm:mb-4 sm:text-left sm:text-xs sm:tracking-[0.18em]">
            Playing from {player.playingFrom}
          </p>

          <div className="flex min-w-0 items-center gap-3 sm:block sm:gap-0">
            <Cover
              src={player.current?.artwork}
              className="aspect-square h-20 w-20 rounded-xl sm:mb-5 sm:h-40 sm:w-40 sm:rounded-2xl"
            />
            <div className="min-w-0 flex-1 overflow-hidden text-left">
              <h2 className="truncate text-base font-semibold leading-snug sm:text-2xl">
                {player.current?.title || "BVS Radio rotation"}
              </h2>
              <p className="mt-0.5 truncate text-sm text-text-secondary">
                {player.current?.artist || "BVS Radio"}
              </p>
              <p className="mt-2 tabular-nums text-xs text-white/70 sm:text-sm" aria-live="polite">
                {player.duration > 0
                  ? `${formatTime(player.elapsed)} / ${formatTime(player.duration)}`
                  : player.isPlaying
                    ? "Loading…"
                    : "— / —"}
              </p>
            </div>
          </div>

          {player.error && <p className="mt-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-300">{player.error}</p>}
          {player.notice && !player.error && (
            <p className="mt-4 rounded-lg bg-brand/10 p-3 text-sm text-brand">{player.notice}</p>
          )}

          <div className="my-5 flex flex-wrap items-center justify-center gap-2 sm:my-7 sm:justify-start sm:gap-3">
            <button
              type="button"
              onClick={player.toggleShuffle}
              className={`rounded-full px-3 py-2 text-xs ${player.shuffle ? "bg-brand/20 text-brand" : "bg-white/5 hover:bg-white/10"}`}
              aria-pressed={player.shuffle}
            >
              Shuffle
            </button>
            <button type="button" onClick={player.previous} className="rounded-full bg-white/5 px-3 py-2.5 hover:bg-white/10 sm:px-4 sm:py-3" aria-label="Previous">
              ◀
            </button>
            <button
              type="button"
              onClick={player.toggle}
              disabled={!player.current}
              className="grid h-14 w-14 place-items-center rounded-full bg-brand text-xl text-black disabled:opacity-40 sm:h-16 sm:w-16"
              aria-label={player.isPlaying ? "Pause" : "Play"}
            >
              {player.isPlaying ? "Ⅱ" : "▶"}
            </button>
            <button type="button" onClick={player.next} className="rounded-full bg-white/5 px-3 py-2.5 hover:bg-white/10 sm:px-4 sm:py-3" aria-label="Next">
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

          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <button
              type="button"
              onClick={() => player.setQueueOpen(true)}
              className="rounded-full border border-white/15 px-4 py-2 text-sm hover:bg-white/5"
            >
              Open queue · {player.upNext.length}
            </button>
            {player.mode === "ondemand" ? (
              <button type="button" onClick={player.backToStation} className="rounded-full border border-brand/30 bg-brand/10 px-4 py-2 text-sm text-brand hover:bg-brand/20">
                Back to station
              </button>
            ) : (
              <span className="max-w-full truncate text-sm text-text-secondary">
                {player.tracks.length} in rotation
              </span>
            )}
          </div>
        </div>

        <div className="min-w-0 border-t border-white/10 bg-black/20 p-4 sm:p-5 lg:border-l lg:border-t-0">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand">Up next</p>
              <p className="text-xs text-text-secondary">Skip, jump, or remove</p>
            </div>
            <button type="button" onClick={player.clearQueue} className="shrink-0 text-xs text-text-secondary hover:text-white">
              Clear
            </button>
          </div>
          <ol className="max-h-[16rem] space-y-1 overflow-y-auto overscroll-contain pr-1 sm:max-h-[22rem]">
            {player.upNext.length === 0 && (
              <li className="rounded-xl border border-dashed border-white/10 px-3 py-8 text-center text-sm text-text-secondary">
                Queue empty{player.autoplay ? " — auto-play will refill." : "."}
              </li>
            )}
            {player.upNext.map((item, i) => (
              <li key={item.key} className="flex min-w-0 items-center gap-2 rounded-xl px-1.5 py-2 hover:bg-white/5">
                <span className="w-5 shrink-0 text-center text-[11px] text-text-secondary">{i + 1}</span>
                <button type="button" onClick={() => player.jumpToQueueItem(item.key)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                  <Cover src={item.track.artwork} className="h-10 w-10 rounded-md shadow-none" />
                  <span className="min-w-0 overflow-hidden">
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
                  className="shrink-0 rounded-full px-2 py-1 text-xs text-text-secondary hover:bg-white/10"
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
