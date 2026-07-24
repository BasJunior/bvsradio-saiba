"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { StationTrack } from "@/lib/station";
import { hasLibraryItem, recordListening, toggleLibraryItem } from "@/lib/library";
import { listeningBucket, trackEvent } from "@/lib/analytics";

type RepeatMode = "off" | "all" | "one";
export type ListenMode = "station" | "ondemand";
export type QueueSource = "station" | "user" | "auto" | "mix";

export type QueueItem = {
  key: string;
  track: StationTrack;
  source: QueueSource;
};

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
  mode: ListenMode;
  playingFrom: string;
  upNext: QueueItem[];
  autoplay: boolean;
  queueOpen: boolean;
  setQueueOpen: (open: boolean) => void;
  toggle: () => void;
  next: () => void;
  previous: () => void;
  setVolume: (value: number) => void;
  seek: (ratio: number) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  toggleLike: () => void;
  toggleAutoplay: () => void;
  playNow: (track: StationTrack, opts?: { from?: string; related?: StationTrack[] }) => void;
  playNext: (track: StationTrack) => void;
  addToQueue: (track: StationTrack) => void;
  playAll: (list: StationTrack[], opts?: { from?: string; startIndex?: number }) => void;
  removeFromQueue: (key: string) => void;
  clearQueue: () => void;
  jumpToQueueItem: (key: string) => void;
  backToStation: () => void;
  playHistoryTrack: (track: StationTrack) => void;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);
const QUEUE_STORAGE_KEY = "bvs.player.queue.v1";
const UP_NEXT_TARGET = 18;

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

function trackKey(track: StationTrack) {
  return track.id || track.src;
}

function makeQueueItem(track: StationTrack, source: QueueSource): QueueItem {
  return {
    key: `${trackKey(track)}-${source}-${Math.random().toString(36).slice(2, 8)}`,
    track,
    source,
  };
}

function normalizeText(value: string | undefined) {
  return (value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function similarScore(seed: StationTrack, candidate: StationTrack) {
  let score = 0;
  if (normalizeText(seed.artist) && normalizeText(seed.artist) === normalizeText(candidate.artist)) score += 5;
  if (normalizeText(seed.project) && normalizeText(seed.project) === normalizeText(candidate.project)) score += 3;
  if (normalizeText(seed.genre) && normalizeText(seed.genre) === normalizeText(candidate.genre)) score += 4;
  if (normalizeText(seed.title) && normalizeText(candidate.title).includes(normalizeText(seed.title).slice(0, 6))) score += 1;
  return score;
}

function pickSimilar(seed: StationTrack | undefined, pool: StationTrack[], exclude: Set<string>, count: number) {
  if (!seed || !pool.length || count <= 0) return [] as StationTrack[];
  const ranked = pool
    .filter((t) => t.src && !exclude.has(trackKey(t)))
    .map((t) => ({ t, s: similarScore(seed, t) }))
    .sort((a, b) => b.s - a.s || Math.random() - 0.5);
  const strong = ranked.filter((r) => r.s > 0).map((r) => r.t);
  const weak = ranked.filter((r) => r.s === 0).map((r) => r.t);
  return [...strong, ...weak].slice(0, count);
}

function shuffleArray<T>(items: T[]) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function StationPlayerProvider({ tracks, children }: { tracks: StationTrack[]; children: React.ReactNode }) {
  const audio = useRef<HTMLAudioElement>(null);
  const startedAt = useRef<number | null>(null);
  const countedStarts = useRef(new Set<string>());
  const failStreak = useRef(0);
  const hydrated = useRef(false);

  const [nowPlaying, setNowPlaying] = useState<QueueItem | null>(() =>
    tracks[0] ? makeQueueItem(tracks[0], "station") : null,
  );
  const [upNext, setUpNext] = useState<QueueItem[]>([]);
  const [isPlaying, setPlaying] = useState(false);
  const [volume, setVolume] = useState(70);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [history, setHistory] = useState<StationTrack[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>("off");
  const [liked, setLiked] = useState(false);
  const [mode, setMode] = useState<ListenMode>("station");
  const [playingFrom, setPlayingFrom] = useState("BVS Station");
  const [autoplay, setAutoplay] = useState(true);
  const [queueOpen, setQueueOpen] = useState(false);

  const current = nowPlaying?.track;
  const tracksRef = useRef(tracks);
  const nowRef = useRef(nowPlaying);
  const upNextRef = useRef(upNext);
  const modeRef = useRef(mode);
  const autoplayRef = useRef(autoplay);
  const shuffleRef = useRef(shuffle);
  const repeatRef = useRef(repeat);
  tracksRef.current = tracks;
  nowRef.current = nowPlaying;
  upNextRef.current = upNext;
  modeRef.current = mode;
  autoplayRef.current = autoplay;
  shuffleRef.current = shuffle;
  repeatRef.current = repeat;

  const index = useMemo(() => {
    if (!current) return 0;
    const i = tracks.findIndex((t) => trackKey(t) === trackKey(current));
    return i >= 0 ? i : 0;
  }, [current, tracks]);

  const flushListening = useCallback(() => {
    if (startedAt.current === null || !current) return;
    const seconds = Math.round((Date.now() - startedAt.current) / 1000);
    startedAt.current = null;
    const bucket = listeningBucket(seconds);
    if (bucket > 0) trackEvent("listening_duration", { track_id: `rotation-${current.src}`, seconds_bucket: bucket });
  }, [current]);

  const pushHistory = useCallback((track: StationTrack) => {
    setHistory((items) => [track, ...items.filter((item) => trackKey(item) !== trackKey(track))].slice(0, 40));
  }, []);

  const excludeKeys = useCallback((extra: StationTrack[] = []) => {
    const set = new Set<string>();
    if (nowRef.current) set.add(trackKey(nowRef.current.track));
    for (const item of upNextRef.current) set.add(trackKey(item.track));
    for (const t of extra) set.add(trackKey(t));
    return set;
  }, []);

  const fillUpNext = useCallback(
    (seed: StationTrack | undefined, existing: QueueItem[], preferUserKeep = true) => {
      const pool = tracksRef.current;
      if (!pool.length) return existing;
      const userItems = preferUserKeep ? existing.filter((i) => i.source === "user") : [];
      const autoTail = existing.filter((i) => i.source !== "user");
      const exclude = new Set<string>();
      if (seed) exclude.add(trackKey(seed));
      for (const i of userItems) exclude.add(trackKey(i.track));
      for (const i of autoTail) exclude.add(trackKey(i.track));

      const need = Math.max(0, UP_NEXT_TARGET - userItems.length - autoTail.length);
      let additions: StationTrack[] = [];

      if (modeRef.current === "ondemand" && seed) {
        additions = pickSimilar(seed, pool, exclude, need);
      } else if (shuffleRef.current) {
        additions = shuffleArray(pool.filter((t) => !exclude.has(trackKey(t)))).slice(0, need);
      } else {
        const start = seed ? Math.max(0, pool.findIndex((t) => trackKey(t) === trackKey(seed))) : -1;
        const ordered: StationTrack[] = [];
        for (let n = 1; n <= pool.length && ordered.length < need; n += 1) {
          const t = pool[(start + n + pool.length) % pool.length];
          if (t && !exclude.has(trackKey(t))) {
            exclude.add(trackKey(t));
            ordered.push(t);
          }
        }
        additions = ordered;
      }

      // favourites boost (phase 3 light personalization)
      try {
        const favBoost = pickSimilar(seed, pool, exclude, Math.min(3, need)).filter((t) =>
          hasLibraryItem("favourites", trackLibraryId(t)),
        );
        for (const t of favBoost) {
          if (!additions.some((a) => trackKey(a) === trackKey(t))) additions.unshift(t);
        }
        additions = additions.slice(0, need);
      } catch {
        /* ignore SSR/library */
      }

      const source: QueueSource = modeRef.current === "ondemand" ? "auto" : "station";
      const filledAuto = [
        ...autoTail,
        ...additions.map((t) => makeQueueItem(t, modeRef.current === "ondemand" && similarScore(seed!, t) > 0 ? "mix" : source)),
      ];
      return [...userItems, ...filledAuto].slice(0, UP_NEXT_TARGET + userItems.length);
    },
    [],
  );

  // Hydrate + seed queue when tracks arrive
  useEffect(() => {
    if (!tracks.length) return;
    if (!hydrated.current) {
      hydrated.current = true;
      try {
        const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw) as {
            mode?: ListenMode;
            playingFrom?: string;
            autoplay?: boolean;
            shuffle?: boolean;
            volume?: number;
            nowKey?: string;
            upKeys?: string[];
          };
          if (typeof saved.autoplay === "boolean") setAutoplay(saved.autoplay);
          if (typeof saved.shuffle === "boolean") setShuffle(saved.shuffle);
          if (typeof saved.volume === "number") setVolume(saved.volume);
          if (saved.playingFrom) setPlayingFrom(saved.playingFrom);
          if (saved.mode === "station" || saved.mode === "ondemand") setMode(saved.mode);
          const byKey = new Map(tracks.map((t) => [trackKey(t), t]));
          const nowTrack = (saved.nowKey && byKey.get(saved.nowKey)) || tracks[0];
          const nowItem = makeQueueItem(nowTrack, saved.mode === "ondemand" ? "user" : "station");
          setNowPlaying(nowItem);
          const restoredUp = (saved.upKeys || [])
            .map((k) => byKey.get(k))
            .filter(Boolean)
            .map((t) => makeQueueItem(t as StationTrack, "station"));
          setUpNext(fillUpNext(nowTrack, restoredUp));
          return;
        }
      } catch {
        /* ignore */
      }
    }

    setNowPlaying((prev) => {
      if (prev && tracks.some((t) => trackKey(t) === trackKey(prev.track))) return prev;
      return makeQueueItem(tracks[0], "station");
    });
    setUpNext((prev) => {
      const seed = nowRef.current?.track || tracks[0];
      if (prev.length >= 8) return prev;
      return fillUpNext(seed, prev);
    });
  }, [tracks, fillUpNext]);

  // Persist queue prefs
  useEffect(() => {
    if (typeof window === "undefined" || !nowPlaying) return;
    try {
      localStorage.setItem(
        QUEUE_STORAGE_KEY,
        JSON.stringify({
          mode,
          playingFrom,
          autoplay,
          shuffle,
          volume,
          nowKey: trackKey(nowPlaying.track),
          upKeys: upNext.map((i) => trackKey(i.track)).slice(0, 40),
        }),
      );
    } catch {
      /* ignore */
    }
  }, [mode, playingFrom, autoplay, shuffle, volume, nowPlaying, upNext]);

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
      audio.current
        .play()
        .then(() => {
          failStreak.current = 0;
          if (startedAt.current === null) {
            startedAt.current = Date.now();
            const trackId = current.id || `rotation-${current.src}`;
            trackEvent("player_start", { track_id: trackId });
            if (current.id && !countedStarts.current.has(current.id)) {
              countedStarts.current.add(current.id);
              void fetch("/api/tracks/play", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ trackId: current.id, source: modeRef.current === "ondemand" ? "queue" : "station" }),
                keepalive: true,
              }).catch(() => {});
            }
          }
        })
        .catch(() => {
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

  const advance = useCallback(
    (direction: 1 | -1, opts?: { autoSkip?: boolean }) => {
      const pool = tracksRef.current;
      if (!pool.length) return;
      flushListening();
      setError(null);
      if (!opts?.autoSkip) setNotice(null);
      setElapsed(0);
      setDuration(0);

      if (direction === -1) {
        const el = audio.current;
        if (el && el.currentTime > 3) {
          el.currentTime = 0;
          setElapsed(0);
          return;
        }
        const prev = history[0];
        if (prev) {
          const item = makeQueueItem(prev, "user");
          setNowPlaying((cur) => {
            if (cur) setUpNext((q) => [cur, ...q].slice(0, UP_NEXT_TARGET + 5));
            return item;
          });
          setHistory((h) => h.slice(1));
          return;
        }
      }

      if (repeatRef.current === "one" && direction === 1 && !opts?.autoSkip) {
        const el = audio.current;
        if (el) {
          el.currentTime = 0;
          void el.play().catch(() => setPlaying(false));
        }
        return;
      }

      setUpNext((queue) => {
        let nextQueue = [...queue];
        let nextItem = nextQueue.shift();

        if (!nextItem && autoplayRef.current) {
          const seed = nowRef.current?.track;
          nextQueue = fillUpNext(seed, []);
          nextItem = nextQueue.shift();
        }

        if (!nextItem && pool.length) {
          const i = nowRef.current ? pool.findIndex((t) => trackKey(t) === trackKey(nowRef.current!.track)) : 0;
          const t = pool[(Math.max(0, i) + 1) % pool.length];
          nextItem = makeQueueItem(t, "station");
        }

        if (nextItem) {
          if (nowRef.current) pushHistory(nowRef.current.track);
          setNowPlaying(nextItem);
          const filled = autoplayRef.current ? fillUpNext(nextItem.track, nextQueue) : nextQueue;
          return filled;
        }
        return queue;
      });
    },
    [fillUpNext, flushListening, history, pushHistory],
  );

  const handleMediaError = useCallback(() => {
    flushListening();
    failStreak.current += 1;
    trackEvent("playback_error", {
      track_id: current ? `rotation-${current.src}` : "unknown",
      stage: "media",
      fail_streak: failStreak.current,
    });
    if (failStreak.current >= Math.min(8, Math.max(3, tracks.length || 3))) {
      setPlaying(false);
      setError("Several tracks failed. Check your connection and try Play again.");
      setNotice(null);
      return;
    }
    setNotice("Skipping a broken track…");
    setPlaying(true);
    advance(1, { autoSkip: true });
  }, [advance, current, flushListening, tracks.length]);

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
        pushHistory(current);
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
  }, [current, flushListening, isPlaying, pushHistory]);

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
      if (next) {
        setUpNext((q) => {
          const users = q.filter((i) => i.source === "user");
          const rest = shuffleArray(q.filter((i) => i.source !== "user"));
          return [...users, ...rest];
        });
      }
      return next;
    });
  }, []);

  const cycleRepeat = useCallback(() => {
    setRepeat((m) => (m === "off" ? "all" : m === "all" ? "one" : "off"));
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

  const toggleAutoplay = useCallback(() => {
    setAutoplay((v) => {
      const next = !v;
      if (next) {
        setUpNext((q) => fillUpNext(nowRef.current?.track, q));
      }
      return next;
    });
  }, [fillUpNext]);

  const playNow = useCallback(
    (track: StationTrack, opts?: { from?: string; related?: StationTrack[] }) => {
      if (!track?.src) return;
      flushListening();
      setError(null);
      setNotice(null);
      setElapsed(0);
      setDuration(0);
      setMode("ondemand");
      setPlayingFrom(opts?.from || track.project || track.artist || "On demand");
      if (nowRef.current) pushHistory(nowRef.current.track);
      const item = makeQueueItem(track, "user");
      setNowPlaying(item);
      const relatedItems = (opts?.related || [])
        .filter((t) => t.src && trackKey(t) !== trackKey(track))
        .map((t) => makeQueueItem(t, "user"));
      setUpNext(fillUpNext(track, relatedItems));
      setPlaying(true);
      setQueueOpen(true);
      trackEvent("queue_play_now", { track_id: trackLibraryId(track) });
    },
    [fillUpNext, flushListening, pushHistory],
  );

  const playNext = useCallback((track: StationTrack) => {
    if (!track?.src) return;
    setUpNext((q) => {
      const item = makeQueueItem(track, "user");
      const withoutDup = q.filter((i) => trackKey(i.track) !== trackKey(track));
      return [item, ...withoutDup].slice(0, UP_NEXT_TARGET + 10);
    });
    setNotice(`Up next: ${track.title}`);
    setMode((m) => m);
    trackEvent("queue_play_next", { track_id: trackLibraryId(track) });
  }, []);

  const addToQueue = useCallback((track: StationTrack) => {
    if (!track?.src) return;
    setUpNext((q) => {
      if (q.some((i) => trackKey(i.track) === trackKey(track) && i.source === "user")) return q;
      return [...q, makeQueueItem(track, "user")].slice(0, UP_NEXT_TARGET + 20);
    });
    setNotice(`Added to queue: ${track.title}`);
    trackEvent("queue_add", { track_id: trackLibraryId(track) });
  }, []);

  const playAll = useCallback(
    (list: StationTrack[], opts?: { from?: string; startIndex?: number }) => {
      const playable = list.filter((t) => t.src);
      if (!playable.length) return;
      const start = Math.min(Math.max(0, opts?.startIndex || 0), playable.length - 1);
      const head = playable[start];
      const rest = [...playable.slice(start + 1), ...playable.slice(0, start)];
      playNow(head, { from: opts?.from || "Playlist", related: rest });
    },
    [playNow],
  );

  const removeFromQueue = useCallback((key: string) => {
    setUpNext((q) => q.filter((i) => i.key !== key));
  }, []);

  const clearQueue = useCallback(() => {
    setUpNext((q) => (autoplayRef.current ? fillUpNext(nowRef.current?.track, []) : q.filter(() => false)));
    setNotice(autoplayRef.current ? "Queue cleared · station auto-fill on" : "Queue cleared");
  }, [fillUpNext]);

  const jumpToQueueItem = useCallback(
    (key: string) => {
      setUpNext((q) => {
        const idx = q.findIndex((i) => i.key === key);
        if (idx < 0) return q;
        const target = q[idx];
        const rest = [...q.slice(0, idx), ...q.slice(idx + 1)];
        if (nowRef.current) pushHistory(nowRef.current.track);
        flushListening();
        setElapsed(0);
        setDuration(0);
        setError(null);
        setNowPlaying(target);
        setPlaying(true);
        return autoplayRef.current ? fillUpNext(target.track, rest) : rest;
      });
    },
    [fillUpNext, flushListening, pushHistory],
  );

  const backToStation = useCallback(() => {
    const pool = tracksRef.current;
    if (!pool.length) return;
    flushListening();
    setMode("station");
    setPlayingFrom("BVS Station");
    setError(null);
    setNotice("Back to BVS station");
    setElapsed(0);
    setDuration(0);
    const head = makeQueueItem(pool[0], "station");
    setNowPlaying(head);
    setUpNext(fillUpNext(pool[0], []));
    setPlaying(true);
  }, [fillUpNext, flushListening]);

  const playHistoryTrack = useCallback(
    (track: StationTrack) => {
      playNow(track, { from: "Recently played" });
    },
    [playNow],
  );

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
    advance(1);
  }, [advance]);

  // External catalogue / pages → queue
  useEffect(() => {
    const onQueue = (event: Event) => {
      const detail = (event as CustomEvent<{
        action?: "play" | "play-next" | "add" | "play-all";
        track?: StationTrack;
        tracks?: StationTrack[];
        from?: string;
      }>).detail;
      if (!detail) return;
      if (detail.action === "play" && detail.track) playNow(detail.track, { from: detail.from });
      else if (detail.action === "play-next" && detail.track) playNext(detail.track);
      else if (detail.action === "add" && detail.track) addToQueue(detail.track);
      else if (detail.action === "play-all" && detail.tracks?.length) playAll(detail.tracks, { from: detail.from });
    };
    window.addEventListener("bvs:queue", onQueue);
    return () => window.removeEventListener("bvs:queue", onQueue);
  }, [addToQueue, playAll, playNext, playNow]);

  const value = useMemo<PlayerContextValue>(
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
      mode,
      playingFrom,
      upNext,
      autoplay,
      queueOpen,
      setQueueOpen,
      toggle,
      next: () => advance(1),
      previous: () => advance(-1),
      setVolume,
      seek,
      toggleShuffle,
      cycleRepeat,
      toggleLike,
      toggleAutoplay,
      playNow,
      playNext,
      addToQueue,
      playAll,
      removeFromQueue,
      clearQueue,
      jumpToQueueItem,
      backToStation,
      playHistoryTrack,
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
      mode,
      playingFrom,
      upNext,
      autoplay,
      queueOpen,
      toggle,
      advance,
      seek,
      toggleShuffle,
      cycleRepeat,
      toggleLike,
      toggleAutoplay,
      playNow,
      playNext,
      addToQueue,
      playAll,
      removeFromQueue,
      clearQueue,
      jumpToQueueItem,
      backToStation,
      playHistoryTrack,
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
        onSeek((event.clientX - rect.left) / rect.width);
      }}
    >
      <div className="h-full bg-white transition-[width] duration-100 ease-linear" style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Fixed square cover slot so art never stretches or shifts layout on mobile. */
function CoverArt({
  src,
  sizeClass = "h-12 w-12",
  rounded = "rounded-lg",
  label = "BVS",
}: {
  src?: string | null;
  sizeClass?: string;
  rounded?: string;
  label?: string;
}) {
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden border border-white/10 bg-white/[0.06] ${sizeClass} ${rounded}`}
      aria-hidden={src ? true : undefined}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- dynamic covers from storage/local
        <img
          src={src}
          alt=""
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
      ) : (
        <span className="select-none text-[9px] font-semibold tracking-wide text-text-secondary">{label}</span>
      )}
    </span>
  );
}

function QueueSheet() {
  const player = useStationPlayer();
  if (!player.queueOpen) return null;
  return (
    <div className="fixed inset-x-0 bottom-20 z-[60] mx-auto max-h-[55vh] w-full max-w-3xl overflow-hidden rounded-t-2xl border border-white/10 bg-[#121212]/98 shadow-2xl backdrop-blur-xl sm:bottom-24">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand">Up next</p>
          <p className="text-sm text-text-secondary">
            Playing from <span className="text-white">{player.playingFrom}</span>
            {player.mode === "ondemand" ? " · On demand" : " · Station"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={player.toggleAutoplay}
            className={`rounded-full px-3 py-1 text-xs ${player.autoplay ? "bg-brand/20 text-brand" : "bg-white/5 text-text-secondary"}`}
          >
            Auto-play {player.autoplay ? "on" : "off"}
          </button>
          {player.mode === "ondemand" && (
            <button type="button" onClick={player.backToStation} className="rounded-full bg-white/10 px-3 py-1 text-xs hover:bg-white/15">
              BVS station
            </button>
          )}
          <button type="button" onClick={player.clearQueue} className="rounded-full px-2 py-1 text-xs text-text-secondary hover:text-white">
            Clear
          </button>
          <button type="button" onClick={() => player.setQueueOpen(false)} className="rounded-full px-2 py-1 text-sm text-text-secondary hover:text-white" aria-label="Close queue">
            ✕
          </button>
        </div>
      </div>
      <ol className="max-h-[42vh] space-y-0 overflow-y-auto px-2 py-2">
        {player.upNext.length === 0 && (
          <li className="px-3 py-6 text-center text-sm text-text-secondary">
            Queue empty{player.autoplay ? " — auto-play will fill similar / station tracks." : "."}
          </li>
        )}
        {player.upNext.map((item, i) => (
          <li key={item.key} className="flex items-center gap-2 rounded-xl px-2 py-2 hover:bg-white/5">
            <span className="w-6 text-center text-xs text-text-secondary">{i + 1}</span>
            <button type="button" onClick={() => player.jumpToQueueItem(item.key)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
              <CoverArt src={item.track.artwork} sizeClass="h-10 w-10" rounded="rounded-md" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{item.track.title}</span>
                <span className="block truncate text-xs text-text-secondary">
                  {item.track.artist}
                  {item.source === "user" ? " · You" : item.source === "mix" ? " · Similar" : item.source === "auto" ? " · Auto" : " · Station"}
                </span>
              </span>
            </button>
            <button type="button" onClick={() => player.removeFromQueue(item.key)} className="rounded-full px-2 py-1 text-xs text-text-secondary hover:bg-white/10 hover:text-white" aria-label="Remove from queue">
              ✕
            </button>
          </li>
        ))}
      </ol>
      {player.history.length > 0 && (
        <div className="border-t border-white/10 px-4 py-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-brand">Recently played</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {player.history.slice(0, 12).map((track) => (
              <button
                key={trackKey(track)}
                type="button"
                onClick={() => player.playHistoryTrack(track)}
                className="flex w-[148px] shrink-0 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-left hover:border-brand/40"
              >
                <CoverArt src={track.artwork} sizeClass="h-9 w-9" rounded="rounded-md" />
                <span className="min-w-0">
                  <span className="block truncate text-xs font-medium">{track.title}</span>
                  <span className="block truncate text-[10px] text-text-secondary">{track.artist}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function PersistentPlayer() {
  const player = useStationPlayer();
  const art = player.current?.artwork;
  const repeatLabel = player.repeat === "off" ? "Repeat off" : player.repeat === "all" ? "Repeat all" : "Repeat one";
  return (
    <>
      <QueueSheet />
      <section className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#181818]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl" aria-label="BVS rotation player">
        <ProgressLine elapsed={player.elapsed} duration={player.duration} onSeek={player.seek} />
        {(player.error || player.notice) && (
          <p className={`px-4 py-1 text-center text-xs ${player.error ? "bg-red-500/15 text-red-200" : "bg-brand/10 text-brand"}`} role="status">
            {player.error || player.notice}
          </p>
        )}
        <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center gap-2 px-2.5 sm:h-20 sm:gap-4 sm:px-6">
          <button
            type="button"
            onClick={() => player.setQueueOpen(!player.queueOpen)}
            className="flex min-w-0 flex-1 items-center gap-2.5 text-left sm:gap-3"
          >
            <CoverArt src={art} sizeClass="h-11 w-11 sm:h-12 sm:w-12" rounded="rounded-md sm:rounded-lg" />
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[9px] font-semibold uppercase tracking-[0.14em] text-brand sm:text-[10px] sm:tracking-[0.18em]">
                {player.playingFrom || player.current?.project || "Continuous rotation"}
              </span>
              <span className="mt-0.5 block truncate text-sm font-medium sm:text-base">{player.current?.title || "BVS Radio rotation"}</span>
              <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] text-text-secondary sm:text-xs">
                <span className="truncate">{player.current?.artist || "BVS Radio"}</span>
                {player.duration > 0 && (
                  <span className="hidden shrink-0 tabular-nums text-white/50 sm:inline">
                    {formatTime(player.elapsed)} / {formatTime(player.duration)}
                  </span>
                )}
                <span className="hidden shrink-0 text-white/40 sm:inline">· Queue {player.upNext.length}</span>
              </span>
            </span>
          </button>
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
          <button type="button" onClick={player.previous} className="hidden rounded-full p-2 hover:bg-white/10 sm:block" aria-label="Previous recording">
            ◀
          </button>
          <button
            type="button"
            onClick={player.toggle}
            disabled={!player.current}
            className="grid h-12 w-12 place-items-center rounded-full bg-brand font-bold text-black disabled:opacity-40"
            aria-label={player.isPlaying ? "Pause" : "Play"}
          >
            {player.isPlaying ? "Ⅱ" : "▶"}
          </button>
          <button type="button" onClick={player.next} className="rounded-full p-2 hover:bg-white/10" aria-label="Next recording">
            ▶
          </button>
          <button
            type="button"
            onClick={player.cycleRepeat}
            className={`hidden rounded-full px-2 py-1 text-xs sm:block ${player.repeat !== "off" ? "bg-brand/20 text-brand" : "text-text-secondary hover:bg-white/10"}`}
            aria-label={repeatLabel}
            title={repeatLabel}
          >
            {player.repeat === "one" ? "1↻" : "↻"}
          </button>
          <label className="hidden items-center gap-2 text-xs text-text-secondary md:flex">
            Volume
            <input
              aria-label="Volume"
              type="range"
              min="0"
              max="100"
              value={player.volume}
              onChange={(event) => player.setVolume(Number(event.target.value))}
              className="w-24 accent-brand"
            />
          </label>
          <Link href="/library" className="hidden text-sm text-brand hover:underline sm:block">
            Library
          </Link>
        </div>
      </section>
    </>
  );
}
