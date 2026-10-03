"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useStationPlayer } from "@/components/StationPlayer";
import { isNativeRuntime } from "@/lib/app-native";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";

type TouchStart = {
  x: number;
  y: number;
  at: number;
  target: Element | null;
  mode: "edge" | "player" | "other";
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
      // The shared pointer bridge owns Now Playing gestures on every surface.
      // A second touch handler here would skip twice and intercept sheet scrolling.
      const inNowPlaying = Boolean(target?.closest("[aria-label='Now Playing World']"));
      const mode: TouchStart["mode"] = inNowPlaying ? "other"
        : target?.closest("[data-bvs-player]") ? "player"
        : surface === "ios" && !isNativeRuntime() && touch.clientX <= 24 ? "edge"
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
