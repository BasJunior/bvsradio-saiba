"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { StationTrack } from "@/lib/station";
import { hasLibraryItem, recordListening, toggleLibraryItem } from "@/lib/library";
import { listeningBucket, trackEvent } from "@/lib/analytics";

type RepeatMode = "off" | "all" | "one";

type PlayerContextValue = {
  tracks: StationTrack[];
  current: StationTrack | undefined;
  index: number;
  isPlaying: boolean;
  volume: number;
  error: string | null;
  notice: string | null;
  history: StationTrack[];
  elapsed: number;
  duration: number;
  shuffle: boolean;
  repeat: RepeatMode;
  liked: boolean;
  toggle: () => void;
  next: () => void;
  previous: () => void;
  setVolume: (value: number) => void;
  seek: (ratio: number) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  toggleLike: () => void;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.floor(seconds);
  const m = Math.floor(whole / 60);
  const s = whole % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function trackLibraryId(track: StationTrack) {
  return track.id || `rotation-${track.src}`;
}

function shuffleOrder(length: number, avoid?: number) {
  const order = Array.from({ length }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  if (avoid !== undefined && order.length > 1 && order[0] === avoid) {
    [order[0], order[1]] = [order[1], order[0]];
  }
  return order;
}

export function StationPlayerProvider({ tracks, children }: { tracks: StationTrack[]; children: React.ReactNode }) {
  const audio = useRef<HTMLAudioElement>(null);
  const startedAt = useRef<number | null>(null);
  const countedStarts = useRef(new Set<string>());
  const failStreak = useRef(0);
  const [index, setIndex] = useState(0);
  const [isPlaying, setPlaying] = useState(false);
  const [volume, setVolume] = useState(70);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [history, setHistory] = useState<StationTrack[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>("off");
  const [shuffleQueue, setShuffleQueue] = useState<number[]>([]);
  const [liked, setLiked] = useState(false);
  const current = tracks[index];
  const shuffleRef = useRef(shuffle);
  const repeatRef = useRef(repeat);
  const shuffleQueueRef = useRef(shuffleQueue);
  const indexRef = useRef(index);
  shuffleRef.current = shuffle;
  repeatRef.current = repeat;
  shuffleQueueRef.current = shuffleQueue;
  indexRef.current = index;

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
    const releaseStationAudio = (event: Event) => {
      const owner = (event as CustomEvent<{ owner?: string }>).detail?.owner;
      if (owner !== "catalogue" || !audio.current) return;
      audio.current.pause();
      if (isPlaying) flushListening();
      setPlaying(false);
    };

    window.addEventListener("bvs:audio-claim", releaseStationAudio);
    return () => window.removeEventListener("bvs:audio-claim", releaseStationAudio);
  }, [flushListening, isPlaying]);

  useEffect(() => {
    if (!current) {
      setLiked(false);
      return;
    }
    setLiked(hasLibraryItem("favourites", trackLibraryId(current)));
    const sync = () => setLiked(hasLibraryItem("favourites", trackLibraryId(current)));
    window.addEventListener("bvs:library-change", sync);
    return () => window.removeEventListener("bvs:library-change", sync);
  }, [current]);

  useEffect(() => {
    if (!audio.current || !current) return;
    if (isPlaying) {
      window.dispatchEvent(new CustomEvent("bvs:audio-claim", { detail: { owner: "station" } }));
      audio.current.play().then(() => {
        failStreak.current = 0;
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

  const pickNextIndex = useCallback((from: number, direction: 1 | -1) => {
    if (!tracks.length) return 0;
    if (repeatRef.current === "one" && direction === 1) return from;
    if (shuffleRef.current) {
      let queue = [...shuffleQueueRef.current];
      if (!queue.length) queue = shuffleOrder(tracks.length, from);
      if (direction === 1) {
        const next = queue[0] ?? (from + 1) % tracks.length;
        const rest = queue.slice(1);
        setShuffleQueue(rest.length ? rest : shuffleOrder(tracks.length, next));
        return next;
      }
      return (from - 1 + tracks.length) % tracks.length;
    }
    return (from + direction + tracks.length) % tracks.length;
  }, [tracks.length]);

  const move = useCallback((amount: 1 | -1, opts?: { autoSkip?: boolean }) => {
    if (!tracks.length) return;
    flushListening();
    setError(null);
    if (!opts?.autoSkip) setNotice(null);
    setElapsed(0);
    setDuration(0);
    setIndex((value) => {
      const nextIndex = pickNextIndex(value, amount);
      if (isPlaying || opts?.autoSkip) {
        const nextTrack = tracks[nextIndex];
        if (nextTrack) {
          setHistory((items) => [nextTrack, ...items.filter((item) => item.src !== nextTrack.src)].slice(0, 6));
        }
      }
      return nextIndex;
    });
  }, [flushListening, isPlaying, pickNextIndex, tracks]);

  const handleMediaError = useCallback(() => {
    flushListening();
    failStreak.current += 1;
    trackEvent("playback_error", {
      track_id: current ? `rotation-${current.src}` : "unknown",
      stage: "media",
      fail_streak: failStreak.current,
    });
    if (failStreak.current >= Math.min(8, Math.max(3, tracks.length))) {
      setPlaying(false);
      setError("Several tracks failed. Check your connection and try Play again.");
      setNotice(null);
      return;
    }
    setNotice("Skipping a broken track…");
    setPlaying(true);
    move(1, { autoSkip: true });
  }, [current, flushListening, move, tracks.length]);

  const toggle = useCallback(async () => {
    if (!audio.current || !current) return setError("The rotation is being prepared.");
    try {
      if (isPlaying) {
        audio.current.pause();
        flushListening();
      } else {
        window.dispatchEvent(new CustomEvent("bvs:audio-claim", { detail: { owner: "station" } }));
        await audio.current.play();
        failStreak.current = 0;
        setHistory((items) => [current, ...items.filter((item) => item.src !== current.src)].slice(0, 6));
        recordListening({
          id: trackLibraryId(current),
          kind: "track",
          title: current.title,
          subtitle: current.artist,
          href: "/radio",
        });
      }
      setPlaying(!isPlaying);
      setError(null);
      setNotice(null);
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

  const toggleShuffle = useCallback(() => {
    setShuffle((on) => {
      const next = !on;
      if (next) setShuffleQueue(shuffleOrder(tracks.length, indexRef.current));
      else setShuffleQueue([]);
      return next;
    });
  }, [tracks.length]);

  const cycleRepeat = useCallback(() => {
    setRepeat((mode) => (mode === "off" ? "all" : mode === "all" ? "one" : "off"));
  }, []);

  const toggleLike = useCallback(() => {
    if (!current) return;
    const item = {
      id: trackLibraryId(current),
      kind: "track" as const,
      title: current.title,
      subtitle: current.artist,
      href: "/radio",
      image: current.artwork,
    };
    const next = toggleLibraryItem("favourites", item);
    setLiked(next);
    if (next) trackEvent("track_save", { track_id: item.id, source: "player" });
  }, [current]);

  const onEnded = useCallback(() => {
    if (repeatRef.current === "one") {
      const el = audio.current;
      if (el) {
        el.currentTime = 0;
        window.dispatchEvent(new CustomEvent("bvs:audio-claim", { detail: { owner: "station" } }));
        void el.play().catch(() => setPlaying(false));
      }
      return;
    }
    move(1);
  }, [move]);

  const value = useMemo(
    () => ({
      tracks,
      current,
      index,
      isPlaying,
      volume,
      error,
      notice,
      history,
      elapsed,
      duration,
      shuffle,
      repeat,
      liked,
      toggle,
      next: () => move(1),
      previous: () => move(-1),
      setVolume,
      seek,
      toggleShuffle,
      cycleRepeat,
      toggleLike,
    }),
    [
      tracks,
      current,
      index,
      isPlaying,
      volume,
      error,
      notice,
      history,
      elapsed,
      duration,
      shuffle,
      repeat,
      liked,
      move,
      toggle,
      seek,
      toggleShuffle,
      cycleRepeat,
      toggleLike,
    ],
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
        onEnded={onEnded}
        onError={handleMediaError}
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
  const repeatLabel = player.repeat === "off" ? "Repeat off" : player.repeat === "all" ? "Repeat all" : "Repeat one";
  return (
    <section className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#181818]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl" aria-label="BVS rotation player">
      <ProgressLine elapsed={player.elapsed} duration={player.duration} onSeek={player.seek} />
      {(player.error || player.notice) && (
        <p className={`px-4 py-1 text-center text-xs ${player.error ? "bg-red-500/15 text-red-200" : "bg-brand/10 text-brand"}`} role="status">
          {player.error || player.notice}
        </p>
      )}
      <div className="mx-auto flex h-20 max-w-7xl items-center gap-2 px-3 sm:gap-4 sm:px-6">
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
        <button
          type="button"
          onClick={player.toggleLike}
          disabled={!player.current}
          className={`rounded-full p-2 text-sm disabled:opacity-40 ${player.liked ? "text-brand" : "text-text-secondary hover:text-white"}`}
          aria-pressed={player.liked}
          aria-label={player.liked ? "Remove from library" : "Save to library"}
        >
          {player.liked ? "♥" : "♡"}
        </button>
        <button
          type="button"
          onClick={player.toggleShuffle}
          className={`hidden rounded-full px-2 py-1 text-xs sm:block ${player.shuffle ? "bg-brand/20 text-brand" : "text-text-secondary hover:bg-white/10"}`}
          aria-pressed={player.shuffle}
          aria-label={player.shuffle ? "Shuffle on" : "Shuffle off"}
        >
          ⇝
        </button>
        <button type="button" onClick={player.previous} className="hidden rounded-full p-2 hover:bg-white/10 sm:block" aria-label="Previous recording">◀</button>
        <button type="button" onClick={player.toggle} disabled={!player.current} className="grid h-12 w-12 place-items-center rounded-full bg-brand font-bold text-black disabled:opacity-40" aria-label={player.isPlaying ? "Pause" : "Play"}>{player.isPlaying ? "Ⅱ" : "▶"}</button>
        <button type="button" onClick={player.next} className="rounded-full p-2 hover:bg-white/10" aria-label="Next recording">▶</button>
        <button
          type="button"
          onClick={player.cycleRepeat}
          className={`hidden rounded-full px-2 py-1 text-xs sm:block ${player.repeat !== "off" ? "bg-brand/20 text-brand" : "text-text-secondary hover:bg-white/10"}`}
          aria-label={repeatLabel}
          title={repeatLabel}
        >
          {player.repeat === "one" ? "1↻" : "↻"}
        </button>
        <label className="hidden items-center gap-2 text-xs text-text-secondary md:flex">Volume<input aria-label="Volume" type="range" min="0" max="100" value={player.volume} onChange={(event) => player.setVolume(Number(event.target.value))} className="w-24 accent-brand" /></label>
        <Link href="/library" className="hidden text-sm text-brand hover:underline sm:block">Library</Link>
      </div>
    </section>
  );
}
