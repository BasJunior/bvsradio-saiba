"use client";

import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { useStationPlayer } from "@/components/StationPlayer";

type NativeNowPlayingHandler = {
  postMessage: (payload: Record<string, unknown>) => void;
};

type BvsWebkitWindow = Window & {
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
  const current = player.current;

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
    });
  }, [current, player.duration, player.isPlaying, player.playingFrom]);

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
    const onCommand = (event: Event) => {
      const command = (event as CustomEvent<{ command?: string }>).detail?.command;
      if (command === "play" && !player.isPlaying) void player.toggle();
      else if (command === "pause" && player.isPlaying) void player.toggle();
      else if (command === "next") player.next();
      else if (command === "previous") player.previous();
    };
    window.addEventListener("bvs:native-media-command", onCommand);
    return () => window.removeEventListener("bvs:native-media-command", onCommand);
  }, [player]);

  return null;
}
