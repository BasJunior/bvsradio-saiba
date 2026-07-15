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
  toggle: () => void;
  next: () => void;
  previous: () => void;
  setVolume: (value: number) => void;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function StationPlayerProvider({ tracks, children }: { tracks: StationTrack[]; children: React.ReactNode }) {
  const audio = useRef<HTMLAudioElement>(null);
  const startedAt = useRef<number | null>(null);
  const [index, setIndex] = useState(0);
  const [isPlaying, setPlaying] = useState(false);
  const [volume, setVolume] = useState(70);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<StationTrack[]>([]);
  const current = tracks[index];

  const flushListening = useCallback(() => {
    if (startedAt.current === null || !current) return;
    const seconds = Math.round((Date.now() - startedAt.current) / 1000);
    startedAt.current = null;
    const duration = listeningBucket(seconds);
    if (duration > 0) trackEvent("listening_duration", { track_id: `rotation-${current.src}`, seconds_bucket: duration });
  }, [current]);

  useEffect(() => { if (audio.current) audio.current.volume = volume / 100; }, [volume]);
  useEffect(() => {
    if (!audio.current || !current) return;
    if (isPlaying) audio.current.play().then(() => {
      if (startedAt.current === null) {
        startedAt.current = Date.now();
        trackEvent("player_start", { track_id: `rotation-${current.src}` });
      }
    }).catch(() => {
      trackEvent("playback_error", { track_id: `rotation-${current.src}`, stage: "track_change" });
      setPlaying(false);
      setError("This recording could not be played.");
    });
  }, [current, isPlaying]);
  useEffect(() => {
    const stop = () => flushListening();
    window.addEventListener("pagehide", stop);
    return () => { window.removeEventListener("pagehide", stop); stop(); };
  }, [flushListening]);

  const move = useCallback((amount: number) => {
    if (!tracks.length) return;
    flushListening();
    setError(null);
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
  const value = useMemo(() => ({ tracks, current, index, isPlaying, volume, error, history, toggle, next: () => move(1), previous: () => move(-1), setVolume }), [tracks, current, index, isPlaying, volume, error, history, move, toggle]);

  return <PlayerContext.Provider value={value}>
    {children}
    <audio ref={audio} src={current?.src} preload="none" playsInline onEnded={() => move(1)} onError={() => { flushListening(); setPlaying(false); trackEvent("playback_error", { track_id: current ? `rotation-${current.src}` : "unknown", stage: "media" }); setError("This recording is unavailable."); }} />
  </PlayerContext.Provider>;
}

export function useStationPlayer() {
  const context = useContext(PlayerContext);
  if (!context) throw new Error("useStationPlayer must be used inside StationPlayerProvider");
  return context;
}

export function PersistentPlayer() {
  const player = useStationPlayer();
  return <section className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#101018]/95 backdrop-blur-xl" aria-label="BVS rotation player">
    <div className="mx-auto flex h-20 max-w-7xl items-center gap-3 px-4 sm:gap-5 sm:px-6">
      <Link href="/radio" className="min-w-0 flex-1">
        <span className="block text-[10px] font-semibold uppercase tracking-[.18em] text-brand">Continuous rotation</span>
        <span className="block truncate font-medium">{player.current?.title || "BVS library coming soon"}</span>
        <span className="block truncate text-xs text-text-secondary">{player.current?.artist || "BVS Radio"}</span>
      </Link>
      <button onClick={player.previous} className="hidden rounded-full p-2 hover:bg-white/10 sm:block" aria-label="Previous recording">◀</button>
      <button onClick={player.toggle} disabled={!player.current} className="grid h-12 w-12 place-items-center rounded-full bg-brand font-bold text-black disabled:opacity-40" aria-label={player.isPlaying ? "Pause" : "Play"}>{player.isPlaying ? "Ⅱ" : "▶"}</button>
      <button onClick={player.next} className="rounded-full p-2 hover:bg-white/10" aria-label="Next recording">▶</button>
      <label className="hidden items-center gap-2 text-xs text-text-secondary md:flex">Volume<input aria-label="Volume" type="range" min="0" max="100" value={player.volume} onChange={(event) => player.setVolume(Number(event.target.value))} className="w-24 accent-brand" /></label>
      <Link href="/radio" className="hidden text-sm text-brand hover:underline sm:block">Now playing</Link>
    </div>
  </section>;
}
