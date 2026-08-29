"use client";

import { useEffect, useRef } from "react";
import { useStationPlayer } from "@/components/StationPlayer";

const SWIPE_THRESHOLD_PX = 56;
const AXIS_LOCK_PX = 10;
const AXIS_DOMINANCE = 1.15;
const INTERACTIVE_SELECTOR =
  'button, a, input, select, textarea, [role="button"], [role="slider"], [data-player-gesture-ignore]';

type Axis = "undecided" | "horizontal" | "vertical";

type GestureState = {
  pointerId: number;
  startX: number;
  startY: number;
  axis: Axis;
  fired: boolean;
  capturing: boolean;
};

function isNowPlayingTarget(target: EventTarget | null): Element | null {
  if (!(target instanceof Element)) return null;
  return target.closest('[aria-label="Now Playing World"]');
}

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

    const shell = document.querySelector('[aria-label="Now Playing World"]');
    if (shell instanceof HTMLElement) {
      shell.style.touchAction = "none";
      shell.style.overscrollBehavior = "none";
    }

    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverscroll = html.style.overscrollBehaviorY;
    const prevBodyOverscroll = body.style.overscrollBehaviorY;
    const prevBodyTouchAction = body.style.touchAction;
    html.style.overscrollBehaviorY = "none";
    body.style.overscrollBehaviorY = "none";
    // Keep body from rubber-banding / pull-to-refresh while NP is open
    body.style.touchAction = "none";

    const clearGesture = () => {
      gesture.current = null;
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse" || !event.isPrimary) return;
      const surface = isNowPlayingTarget(event.target);
      if (!surface) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest(INTERACTIVE_SELECTOR)) return;

      gesture.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        axis: "undecided",
        fired: false,
        capturing: false,
      };
    };

    const onPointerMove = (event: PointerEvent) => {
      const current = gesture.current;
      if (!current || current.pointerId !== event.pointerId || current.fired) return;
      if (!isNowPlayingTarget(event.target) && !current.capturing) return;

      const dx = event.clientX - current.startX;
      const dy = event.clientY - current.startY;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      if (current.axis === "undecided") {
        if (absX < AXIS_LOCK_PX && absY < AXIS_LOCK_PX) return;
        current.axis = absY >= absX * AXIS_DOMINANCE ? "vertical" : absX >= absY * AXIS_DOMINANCE ? "horizontal" : "undecided";
        if (current.axis === "undecided") return;
      }

      // Own the gesture once direction is known so the page behind cannot scroll/refresh.
      if (!current.capturing) {
        current.capturing = true;
        try {
          (event.target as Element | null)?.setPointerCapture?.(event.pointerId);
        } catch {
          // ignore capture failures on odd targets
        }
      }

      if (event.cancelable) event.preventDefault();

      if (current.axis === "vertical") {
        // Only swipe-down dismisses. Up stays no-op (no page scroll behind).
        if (dy >= SWIPE_THRESHOLD_PX && absY >= absX * AXIS_DOMINANCE) {
          current.fired = true;
          actions.current.close();
          clearGesture();
        }
        return;
      }

      if (current.axis === "horizontal") {
        if (absX >= SWIPE_THRESHOLD_PX && absX >= absY * AXIS_DOMINANCE) {
          current.fired = true;
          if (dx > 0) actions.current.next();
          else actions.current.previous();
          clearGesture();
        }
      }
    };

    const endGesture = (event: PointerEvent) => {
      if (gesture.current?.pointerId === event.pointerId) clearGesture();
    };

    // Non-passive so preventDefault can block pull-to-refresh / background scroll.
    window.addEventListener("pointerdown", onPointerDown, { capture: true, passive: true });
    window.addEventListener("pointermove", onPointerMove, { capture: true, passive: false });
    window.addEventListener("pointerup", endGesture, { capture: true, passive: true });
    window.addEventListener("pointercancel", endGesture, { capture: true, passive: true });
    window.addEventListener("lostpointercapture", endGesture, { capture: true, passive: true });

    // iOS Safari still routes some overscroll through touch events.
    const onTouchMove = (event: TouchEvent) => {
      const current = gesture.current;
      if (!current || current.fired) return;
      if (current.axis === "vertical" || current.axis === "horizontal" || current.capturing) {
        if (event.cancelable) event.preventDefault();
      }
    };
    window.addEventListener("touchmove", onTouchMove, { capture: true, passive: false });

    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("pointerup", endGesture, true);
      window.removeEventListener("pointercancel", endGesture, true);
      window.removeEventListener("lostpointercapture", endGesture, true);
      window.removeEventListener("touchmove", onTouchMove, true);
      html.style.overscrollBehaviorY = prevHtmlOverscroll;
      body.style.overscrollBehaviorY = prevBodyOverscroll;
      body.style.touchAction = prevBodyTouchAction;
      if (shell instanceof HTMLElement) {
        shell.style.touchAction = "";
        shell.style.overscrollBehavior = "";
      }
      gesture.current = null;
    };
  }, [player.nowPlayingOpen]);

  return null;
}
