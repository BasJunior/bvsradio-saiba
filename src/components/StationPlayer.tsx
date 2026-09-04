"use client";

import Link from "next/link";
import { Capacitor } from "@capacitor/core";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { StationTrack } from "@/lib/station";
import { hasLibraryItem, recordListening, toggleLibraryItem } from "@/lib/library";
import { listeningBucket, trackEvent } from "@/lib/analytics";
import { useAppSurface } from "@/components/app/AppSurfaceProvider";
import { useAppShellMeasurement } from "@/components/app/useAppShellMeasurement";
import { appExplore, appLibrary, hrefForAppSurface } from "@/lib/app-surface";
import {
  BVS_DISMISS_TRANSIENTS_EVENT,
  clearCurrentTransientLayer,
  currentTransientLayer,
  dismissTransientLayer,
  openTransientLayer,
} from "@/lib/transient-navigation";
import BuyTrackButton from "@/components/BuyTrackButton";

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
  nowPlayingOpen: boolean;
  openNowPlaying: () => void;
  closeNowPlaying: () => void;
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
/** v2: drop stale house-archive queues from pre-editorial rotation. */
const QUEUE_STORAGE_KEY = "bvs.player.queue.v2";
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

export function StationPlayerProvider({ tracks: initialTracks, children }: { tracks: StationTrack[]; children: React.ReactNode }) {
  const audio = useRef<HTMLAudioElement>(null);
  const startedAt = useRef<number | null>(null);
  const countedStarts = useRef(new Set<string>());
  const failStreak = useRef(0);
  const hydrated = useRef(false);
  const [tracks, setTracks] = useState<StationTrack[]>(initialTracks);

  // Live editorial rotation — bypasses any stale SSR/layout bake-in
  useEffect(() => {
    let cancelled = false;
    const nativePlatform = Capacitor.getPlatform();
    const mobileSurface = nativePlatform === "ios" || nativePlatform === "android"
      ? nativePlatform
      : window.location.pathname.match(/^\/app\/(ios|android)(?:\/|$)/)?.[1];
    const endpoint = mobileSurface
      ? `/api/station/tracks?surface=${encodeURIComponent(mobileSurface)}`
      : "/api/station/tracks";
    const load = () => {
      fetch(endpoint, { cache: "no-store" })
        .then(async (res) => {
          if (!res.ok) return;
          const payload = await res.json().catch(() => ({}));
          const next = Array.isArray(payload.tracks) ? (payload.tracks as StationTrack[]) : [];
          if (!cancelled) setTracks(next);
        })
        .catch(() => {});
    };
    load();
    const id = window.setInterval(load, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const [nowPlaying, setNowPlaying] = useState<QueueItem | null>(() =>
    initialTracks[0] ? makeQueueItem(initialTracks[0], "station") : null,
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
  const [queueOpen, setQueueOpenState] = useState(false);
  const [nowPlayingOpen, setNowPlayingOpenState] = useState(false);
  const setQueueOpen = useCallback((open: boolean) => {
    if (open) {
      openTransientLayer("queue");
      setNowPlayingOpenState(false);
      setQueueOpenState(true);
    } else if (!dismissTransientLayer("queue")) {
      setQueueOpenState(false);
    }
  }, []);
  const openNowPlaying = useCallback(() => {
    openTransientLayer("now-playing");
    setQueueOpenState(false);
    setNowPlayingOpenState(true);
  }, []);
  const closeNowPlaying = useCallback(() => {
    if (!dismissTransientLayer("now-playing")) setNowPlayingOpenState(false);
  }, []);

  useEffect(() => {
    const syncLayer = (event: PopStateEvent) => {
      const layer = currentTransientLayer(event.state);
      setQueueOpenState(layer === "queue");
      setNowPlayingOpenState(layer === "now-playing");
    };
    const dismissBeforeNavigation = () => {
      clearCurrentTransientLayer();
      setQueueOpenState(false);
      setNowPlayingOpenState(false);
    };
    window.addEventListener("popstate", syncLayer);
    window.addEventListener(BVS_DISMISS_TRANSIENTS_EVENT, dismissBeforeNavigation);
    return () => {
      window.removeEventListener("popstate", syncLayer);
      window.removeEventListener(BVS_DISMISS_TRANSIENTS_EVENT, dismissBeforeNavigation);
    };
  }, []);

  const current = nowPlaying?.track;
  const tracksRef = useRef(tracks);
  const nowRef = useRef(nowPlaying);
  const upNextRef = useRef(upNext);
  const modeRef = useRef(mode);
  const autoplayRef = useRef(autoplay);
  const shuffleRef = useRef(shuffle);
  const repeatRef = useRef(repeat);

  useEffect(() => {
    tracksRef.current = tracks;
    nowRef.current = nowPlaying;
    upNextRef.current = upNext;
    modeRef.current = mode;
    autoplayRef.current = autoplay;
    shuffleRef.current = shuffle;
    repeatRef.current = repeat;
  }, [autoplay, mode, nowPlaying, repeat, shuffle, tracks, upNext]);

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
    if (bucket > 0) trackEvent("listening_duration", { track_id: trackLibraryId(current), seconds_bucket: bucket });
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
      // On station mode expose the entire circular rotation. On-demand mixes stay concise.
      const queueTarget = modeRef.current === "station" ? Math.max(0, pool.length - 1) : UP_NEXT_TARGET;
      const userItems = preferUserKeep ? existing.filter((i) => i.source === "user") : [];
      const autoTail = existing.filter((i) => i.source !== "user");
      const exclude = new Set<string>();
      if (seed) exclude.add(trackKey(seed));
      for (const i of userItems) exclude.add(trackKey(i.track));
      for (const i of autoTail) exclude.add(trackKey(i.track));

      const need = Math.max(0, queueTarget - userItems.length - autoTail.length);
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
      return [...userItems, ...filledAuto].slice(0, queueTarget + userItems.length);
    },
    [],
  );

  // Hydrate + seed queue when tracks arrive; drop anything not in live library
  useEffect(() => {
    if (!tracks.length) return;
    const timer = window.setTimeout(() => {
    try {
      localStorage.removeItem("bvs.player.queue.v1");
      localStorage.removeItem("bvs.pl…e.v1");
    } catch {
      /* ignore */
    }

    const byKey = new Map(tracks.map((t) => [trackKey(t), t]));

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
          // Only restore on-demand context if the seed track still exists
          const nowTrack = (saved.nowKey && byKey.get(saved.nowKey)) || tracks[0];
          const restoreOndemand = saved.mode === "ondemand" && saved.nowKey && byKey.has(saved.nowKey);
          if (restoreOndemand) {
            setMode("ondemand");
            if (saved.playingFrom) setPlayingFrom(saved.playingFrom);
          } else {
            setMode("station");
            setPlayingFrom("BVS Station");
          }
          const nowItem = makeQueueItem(nowTrack, restoreOndemand ? "user" : "station");
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
      if (prev && byKey.has(trackKey(prev.track))) {
        // Refresh track metadata from live library
        const live = byKey.get(trackKey(prev.track))!;
        if (live.src === prev.track.src) return prev;
        return { ...prev, track: live };
      }
      // Current track left the library (e.g. rejected archive) → jump to station head
      setMode("station");
      setPlayingFrom("BVS Station");
      return makeQueueItem(tracks[0], "station");
    });
    setUpNext((prev) => {
      const kept = prev.filter((item) => byKey.has(trackKey(item.track))).map((item) => ({
        ...item,
        track: byKey.get(trackKey(item.track))!,
      }));
      const seed = nowRef.current?.track && byKey.has(trackKey(nowRef.current.track))
        ? byKey.get(trackKey(nowRef.current.track))
        : tracks[0];
      return fillUpNext(seed, kept);
    });
    }, 0);
    return () => window.clearTimeout(timer);
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
    const sync = () => setLiked(current ? hasLibraryItem("favourites", trackLibraryId(current)) : false);
    const timer = window.setTimeout(sync, 0);
    if (!current) return () => window.clearTimeout(timer);
    window.addEventListener("bvs:library-change", sync);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("bvs:library-change", sync);
    };
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
            trackEvent("player_start", {
              track_id: trackId,
              title: current.title || "",
              collection: current.project || current.genre || "",
              source: modeRef.current === "ondemand" ? "queue" : "station",
            });
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
          trackEvent("playback_error", { track_id: trackLibraryId(current), stage: "track_change" });
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
    const media = audio.current;
    trackEvent("playback_error", {
      track_id: current ? trackLibraryId(current) : "unknown",
      stage: "media",
      fail_streak: failStreak.current,
      media_error_code: media?.error?.code ?? null,
      media_src_host: (() => {
        try {
          return current?.src ? new URL(current.src, window.location.origin).host : null;
        } catch {
          return null;
        }
      })(),
      network_state: media?.networkState ?? null,
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
    if (!audio.current || !current) return setError("No track is loaded. Open Listen or pick something from the catalogue.");
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
      trackEvent("playback_error", { track_id: trackLibraryId(current), stage: "start" });
      setError("Playback could not start. Please try again.");
    }
  }, [current, flushListening, isPlaying, pushHistory]);

  // Keep lock-screen / notification controls attached to the real BVS queue.
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;

    const setHandler = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        // Some Safari/embedded WebView versions expose Media Session partially.
      }
    };

    setHandler("play", () => {
      if (!isPlaying) void toggle();
    });
    setHandler("pause", () => {
      if (isPlaying) void toggle();
    });
    setHandler("previoustrack", () => advance(-1));
    setHandler("nexttrack", () => advance(1));

    // Prefer track navigation over the platform's default ±10 second buttons.
    setHandler("seekbackward", null);
    setHandler("seekforward", null);

    return () => {
      setHandler("play", null);
      setHandler("pause", null);
      setHandler("previoustrack", null);
      setHandler("nexttrack", null);
    };
  }, [advance, isPlaying, toggle]);

  useEffect(() => {
    if (!("mediaSession" in navigator) || !current || typeof MediaMetadata === "undefined") return;

    try {
      const artwork = current.artwork || "/bvs-apple-touch-v2.png";
      navigator.mediaSession.metadata = new MediaMetadata({
        title: current.title || "BVS Radio",
        artist: current.artist || "BVS Radio",
        album: current.project || playingFrom || "BVS Radio",
        artwork: [{ src: new URL(artwork, window.location.origin).href }],
      });
    } catch {
      // Metadata support varies between Safari, Android WebView and browsers.
    }
  }, [current, playingFrom]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
    } catch {
      // Ignore partial Media Session implementations.
    }
  }, [isPlaying]);

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
    [fillUpNext, flushListening, pushHistory, setQueueOpen],
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
      nowPlayingOpen,
      openNowPlaying,
      closeNowPlaying,
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
      setQueueOpen,
      nowPlayingOpen,
      openNowPlaying,
      closeNowPlaying,
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
  const [query, setQuery] = useState("");
  const normalizedQuery = normalizeText(query);
  const visibleQueue = normalizedQuery
    ? player.upNext.filter((item) =>
        normalizeText(`${item.track.title} ${item.track.artist} ${item.track.project || ""}`).includes(normalizedQuery),
      )
    : player.upNext;
  if (!player.queueOpen) return null;
  return (
    <div className="bvs-queue-sheet fixed inset-x-0 bottom-[8.5rem] z-[60] mx-auto flex max-h-[68svh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-[#121212]/98 shadow-2xl backdrop-blur-xl md:bottom-24 md:max-h-[72svh] md:rounded-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand">
            {player.mode === "station" ? "Full circular rotation" : "Up next"}
          </p>
          <p className="text-sm text-text-secondary">
            Playing from <span className="text-white">{player.playingFrom}</span>
            {player.mode === "ondemand"
              ? ` · ${player.upNext.length} queued`
              : ` · ${player.upNext.length + (player.current ? 1 : 0)} songs · wraps to the start`}
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
          {player.mode === "ondemand" && (
            <button type="button" onClick={player.clearQueue} className="rounded-full px-2 py-1 text-xs text-text-secondary hover:text-white">
              Clear
            </button>
          )}
          <button type="button" onClick={() => player.setQueueOpen(false)} className="rounded-full px-2 py-1 text-sm text-text-secondary hover:text-white" aria-label="Close queue">
            ✕
          </button>
        </div>
      </div>
      <div className="border-b border-white/10 px-3 py-2.5">
        <label htmlFor="rotation-search" className="sr-only">Find a song in the rotation</label>
        <input
          id="rotation-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Find a song, artist or album…"
          className="h-11 w-full rounded-full border border-white/10 bg-white/[0.06] px-4 text-base text-white outline-none placeholder:text-text-secondary focus:border-brand sm:text-sm"
        />
      </div>
      <ol className="min-h-0 flex-1 space-y-0 overflow-y-auto overscroll-contain px-2 py-2" aria-label="BVS rotation songs">
        {player.upNext.length === 0 && (
          <li className="px-3 py-6 text-center text-sm text-text-secondary">
            Queue empty{player.autoplay ? " — auto-play will fill similar / station tracks." : "."}
          </li>
        )}
        {player.upNext.length > 0 && visibleQueue.length === 0 && (
          <li className="px-3 py-8 text-center text-sm text-text-secondary">No rotation songs match “{query}”.</li>
        )}
        {visibleQueue.map((item) => {
          const rotationIndex = player.upNext.findIndex((candidate) => candidate.key === item.key);
          return (
            <li key={item.key} className="flex items-center gap-2 rounded-xl px-2 py-2 hover:bg-white/5">
              <span className="w-7 text-center text-xs tabular-nums text-text-secondary">{rotationIndex + 1}</span>
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
              {player.mode === "ondemand" && (
                <button type="button" onClick={() => player.removeFromQueue(item.key)} className="rounded-full px-2 py-1 text-xs text-text-secondary hover:bg-white/10 hover:text-white" aria-label="Remove from queue">
                  ✕
                </button>
              )}
            </li>
          );
        })}
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

function LibraryLink() {
  const { surface, appChrome } = useAppSurface();
  return (
    <Link href={appChrome && surface ? appLibrary(surface) : "/library"} className="hidden text-sm text-brand hover:underline sm:block">
      Library
    </Link>
  );
}

function ArtistSearchLink({
  artist,
  className,
  children,
  onClick,
}: {
  artist: string;
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  const { surface, appChrome } = useAppSurface();
  const href = hrefForAppSurface(`/search?q=${encodeURIComponent(artist)}`, appChrome ? surface : null);
  return <Link href={href || appExplore(surface || "ios")} className={className} onClick={onClick}>{children}</Link>;
}

export function PersistentPlayer() {
  const player = useStationPlayer();
  const { appChrome } = useAppSurface();
  const playerRef = useAppShellMeasurement<HTMLElement>("--bvs-app-player-height-measured", appChrome);
  const { nowPlayingOpen, closeNowPlaying } = player;
  const art = player.current?.artwork;
  const repeatLabel = player.repeat === "off" ? "Repeat off" : player.repeat === "all" ? "Repeat all" : "Repeat one";

  useEffect(() => {
    if (!nowPlayingOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeNowPlaying();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [nowPlayingOpen, closeNowPlaying]);

  return (
    <>
      <QueueSheet />
      {nowPlayingOpen && (
        <section
          className="fixed inset-0 z-[70] overflow-y-auto overscroll-y-contain bg-[#090909] text-white"
          role="dialog"
          aria-modal="true"
          aria-label="Now Playing World"
          data-now-playing-shell="true"
          style={{ WebkitOverflowScrolling: "touch", overscrollBehaviorY: "contain" }}
        >
          {art ? (
            // eslint-disable-next-line @next/next/no-img-element -- dynamic editorial artwork
            <img src={art} alt="" className="pointer-events-none fixed inset-0 h-full w-full scale-110 object-cover opacity-25 blur-3xl" />
          ) : null}
          <div className="fixed inset-0 bg-gradient-to-b from-black/25 via-[#090909]/80 to-[#090909]" aria-hidden="true" />
          <div className="relative mx-auto flex min-h-[100dvh] max-w-6xl flex-col px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-8 sm:pb-12 sm:pt-[max(1.25rem,env(safe-area-inset-top))]">
            <header data-np-dismiss-zone="true" className="sticky top-0 z-10 -mx-4 bg-gradient-to-b from-[#090909] via-[#090909]/95 to-transparent px-4 pb-3 sm:static sm:mx-0 sm:bg-transparent sm:px-0 sm:pb-0">
              <div className="mx-auto mb-2 flex justify-center sm:mb-3" aria-hidden="true">
                <span className="h-1.5 w-12 rounded-full bg-white/35" />
              </div>
              <div className="flex items-center justify-between gap-3">
                <button type="button" onClick={player.closeNowPlaying} className="grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-black/20 text-xl backdrop-blur" aria-label="Close Now Playing">⌄</button>
                <div className="min-w-0 flex-1 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-[.22em] text-brand">Now Playing World</p>
                  <p className="mt-1 truncate text-xs text-white/60">{player.playingFrom || "BVS Radio"}</p>
                </div>
                <button type="button" onClick={() => player.setQueueOpen(true)} className="grid h-11 min-w-11 place-items-center rounded-full border border-white/15 bg-black/20 px-3 text-xs backdrop-blur" aria-label="Open queue">Queue</button>
              </div>
            </header>

            <div className="grid flex-1 content-center gap-5 py-4 sm:gap-8 sm:py-8 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,.78fr)] lg:items-center lg:gap-16">
              <div data-np-swipe-track="true" className="mx-auto w-full max-w-[18rem] sm:max-w-[28rem] lg:max-w-[34rem]">
                <div className="relative mx-auto aspect-square w-full max-h-[min(42vh,18rem)] overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/5 shadow-[0_35px_100px_rgba(0,0,0,.55)] sm:max-h-none sm:rounded-[2rem]">
                  {art ? (
                    // eslint-disable-next-line @next/next/no-img-element -- dynamic editorial artwork
                    <img src={art} alt={`Artwork for ${player.current?.title || "BVS Radio"}`} className="h-full w-full object-cover" draggable={false} />
                  ) : (
                    <div className="grid h-full place-items-center bg-gradient-to-br from-brand/25 via-white/5 to-black text-4xl font-semibold tracking-[.2em] text-brand">BVS</div>
                  )}
                </div>
                <ProgressLine elapsed={player.elapsed} duration={player.duration} onSeek={player.seek} className="mt-5 overflow-hidden rounded-full sm:mt-7" />
                <div className="mt-2 flex justify-between text-xs tabular-nums text-white/50"><span>{formatTime(player.elapsed)}</span><span>{formatTime(player.duration)}</span></div>
              </div>

              <div className="mx-auto w-full max-w-xl">
                <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-brand sm:text-xs">{player.current?.project || "Continuous rotation"}</p>
                <h2 className="mt-2 text-[1.75rem] font-semibold leading-tight tracking-tight sm:mt-3 sm:text-4xl lg:text-5xl">{player.current?.title || "BVS Radio rotation"}</h2>
                <ArtistSearchLink artist={player.current?.artist || "BVS Radio"} className="mt-2 inline-block text-base text-white/65 hover:text-brand sm:mt-3 sm:text-lg">{player.current?.artist || "BVS Radio"}</ArtistSearchLink>

                <div className="mt-6 flex items-center justify-between gap-2 sm:mt-8 sm:justify-start sm:gap-6">
                  <button type="button" onClick={player.toggleShuffle} aria-pressed={player.shuffle} className={`h-11 rounded-full px-3 text-sm sm:px-4 ${player.shuffle ? "bg-brand/15 text-brand" : "text-white/60"}`}>Shuffle</button>
                  <button type="button" onClick={player.previous} className="grid h-12 w-12 place-items-center rounded-full text-xl hover:bg-white/10" aria-label="Previous recording">◀</button>
                  <button type="button" onClick={player.toggle} disabled={!player.current} className="grid h-14 w-14 place-items-center rounded-full bg-brand text-xl font-bold text-black disabled:opacity-40 sm:h-16 sm:w-16" aria-label={player.isPlaying ? "Pause" : "Play"}>{player.isPlaying ? "Ⅱ" : "▶"}</button>
                  <button type="button" onClick={player.next} className="grid h-12 w-12 place-items-center rounded-full text-xl hover:bg-white/10" aria-label="Next recording">▶</button>
                  <button type="button" onClick={player.toggleLike} aria-pressed={player.liked} className={`grid h-11 w-11 place-items-center rounded-full text-2xl ${player.liked ? "bg-brand/15 text-brand" : "text-white/60"}`} aria-label={player.liked ? "Remove from library" : "Save to library"}>{player.liked ? "♥" : "♡"}</button>
                </div>

                <div className="mt-6 grid gap-3 sm:mt-10 sm:grid-cols-2">
                  <BuyTrackButton
                    track={player.current}
                    variant="full"
                    className="sm:col-span-2"
                    onAfterAdd={player.closeNowPlaying}
                  />
                  <ArtistSearchLink artist={player.current?.artist || ""} onClick={player.closeNowPlaying} className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:border-brand/40">
                    <span className="text-[10px] uppercase tracking-[.18em] text-brand">Go deeper</span><span className="mt-1 block font-medium">Explore artist and credits</span>
                  </ArtistSearchLink>
                  <button type="button" onClick={() => player.setQueueOpen(true)} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left hover:border-brand/40">
                    <span className="text-[10px] uppercase tracking-[.18em] text-brand">Coming next</span><span className="mt-1 block font-medium">Open queue · {player.upNext.length} tracks</span>
                  </button>
                </div>
                <p className="mt-5 text-sm leading-relaxed text-white/50 sm:mt-6">Playback stays continuous while you move through artists, credits, stories and BeatStore.</p>
              </div>
            </div>
          </div>
        </section>
      )}
      <section ref={playerRef} className="bvs-persistent-player fixed inset-x-0 bottom-16 z-50 border-t border-white/10 bg-[#181818]/95 backdrop-blur-xl md:bottom-0 md:pb-[env(safe-area-inset-bottom)]" aria-label="BVS rotation player">
        <ProgressLine elapsed={player.elapsed} duration={player.duration} onSeek={player.seek} />
        {(player.error || player.notice) && (
          <p className={`px-4 py-1 text-center text-xs ${player.error ? "bg-red-500/15 text-red-200" : "bg-brand/10 text-brand"}`} role="status">
            {player.error || player.notice}
          </p>
        )}
        <div className="bvs-persistent-player-inner mx-auto flex h-[4.5rem] max-w-7xl items-center gap-2 sm:h-20 sm:gap-4">
          <button
            type="button"
            onClick={player.openNowPlaying}
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
          <BuyTrackButton track={player.current} variant="compact" />
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
          <button type="button" onClick={() => player.setQueueOpen(!player.queueOpen)} className="hidden rounded-full px-2 py-1 text-xs text-text-secondary hover:bg-white/10 sm:block" aria-label="Open queue">Queue</button>
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
          <LibraryLink />
        </div>
      </section>
    </>
  );
}
