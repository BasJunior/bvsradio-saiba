"use client";

import { useCallback, useEffect, useState } from "react";

export const SLEEP_MINUTES = [15, 30, 45, 60] as const;

/** A wall-clock deadline survives track changes and background timer throttling. */
export function useSleepTimer(pause: () => void) {
  const [timer, setTimer] = useState<{ minutes: number; deadline: number } | null>(null);
  const [message, setMessage] = useState("");
  const setMinutes = useCallback((minutes: number) => {
    if (!SLEEP_MINUTES.some((value) => value === minutes)) {
      setTimer(null);
      setMessage("Sleep timer off.");
      return;
    }
    setTimer({ minutes, deadline: Date.now() + minutes * 60_000 });
    setMessage(`Playback will pause in ${minutes} minutes.`);
  }, []);

  useEffect(() => {
    if (!timer) return;
    let finished = false;
    const check = () => {
      if (finished || Date.now() < timer.deadline) return;
      finished = true;
      pause();
      setTimer(null);
      setMessage("Sleep timer finished. Playback paused.");
    };
    const timeout = window.setTimeout(check, Math.max(0, timer.deadline - Date.now()));
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

  return { timer, message, setMinutes };
}
