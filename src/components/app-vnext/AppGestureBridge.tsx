"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useStationPlayer } from "@/components/StationPlayer";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";

type TouchStart = {
  x: number;
  y: number;
  at: number;
  target: Element | null;
  mode: "edge" | "player" | "now-playing" | "other";
};

function isInteractive(target: Element | null) {
  return Boolean(target?.closest("button, a, input, textarea, select, [role='slider'], [contenteditable='true']"));
}

export default function AppGestureBridge({ surface }: { surface: AppSurface }) {
  const router = useRouter();
  const player = useStationPlayer();
  const start = useRef<TouchStart | null>(null);

  useEffect(() => {
    const onStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      const touch = event.touches[0];
      const target = event.target instanceof Element ? event.target : null;
      const mode: TouchStart["mode"] = player.nowPlayingOpen && target?.closest("[aria-label='Now Playing World']")
        ? "now-playing"
        : target?.closest("[data-bvs-player]")
          ? "player"
          : surface === "ios" && touch.clientX <= 24
            ? "edge"
            : "other";
      start.current = { x: touch.clientX, y: touch.clientY, at: Date.now(), target, mode };
    };

    const onEnd = (event: TouchEvent) => {
      const began = start.current;
      start.current = null;
      if (!began || event.changedTouches.length !== 1) return;
      const touch = event.changedTouches[0];
      const dx = touch.clientX - began.x;
      const dy = touch.clientY - began.y;
      const ax = Math.abs(dx);
      const ay = Math.abs(dy);
      const elapsed = Date.now() - began.at;
      if (elapsed > 850) return;

      if (began.mode === "edge" && dx > 72 && ax > ay * 1.2) {
        event.preventDefault();
        router.back();
        return;
      }

      if (began.mode === "player" && !isInteractive(began.target) && dy < -54 && ay > ax * 1.1) {
        event.preventDefault();
        player.setQueueOpen(false);
        player.openNowPlaying();
        return;
      }

      if (began.mode !== "now-playing" || isInteractive(began.target)) return;
      const dialog = began.target?.closest("[aria-label='Now Playing World']") as HTMLElement | null;
      if (dy > 78 && ay > ax * 1.15 && (dialog?.scrollTop || 0) <= 6) {
        event.preventDefault();
        player.closeNowPlaying();
        return;
      }
      if (ax > 72 && ax > ay * 1.25) {
        event.preventDefault();
        if (dx < 0) player.next();
        else player.previous();
      }
    };

    document.addEventListener("touchstart", onStart, { passive: true, capture: true });
    document.addEventListener("touchend", onEnd, { passive: false, capture: true });
    return () => {
      document.removeEventListener("touchstart", onStart, true);
      document.removeEventListener("touchend", onEnd, true);
    };
  }, [player, router, surface]);

  return null;
}
