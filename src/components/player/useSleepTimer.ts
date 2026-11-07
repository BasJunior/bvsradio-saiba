"use client";

import { useCallback, useEffect, useState } from "react";

export const SLEEP_MINUTES = [15, 30, 45, 60] as const;

/** Pause this many seconds before the end so the queue never advances. */
const END_OF_TRACK_LEAD_SECONDS = 0.6;

type SleepTimer =
  | { mode: "clock"; minutes: number; deadline: number }
  | { mode: "track"; minutes: 0; deadline: null };

/** A wall-clock deadline survives track changes and background timer throttling. */
export function useSleepTimer(pause: () => void) {
  const [timer, setTimer] = useState<SleepTimer | null>(null);
  const [message, setMessage] = useState("");
  const setMinutes = useCallback((minutes: number) => {
    if (!SLEEP_MINUTES.some((value) => value === minutes)) {
      setTimer(null);
      setMessage("Sleep timer off.");
      return;
    }
    setTimer({ mode: "clock", minutes, deadline: Date.now() + minutes * 60_000 });
    setMessage(`Playback will pause in ${minutes} minutes.`);
  }, []);

  const setEndOfTrack = useCallback(() => {
    setTimer({ mode: "track", minutes: 0, deadline: null });
    setMessage("Playback will pause when this track ends.");
  }, []);

  useEffect(() => {
    if (!timer) return;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      pause();
      setTimer(null);
      setMessage("Sleep timer finished. Playback paused.");
    };

    if (timer.mode === "track") {
      const onTime = (event: Event) => {
        const el = event.target;
        if (!(el instanceof HTMLMediaElement) || !Number.isFinite(el.duration) || el.duration <= 0) return;
        if (el.currentTime >= el.duration - END_OF_TRACK_LEAD_SECONDS) finish();
      };
      // Fallback: if the element ended before a timeupdate caught it, stop the next track.
      const onEnded = () => window.setTimeout(finish, 0);
      document.addEventListener("timeupdate", onTime, true);
      document.addEventListener("ended", onEnded, true);
      return () => {
        document.removeEventListener("timeupdate", onTime, true);
        document.removeEventListener("ended", onEnded, true);
      };
    }

    const deadline = timer.deadline;
    const check = () => {
      if (Date.now() >= deadline) finish();
    };
    const timeout = window.setTimeout(check, Math.max(0, deadline - Date.now()));
    // WebViews may suspend JS timers while backgrounded. Recheck against the
    // deadline on audio events and foreground restoration, never a tick count.
    document.addEventListener("timeupdate", check, true);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("bvs:app-resume", check);
    return () => {
      window.clearTimeout(timeout);
      document.removeEventListener("timeupdate", check, true);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("bvs:app-resume", check);
    };
  }, [timer, pause]);

  return { timer, message, setMinutes, setEndOfTrack };
}
