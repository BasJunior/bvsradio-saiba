"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { StationTrack } from "@/lib/station";
import { recordListening } from "@/lib/library";
import { listeningBucket, trackEvent } from "@/lib/analytics";

type PlayerContextValue = {
  tracks: StationTrack[];
  current: StationTrack | undefined;
  index: number;
  isPlaying: boolean;
  volume: number;
  error: string | null;
  history: StationTrack[];
  /** Seconds elapsed in current track */
  elapsed: number;
  /** Total duration of current track (0 if unknown) */
  duration: number;
  toggle: () => void;
  next: () => void;
  previous: () => void;
  setVolume: (value: number) => void;
  seek: (ratio: number) => void;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.floor(seconds);
  const m = Math.floor(whole / 60);
  const s = whole % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function StationPlayerProvider({ tracks, children }: { tracks: StationTrack[]; children: React.ReactNode }) {
  const audio = useRef<HTMLAudioElement>(null);
  const startedAt = useRef<number | null>(null);
  const countedStarts = useRef(new Set<string>());
  const [index, setIndex] = useState(0);
  const [isPlaying, setPlaying] = useState(false);
  const [volume, setVolume] = useState(70);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<StationTrack[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);
  const current = tracks[index];

  const flushListening = useCallback(() => {
    if (startedAt.current === null || !current) return;
    const seconds = Math.round((Date.now() - startedAt.current) / 1000);
    startedAt.current = null;
    const bucket = listeningBucket(seconds);
    if (bucket > 0) trackEvent("listening_duration", { track_id: `rotation-${current.src}`, seconds_bucket: bucket });
  }, [current]);

  useEffect(() => {
    if (audio.current) audio.current.volume = volume / 100;
  }, [volume]);

  useEffect(() => {
    if (!audio.current || !current) return;
    if (isPlaying) {
      audio.current.play().then(() => {
        if (startedAt.current === null) {
          startedAt.current = Date.now();
          const trackKey = current.id || `rotation-${current.src}`;
          trackEvent("player_start", { track_id: trackKey });
          if (current.id && !countedStarts.current.has(current.id)) {
            countedStarts.current.add(current.id);
            void fetch("/api/tracks/play", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ trackId: current.id, source: "station" }),
              keepalive: true,
            }).catch(() => {});
          }
        }
      }).catch(() => {
        trackEvent("playback_error", { track_id: `rotation-${current.src}`, stage: "track_change" });
        setPlaying(false);
        setError("This recording could not be played.");
      });
    }
  }, [current, isPlaying]);

  useEffect(() => {
    const stop = () => flushListening();
    window.addEventListener("pagehide", stop);
    return () => {
      window.removeEventListener("pagehide", stop);
      stop();
    };
  }, [flushListening]);

  const onTimeUpdate = useCallback(() => {
    const el = audio.current;
    if (!el) return;
    setElapsed(el.currentTime || 0);
    if (el.duration && Number.isFinite(el.duration)) setDuration(el.duration);
  }, []);

  const onLoadedMetadata = useCallback(() => {
    const el = audio.current;
    if (!el) return;
    if (el.duration && Number.isFinite(el.duration)) setDuration(el.duration);
  }, []);

  const move = useCallback((amount: number) => {
    if (!tracks.length) return;
    flushListening();
    setError(null);
    setElapsed(0);
    setDuration(0);
    setIndex((value) => {
      const nextIndex = (value + amount + tracks.length) % tracks.length;
      if (isPlaying) {
        const nextTrack = tracks[nextIndex];
        setHistory((items) => [nextTrack, ...items.filter((item) => item.src !== nextTrack.src)].slice(0, 6));
      }
      return nextIndex;
    });
  }, [flushListening, isPlaying, tracks]);

  const toggle = useCallback(async () => {
    if (!audio.current || !current) return setError("The rotation is being prepared.");
    try {
      if (isPlaying) {
        audio.current.pause();
        flushListening();
      } else {
        await audio.current.play();
        setHistory((items) => [current, ...items.filter((item) => item.src !== current.src)].slice(0, 6));
        recordListening({
          id: `rotation-${current.src}`,
          kind: "track",
          title: current.title,
          subtitle: current.artist,
          href: "/radio",
        });
      }
      setPlaying(!isPlaying);
      setError(null);
    } catch {
      setPlaying(false);
      trackEvent("playback_error", { track_id: `rotation-${current.src}`, stage: "start" });
      setError("Playback could not start. Please try again.");
    }
  }, [current, flushListening, isPlaying]);

  const seek = useCallback((ratio: number) => {
    const el = audio.current;
    if (!el || !el.duration || !Number.isFinite(el.duration)) return;
    const next = Math.min(1, Math.max(0, ratio)) * el.duration;
    el.currentTime = next;
    setElapsed(next);
  }, []);

  const value = useMemo(
    () => ({
      tracks,
      current,
      index,
      isPlaying,
      volume,
      error,
      history,
      elapsed,
      duration,
      toggle,
      next: () => move(1),
      previous: () => move(-1),
      setVolume,
      seek,
    }),
    [tracks, current, index, isPlaying, volume, error, history, elapsed, duration, move, toggle, seek],
  );

  return (
    <PlayerContext.Provider value={value}>
      {children}
      <audio
        ref={audio}
        src={current?.src}
        preload="none"
        playsInline
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoadedMetadata}
        onEnded={() => move(1)}
        onError={() => {
          flushListening();
          setPlaying(false);
          trackEvent("playback_error", { track_id: current ? `rotation-${current.src}` : "unknown", stage: "media" });
          setError("This recording is unavailable.");
        }}
      />
    </PlayerContext.Provider>
  );
}

export function useStationPlayer() {
  const context = useContext(PlayerContext);
  if (!context) throw new Error("useStationPlayer must be used inside StationPlayerProvider");
  return context;
}

function ProgressLine({
  elapsed,
  duration,
  onSeek,
  className = "",
}: {
  elapsed: number;
  duration: number;
  onSeek?: (ratio: number) => void;
  className?: string;
}) {
  const pct = duration > 0 ? Math.min(100, (elapsed / duration) * 100) : 0;
  return (
    <div
      className={`h-1 w-full cursor-pointer bg-white/15 ${className}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration || 0)}
      aria-valuenow={Math.round(elapsed)}
      aria-label="Playback progress"
      onClick={(event) => {
        if (!onSeek || duration <= 0) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const ratio = (event.clientX - rect.left) / rect.width;
        onSeek(ratio);
      }}
    >
      <div
        className="h-full bg-white transition-[width] duration-100 ease-linear"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function PersistentPlayer() {
  const player = useStationPlayer();
  const art = player.current?.artwork;
  return (
    <section className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#181818]/95 backdrop-blur-xl" aria-label="BVS rotation player">
      <ProgressLine elapsed={player.elapsed} duration={player.duration} onSeek={player.seek} />
      <div className="mx-auto flex h-20 max-w-7xl items-center gap-3 px-4 sm:gap-5 sm:px-6">
        <Link href="/radio" className="flex min-w-0 flex-1 items-center gap-3">
          <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-white/5">
            {art ? (
              // eslint-disable-next-line @next/next/no-img-element -- dynamic album covers from storage/local
              <img src={art} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="grid h-full w-full place-items-center text-[10px] text-text-secondary">BVS</span>
            )}
          </span>
          <span className="min-w-0">
          <span className="block text-[10px] font-semibold uppercase tracking-[.18em] text-brand">
            {player.current?.project || "Continuous rotation"}
          </span>
          <span className="block truncate font-medium">{player.current?.title || "BVS Radio rotation"}</span>
          <span className="block truncate text-xs text-text-secondary">
            {player.current?.artist || "BVS Radio"}
            {player.duration > 0 && (
              <span className="ml-2 tabular-nums text-white/50">
                {formatTime(player.elapsed)} / {formatTime(player.duration)}
              </span>
            )}
          </span>
          </span>
        </Link>
        <button onClick={player.previous} className="hidden rounded-full p-2 hover:bg-white/10 sm:block" aria-label="Previous recording">◀</button>
        <button onClick={player.toggle} disabled={!player.current} className="grid h-12 w-12 place-items-center rounded-full bg-brand font-bold text-black disabled:opacity-40" aria-label={player.isPlaying ? "Pause" : "Play"}>{player.isPlaying ? "Ⅱ" : "▶"}</button>
        <button onClick={player.next} className="rounded-full p-2 hover:bg-white/10" aria-label="Next recording">▶</button>
        <label className="hidden items-center gap-2 text-xs text-text-secondary md:flex">Volume<input aria-label="Volume" type="range" min="0" max="100" value={player.volume} onChange={(event) => player.setVolume(Number(event.target.value))} className="w-24 accent-brand" /></label>
        <Link href="/radio" className="hidden text-sm text-brand hover:underline sm:block">Now playing</Link>
      </div>
    </section>
  );
}
