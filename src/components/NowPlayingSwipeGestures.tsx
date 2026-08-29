"use client";

import { useEffect, useRef } from "react";
import { useStationPlayer } from "@/components/StationPlayer";

const DISMISS_THRESHOLD_PX = 72;
const TRACK_THRESHOLD_PX = 64;
const AXIS_LOCK_PX = 12;
const AXIS_DOMINANCE = 1.25;
const INTERACTIVE_SELECTOR =
  'button, a, input, select, textarea, [role="button"], [role="slider"], [data-player-gesture-ignore]';

type Axis = "undecided" | "horizontal" | "vertical";
type GestureKind = "dismiss" | "track";

type GestureState = {
  pointerId: number;
  startX: number;
  startY: number;
  kind: GestureKind;
  axis: Axis;
  fired: boolean;
  capturing: boolean;
};

function closestEl(target: EventTarget | null, selector: string): Element | null {
  if (!(target instanceof Element)) return null;
  return target.closest(selector);
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
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverscroll = html.style.overscrollBehaviorY;
    const prevBodyOverscroll = body.style.overscrollBehaviorY;
    // Stop the page *behind* the sheet from pull-to-refresh, but do not freeze the sheet itself.
    html.style.overscrollBehaviorY = "none";
    body.style.overscrollBehaviorY = "none";
    if (shell instanceof HTMLElement) {
      shell.style.overscrollBehavior = "contain";
    }

    const clearGesture = () => {
      gesture.current = null;
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse" || !event.isPrimary) return;
      if (!closestEl(event.target, '[aria-label="Now Playing World"]')) return;

      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest(INTERACTIVE_SELECTOR)) return;

      const dismissZone = closestEl(event.target, "[data-np-dismiss-zone]");
      const trackZone = closestEl(event.target, "[data-np-swipe-track]");
      if (!dismissZone && !trackZone) {
        // Body/content scrolls normally; no global vertical dismiss.
        return;
      }

      gesture.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        kind: dismissZone ? "dismiss" : "track",
        axis: "undecided",
        fired: false,
        capturing: false,
      };
    };

    const onPointerMove = (event: PointerEvent) => {
      const current = gesture.current;
      if (!current || current.pointerId !== event.pointerId || current.fired) return;

      const dx = event.clientX - current.startX;
      const dy = event.clientY - current.startY;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      if (current.axis === "undecided") {
        if (absX < AXIS_LOCK_PX && absY < AXIS_LOCK_PX) return;
        current.axis =
          absY >= absX * AXIS_DOMINANCE ? "vertical" : absX >= absY * AXIS_DOMINANCE ? "horizontal" : "undecided";
        if (current.axis === "undecided") return;
      }

      if (current.kind === "dismiss") {
        // Header/handle only: vertical down closes. Horizontal here is ignored so users can still aim for close.
        if (current.axis !== "vertical") {
          clearGesture();
          return;
        }
        if (!current.capturing) {
          current.capturing = true;
          try {
            (event.target as Element | null)?.setPointerCapture?.(event.pointerId);
          } catch {
            /* ignore */
          }
        }
        if (event.cancelable) event.preventDefault();
        if (dy >= DISMISS_THRESHOLD_PX) {
          current.fired = true;
          actions.current.close();
          clearGesture();
        }
        return;
      }

      // Track zone: horizontal next/prev only. Vertical stays free for any nested scroll.
      if (current.kind === "track") {
        if (current.axis === "vertical") {
          clearGesture();
          return;
        }
        if (current.axis !== "horizontal") return;
        if (!current.capturing) {
          current.capturing = true;
          try {
            (event.target as Element | null)?.setPointerCapture?.(event.pointerId);
          } catch {
            /* ignore */
          }
        }
        if (event.cancelable) event.preventDefault();
        if (absX >= TRACK_THRESHOLD_PX) {
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

    window.addEventListener("pointerdown", onPointerDown, { capture: true, passive: true });
    window.addEventListener("pointermove", onPointerMove, { capture: true, passive: false });
    window.addEventListener("pointerup", endGesture, { capture: true, passive: true });
    window.addEventListener("pointercancel", endGesture, { capture: true, passive: true });
    window.addEventListener("lostpointercapture", endGesture, { capture: true, passive: true });

    const onTouchMove = (event: TouchEvent) => {
      const current = gesture.current;
      if (!current || current.fired || !current.capturing) return;
      if (event.cancelable) event.preventDefault();
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
      if (shell instanceof HTMLElement) shell.style.overscrollBehavior = "";
      gesture.current = null;
    };
  }, [player.nowPlayingOpen]);

  return null;
}
