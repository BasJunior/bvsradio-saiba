"use client";

import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { useStationPlayer } from "@/components/StationPlayer";
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
  const lastNativeSecond = useRef(-1);
  const commandState = useRef({
    isPlaying: player.isPlaying,
    elapsed: player.elapsed,
    play: player.play,
    pause: player.pause,
    next: player.next,
    previous: player.previous,
    seekTo: player.seekTo,
  });
  const current = player.current;
  const constrainedNext = Boolean(current && (isBeatTrack(current) || isEditorialPlay(current)));
  const canNext = Boolean(
    current &&
    (player.upNext.length > 0 || (!constrainedNext && (player.mode === "station" || player.autoplay)))
  );
  const canPrevious = Boolean(current && (player.elapsed > 3 || player.history.length > 0));
  const canSeek = Boolean(current && player.duration > 0 && Number.isFinite(player.duration));

  useEffect(() => {
    commandState.current = {
      isPlaying: player.isPlaying,
      elapsed: player.elapsed,
      play: player.play,
      pause: player.pause,
      next: player.next,
      previous: player.previous,
      seekTo: player.seekTo,
    };
  }, [player.elapsed, player.isPlaying, player.next, player.pause, player.play, player.previous, player.seekTo]);

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
      if (player.duration > 0 && Number.isFinite(player.duration)) {
        navigator.mediaSession.setPositionState({
          duration: player.duration,
          playbackRate: 1,
          position: Math.max(0, Math.min(player.elapsed, player.duration)),
        });
      }
    } catch {}
  }, [player.duration, player.elapsed, player.isPlaying]);

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
      elapsed: Math.max(0, player.elapsed || 0),
      duration: Math.max(0, player.duration || 0),
      canNext,
      canPrevious,
      canSeek,
    });
  }, [canNext, canPrevious, canSeek, current, player.duration, player.isPlaying, player.playingFrom]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "ios" || !current) return;
    const handler = nativeHandler();
    if (!handler) return;
    const second = Math.floor(player.elapsed || 0);
    if (second === lastNativeSecond.current) return;
    lastNativeSecond.current = second;
    handler.postMessage({
      action: "position",
      playing: player.isPlaying,
      elapsed: Math.max(0, player.elapsed || 0),
      duration: Math.max(0, player.duration || 0),
    });
  }, [current, player.duration, player.elapsed, player.isPlaying]);

  useEffect(() => {
    const win = window as BvsWebkitWindow;

    const execute = (payload?: NativeMediaCommandPayload) => {
      const command = payload?.command;
      const state = commandState.current;
      if (command === "play") void state.play();
      else if (command === "pause") state.pause();
      else if (command === "next") state.next();
      else if (command === "previous") state.previous();
      else if (command === "seek" && typeof payload?.position === "number") state.seekTo(payload.position);
      else if (command === "skip-forward") state.seekTo(state.elapsed + (payload?.interval || 15));
      else if (command === "skip-backward") state.seekTo(state.elapsed - (payload?.interval || 15));
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
