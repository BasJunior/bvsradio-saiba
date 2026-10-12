"use client";

import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { runRemoteTrackCommand } from "@/lib/remote-music-transport";
import { useStationPlayer, useStationPlayerProgress } from "@/components/StationPlayer";
import { isBeatTrack, isEditorialPlay } from "@/lib/beat-playback";

type NativeNowPlayingHandler = {
  postMessage: (payload: Record<string, unknown>) => void;
};

type NativeMediaCommandPayload = {
  command?: string;
  position?: number;
  interval?: number;
};

type BvsWebkitWindow = Window & {
  __bvsNativeMediaReady?: boolean;
  __bvsNativeMediaQueue?: NativeMediaCommandPayload[];
  webkit?: {
    messageHandlers?: {
      bvsNowPlaying?: NativeNowPlayingHandler;
    };
  };
};

function nativeHandler(): NativeNowPlayingHandler | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as BvsWebkitWindow).webkit?.messageHandlers?.bvsNowPlaying;
}

function absoluteArtwork(src?: string) {
  if (!src || typeof window === "undefined") return "";
  try {
    return new URL(src, window.location.origin).href;
  } catch {
    return "";
  }
}

/**
 * Keeps Web Media Session rich while the app is foregrounded and, in native
 * builds that include the BVS iOS bridge, mirrors the same state into
 * MPNowPlayingInfoCenter so Dynamic Island/Control Center do not depend on the
 * WebView being backgrounded first.
 */
export default function AppNowPlayingBridge() {
  const player = useStationPlayer();
  const timeline = useStationPlayerProgress();
  const lastNativeSecond = useRef(-1);
  const commandState = useRef({
    isPlaying: player.isPlaying,
    elapsed: timeline.elapsed,
    play: player.play,
    pause: player.pause,
    next: player.next,
    previous: player.previous,
    seekTo: player.seekTo,
  });
  const current = player.current;
  const timelineSecond = Math.floor(timeline.elapsed || 0);
  const constrainedNext = Boolean(current && (isBeatTrack(current) || isEditorialPlay(current)));
  const canNext = Boolean(
    current &&
    (player.upNext.length > 0 || (!constrainedNext && (player.mode === "station" || player.autoplay)))
  );
  const canPrevious = Boolean(current && (timeline.elapsed > 3 || player.history.length > 0));
  const canSeek = Boolean(current && timeline.duration > 0 && Number.isFinite(timeline.duration));

  useEffect(() => {
    commandState.current = {
      isPlaying: player.isPlaying,
      elapsed: timeline.elapsed,
      play: player.play,
      pause: player.pause,
      next: player.next,
      previous: player.previous,
      seekTo: player.seekTo,
    };
  }, [timeline.elapsed, player.isPlaying, player.next, player.pause, player.play, player.previous, player.seekTo]);

  // Keep explicit WebKit music actions in every installed native generation.
  // Native targets alone do not describe the WebView's supported actions; an
  // empty Media Session action set allows WebKit's default interval controls.
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "ios" || !("mediaSession" in navigator)) return;
    const applyMusicControls = () => {
      const set = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
        try { navigator.mediaSession.setActionHandler(action, handler); } catch {}
      };
      // Each action is isolated so one unsupported action cannot block the rest.
      set("seekbackward", null);
      set("seekforward", null);
      set("previoustrack", () => runRemoteTrackCommand("previous", "web", () => commandState.current.previous()));
      set("nexttrack", () => runRemoteTrackCommand("next", "web", () => commandState.current.next()));
      set("seekto", null);
      set("play", () => { void commandState.current.play(); });
      set("pause", () => commandState.current.pause());
    };

    // Apply after StationPlayer and native metadata effects, including playback
    // restarts on the same track and foreground restoration.
    let timeout: number;
    const schedule = () => {
      window.clearTimeout(timeout);
      timeout = window.setTimeout(applyMusicControls, 0);
    };
    schedule();
    window.addEventListener("bvs:app-resume", schedule);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("bvs:app-resume", schedule);
    };
  }, [current?.id, current?.src, timeline.duration, timelineSecond, player.isPlaying]);

  useEffect(() => {
    if (!("mediaSession" in navigator) || !current || typeof MediaMetadata === "undefined") return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: current.title || "BVS Radio",
        artist: current.artist || "BVS Radio",
        album: current.project || player.playingFrom || "BVS Radio",
        artwork: [{ src: absoluteArtwork(current.artwork) || `${window.location.origin}/bvs-apple-touch-v2.png` }],
      });
    } catch {}
  }, [current, player.playingFrom]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.playbackState = player.isPlaying ? "playing" : "paused";
      if (timeline.duration > 0 && Number.isFinite(timeline.duration)) {
        navigator.mediaSession.setPositionState({
          duration: timeline.duration,
          playbackRate: 1,
          position: Math.max(0, Math.min(timeline.elapsed, timeline.duration)),
        });
      }
    } catch {}
  }, [timeline.duration, timeline.elapsed, player.isPlaying]);

  // WKWebView can restore default seek actions after position-state updates even
  // when the app previously cleared seekforward/seekbackward. Re-clear every seek
  // action after each Media Session refresh. This deliberately disables lock-screen
  // scrubbing inside the native iOS shell until a new binary proves an interval-free
  // native implementation. Explicit WebKit track actions remain installed.
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "ios" || !("mediaSession" in navigator)) return;
    const set = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try { navigator.mediaSession.setActionHandler(action, handler); } catch {}
    };
    set("seekbackward", null);
    set("seekforward", null);
    set("seekto", null);
  }, [current?.id, current?.src, timeline.duration, timeline.elapsed, player.isPlaying]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "ios" || !current) return;
    const handler = nativeHandler();
    if (!handler) return;
    lastNativeSecond.current = -1;
    handler.postMessage({
      action: "update",
      id: current.id || current.src,
      title: current.title || "BVS Radio",
      artist: current.artist || "BVS Radio",
      album: current.project || player.playingFrom || "BVS Radio",
      artwork: absoluteArtwork(current.artwork),
      playing: player.isPlaying,
      elapsed: Math.max(0, commandState.current.elapsed || 0),
      duration: Math.max(0, timeline.duration || 0),
      canNext,
      canPrevious,
      // Hard fail-safe: no currently installed native generation is allowed to
      // advertise seeking. Older v1 binaries can translate canSeek into ±15s
      // transport buttons, so keep it false until a new verified binary ships.
      canSeek: false,
    });
  }, [canNext, canPrevious, canSeek, current, timeline.duration, player.isPlaying, player.playingFrom]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "ios" || !current) return;
    const handler = nativeHandler();
    if (!handler) return;
    const second = Math.floor(timeline.elapsed || 0);
    if (second === lastNativeSecond.current) return;
    lastNativeSecond.current = second;
    handler.postMessage({
      // Reassert the music-only policy every second. Some installed binaries
      // refresh MPRemoteCommandCenter while playback advances, so one initial
      // canSeek=false is not sufficient to guarantee the ±15s buttons stay gone.
      action: "update",
      canNext,
      canPrevious,
      canSeek: false,
      playing: player.isPlaying,
      elapsed: Math.max(0, timeline.elapsed || 0),
      duration: Math.max(0, timeline.duration || 0),
    });
  }, [canNext, canPrevious, current, timeline.duration, timeline.elapsed, player.isPlaying]);

  useEffect(() => {
    const win = window as BvsWebkitWindow;

    const execute = (payload?: NativeMediaCommandPayload) => {
      const command = payload?.command;
      const state = commandState.current;
      if (command === "play") void state.play();
      else if (command === "pause") state.pause();
      else if (command === "next") runRemoteTrackCommand("next", "native", () => state.next());
      else if (command === "previous") runRemoteTrackCommand("previous", "native", () => state.previous());
      else if (command === "seek" && typeof payload?.position === "number") state.seekTo(payload.position);
      // Older installed binaries can still emit interval-command names. Treat
      // those buttons as music navigation too; never jump by 15 seconds.
      else if (command === "skip-forward") runRemoteTrackCommand("next", "native", () => state.next());
      else if (command === "skip-backward") runRemoteTrackCommand("previous", "native", () => state.previous());
    };

    const onCommand = (event: Event) => {
      execute((event as CustomEvent<NativeMediaCommandPayload>).detail);
    };

    // Native commands can arrive while React is rerendering or before this
    // bridge mounts. Mark the bridge ready and drain anything queued by Swift.
    win.__bvsNativeMediaReady = true;
    window.addEventListener("bvs:native-media-command", onCommand);
    const queued = win.__bvsNativeMediaQueue?.splice(0) || [];
    queued.forEach(execute);

    return () => {
      win.__bvsNativeMediaReady = false;
      window.removeEventListener("bvs:native-media-command", onCommand);
    };
  }, []);

  return null;
}
