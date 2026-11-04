"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useStationPlayer } from "@/components/StationPlayer";
import { isNativeRuntime } from "@/lib/app-native";
import { resolveAppSwipeIntent } from "@/lib/app-gesture-intent";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";

type TouchStart = { x: number; y: number; at: number; mode: "edge" | "mini" | "other" };

function isMiniPlayerSwipeTarget(target: Element | null) {
  // Use the actual mini-player DOM class, not the stale data-bvs-player selector.
  if (!target?.closest(".bvs-persistent-player-inner")) return false;
  const control = target.closest("button, a, input, textarea, select, [role='slider'], [role='button'], [contenteditable='true']");
  if (!control) return true;
  // Taps still open Now Playing, but a deliberate swipe across artwork/title
  // provides a Spotify-like shortcut without hijacking transport controls.
  return control instanceof HTMLButtonElement &&
    (control.getAttribute("aria-label") || "").startsWith("Open Now Playing");
}

export default function AppGestureBridge({ surface }: { surface: AppSurface }) {
  const router = useRouter();
  const player = useStationPlayer();
  const start = useRef<TouchStart | null>(null);
  const suppressClickUntil = useRef(0);

  useEffect(() => {
    const onStart = (event: TouchEvent) => {
      start.current = null;
      if (event.touches.length !== 1) return;
      const touch = event.touches[0];
      const target = event.target instanceof Element ? event.target : null;
      // The full Now Playing sheet already has its own gesture owner.
      if (target?.closest("[aria-label='Now Playing World'], [data-now-playing-shell='true']")) return;
      const mode: TouchStart["mode"] = isMiniPlayerSwipeTarget(target) ? "mini"
        : surface === "ios" && !isNativeRuntime() && touch.clientX <= 24 ? "edge" : "other";
      start.current = { x: touch.clientX, y: touch.clientY, at: Date.now(), mode };
    };
    const onEnd = (event: TouchEvent) => {
      const began = start.current;
      start.current = null;
      if (!began || event.changedTouches.length !== 1) return;
      const touch = event.changedTouches[0];
      const intent = resolveAppSwipeIntent(touch.clientX - began.x, touch.clientY - began.y, Date.now() - began.at, began.mode === "edge" ? 72 : 88);
      if (!intent) return;
      // Browser preview only: don't shadow the native iOS edge-back gesture.
      if (began.mode === "edge" && intent === "right") {
        if (window.history.length > 1) router.back();
        else router.push(`/app/${surface}`);
        return;
      }
      if (began.mode !== "mini") return;
      if (intent === "up") {
        if (event.cancelable) event.preventDefault();
        suppressClickUntil.current = Date.now() + 450;
        player.setQueueOpen(false);
        player.openNowPlaying();
      } else if (surface === "ios" && player.current && (intent === "left" || intent === "right")) {
        if (event.cancelable) event.preventDefault();
        suppressClickUntil.current = Date.now() + 450;
        if (intent === "left") player.next();
        else player.previous();
      }
    };
    const onCancel = () => { start.current = null; };
    const onClickCapture = (event: MouseEvent) => {
      if (Date.now() > suppressClickUntil.current) return;
      const target = event.target instanceof Element ? event.target : null;
      if (!target?.closest(".bvs-persistent-player-inner")) return;
      event.preventDefault();
      event.stopPropagation();
      suppressClickUntil.current = 0;
    };
    document.addEventListener("touchstart", onStart, { passive: true, capture: true });
    document.addEventListener("touchend", onEnd, { passive: false, capture: true });
    document.addEventListener("touchcancel", onCancel, { passive: true, capture: true });
    document.addEventListener("click", onClickCapture, true);
    return () => {
      document.removeEventListener("touchstart", onStart, true);
      document.removeEventListener("touchend", onEnd, true);
      document.removeEventListener("touchcancel", onCancel, true);
      document.removeEventListener("click", onClickCapture, true);
    };
  }, [player, router, surface]);
  return null;
}
