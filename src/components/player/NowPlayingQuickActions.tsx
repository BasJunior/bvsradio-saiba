"use client";

import { useEffect, useState } from "react";
import { canPickAudioRoute, haptic, pickAudioRoute } from "@/lib/native-device";
import { AirPlayIcon, MoonIcon, QueueIcon } from "@/components/player/PlayerIcons";
import { SLEEP_MINUTES, type useSleepTimer } from "@/components/player/useSleepTimer";

type SleepControl = ReturnType<typeof useSleepTimer>;

function sleepLabel(sleep: SleepControl) {
  const timer = sleep.timer;
  if (!timer) return "Sleep";
  if (timer.mode === "track") return "End of track";
  return new Date(timer.deadline).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * Bottom action bar of Now Playing: output device, sleep timer and queue, the
 * three controls listeners reach for most in top-tier players.
 */
export default function NowPlayingQuickActions({
  sleep,
  queueCount,
  onOpenQueue,
}: {
  sleep: SleepControl;
  queueCount: number;
  onOpenQueue: () => void;
}) {
  const [sleepOpen, setSleepOpen] = useState(false);
  const [routeAvailable, setRouteAvailable] = useState(false);

  useEffect(() => {
    // Bridge handlers attach after the WebView loads; recheck shortly after mount.
    const check = () => setRouteAvailable(canPickAudioRoute());
    check();
    const timeout = window.setTimeout(check, 1200);
    return () => window.clearTimeout(timeout);
  }, []);

  const chip = "min-h-10 rounded-full border px-4 text-sm font-semibold transition";
  const active = sleep.timer !== null;

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/[.04] px-2 py-1.5" role="group" aria-label="Listening tools">
        <button
          type="button"
          onClick={() => { haptic("light"); pickAudioRoute(); }}
          disabled={!routeAvailable}
          className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl text-xs font-semibold text-white/75 transition hover:bg-white/10 disabled:opacity-35"
          aria-label="Choose audio output (AirPlay or Bluetooth)"
          title={routeAvailable ? "AirPlay and Bluetooth" : "Output selection is available in the BVS app and Safari"}
        >
          <AirPlayIcon size={20} />
          <span>Output</span>
        </button>
        <button
          type="button"
          onClick={() => { haptic("selection"); setSleepOpen((open) => !open); }}
          aria-expanded={sleepOpen}
          aria-controls="bvs-sleep-options"
          className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl text-xs font-semibold transition hover:bg-white/10 ${active ? "text-brand" : "text-white/75"}`}
          aria-label={active ? `Sleep timer on: ${sleepLabel(sleep)}` : "Set sleep timer"}
        >
          <MoonIcon size={19} />
          <span className="tabular-nums">{sleepLabel(sleep)}</span>
        </button>
        <button
          type="button"
          onClick={() => { haptic("light"); onOpenQueue(); }}
          className="flex min-h-11 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl text-xs font-semibold text-white/75 transition hover:bg-white/10"
          aria-label={`Open queue, ${queueCount} tracks up next`}
        >
          <QueueIcon size={20} />
          <span>Up next</span>
          {queueCount ? <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] tabular-nums text-white/70">{queueCount > 99 ? "99+" : queueCount}</span> : null}
        </button>
      </div>

      {sleepOpen ? (
        <div id="bvs-sleep-options" className="mt-3 rounded-2xl border border-white/10 bg-[#121212]/90 p-4 backdrop-blur" role="group" aria-label="Sleep timer">
          <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-brand">Sleep timer</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {SLEEP_MINUTES.map((minutes) => {
              const selected = sleep.timer?.mode === "clock" && sleep.timer.minutes === minutes;
              return (
                <button
                  key={minutes}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => { haptic("selection"); sleep.setMinutes(minutes); setSleepOpen(false); }}
                  className={`${chip} ${selected ? "border-brand bg-brand text-black" : "border-white/15 text-white/80 hover:border-brand/50"}`}
                >
                  {minutes} min
                </button>
              );
            })}
            <button
              type="button"
              aria-pressed={sleep.timer?.mode === "track"}
              onClick={() => { haptic("selection"); sleep.setEndOfTrack(); setSleepOpen(false); }}
              className={`${chip} ${sleep.timer?.mode === "track" ? "border-brand bg-brand text-black" : "border-white/15 text-white/80 hover:border-brand/50"}`}
            >
              End of track
            </button>
            {active ? (
              <button
                type="button"
                onClick={() => { haptic("light"); sleep.setMinutes(0); setSleepOpen(false); }}
                className={`${chip} border-white/15 text-white/60 hover:text-white`}
              >
                Turn off
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
