"use client";

import { useEffect, useRef } from "react";
import { useStationPlayer } from "@/components/StationPlayer";

const SWIPE_THRESHOLD_PX = 56;
const AXIS_DOMINANCE = 1.2;
const INTERACTIVE_SELECTOR =
  'button, a, input, select, textarea, [role="button"], [role="slider"], [data-player-gesture-ignore]';

type GestureState = {
  pointerId: number;
  startX: number;
  startY: number;
  fired: boolean;
};

export default function NowPlayingSwipeGestures() {
  const player = useStationPlayer();
  const gesture = useRef<GestureState | null>(null);
  const actions = useRef({
    close: player.closeNowPlaying,
    next: player.next,
    previous: player.previous,
  });

  useEffect(() => {
    actions.current = {
      close: player.closeNowPlaying,
      next: player.next,
      previous: player.previous,
    };
  }, [player.closeNowPlaying, player.next, player.previous]);

  useEffect(() => {
    if (!player.nowPlayingOpen) {
      gesture.current = null;
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse" || !event.isPrimary) return;
      const target = event.target instanceof Element ? event.target : null;
      if (!target?.closest('[aria-label="Now Playing World"]')) return;
      if (target.closest(INTERACTIVE_SELECTOR)) return;

      gesture.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        fired: false,
      };
    };

    const onPointerMove = (event: PointerEvent) => {
      const current = gesture.current;
      if (!current || current.pointerId !== event.pointerId || current.fired) return;

      const dx = event.clientX - current.startX;
      const dy = event.clientY - current.startY;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      if (dy >= SWIPE_THRESHOLD_PX && absY >= absX * AXIS_DOMINANCE) {
        current.fired = true;
        actions.current.close();
        return;
      }

      if (absX >= SWIPE_THRESHOLD_PX && absX >= absY * AXIS_DOMINANCE) {
        current.fired = true;
        if (dx > 0) actions.current.next();
        else actions.current.previous();
      }
    };

    const endGesture = (event: PointerEvent) => {
      if (gesture.current?.pointerId === event.pointerId) gesture.current = null;
    };

    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerup", endGesture, { passive: true });
    window.addEventListener("pointercancel", endGesture, { passive: true });

    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", endGesture);
      window.removeEventListener("pointercancel", endGesture);
      gesture.current = null;
    };
  }, [player.nowPlayingOpen]);

  return null;
}
