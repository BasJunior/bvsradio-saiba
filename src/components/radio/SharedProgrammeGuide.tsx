"use client";

import { useEffect, useRef, useState } from "react";
import { useStationPlayer } from "@/components/StationPlayer";
import type { ProgrammeSnapshot } from "@/lib/station-programme";

export default function SharedProgrammeGuide() {
  const player = useStationPlayer();
  const [programme, setProgramme] = useState<ProgrammeSnapshot | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [joining, setJoining] = useState(false);
  const joiningRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    let inFlight = false;
    const load = async () => {
      if (inFlight || controller.signal.aborted) return;
      inFlight = true;
      try {
        const response = await fetch("/api/station/now", {
          cache: "no-store",
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(10000),
          ]),
        });
        if (!response.ok) throw new Error("Programme unavailable");
        const snapshot = (await response.json()) as ProgrammeSnapshot;
        if (!controller.signal.aborted) {
          setProgramme(snapshot);
          setUnavailable(false);
        }
      } catch {
        if (!controller.signal.aborted) setUnavailable(true);
      } finally {
        inFlight = false;
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 4000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, []);

  const item = !unavailable && programme?.onAir ? programme.item : null;
  const upcoming = !unavailable ? programme?.upNext || [] : [];
  const snippets = [
    ...(item && item.kind !== "music" ? [item] : []),
    ...upcoming.filter((entry) => entry.kind && entry.kind !== "music"),
  ];
  const following =
    player.sharedProgramme && !unavailable && Boolean(programme?.onAir);
  const current = player.current;
  const status = unavailable
    ? "The station update is unavailable. Your current audio can keep playing."
    : following
      ? player.isPlaying
        ? "You’re listening live with BVS."
        : "You’re paused. Resume to catch up with the station."
      : player.isPlaying
        ? "You’re listening to your own selection. Rejoin live whenever you’re ready."
        : "Join the station at the song playing now.";
  const join = async () => {
    if (joiningRef.current) return;
    joiningRef.current = true;
    setJoining(true);
    try {
      await player.joinSharedProgramme();
    } finally {
      joiningRef.current = false;
      setJoining(false);
    }
  };

  return (
    <section
      className="mt-8 grid gap-4 lg:grid-cols-3"
      aria-label="Shared programme"
    >
      <article className="border border-white/10 bg-bg-card/30 p-5 lg:col-span-2">
        <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-brand">
          The BVS programme
        </p>
        <h2 className="mt-2 text-2xl font-semibold">
          One station. Independent sound.
        </h2>
        {programme?.host && !unavailable && (
          <p className="mt-2 text-sm text-text-secondary">
            {programme.host.sessionName} with {programme.host.hostName}
          </p>
        )}
        <p role="status" className="mt-2 text-sm leading-6 text-text-secondary">
          {status}
        </p>
        {(!following || !player.isPlaying) && (
          <button
            type="button"
            disabled={joining}
            onClick={() => void join()}
            className="mt-4 min-h-11 border border-brand/40 px-4 py-2 text-sm font-semibold text-brand disabled:opacity-50"
          >
            {joining ? "Joining…" : following ? "Resume live" : "Rejoin live"}
          </button>
        )}
        {current && !following && (
          <div className="mt-5 border-t border-white/10 pt-4">
            <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-text-secondary">
              You’re listening to
            </p>
            <p className="mt-2 font-semibold">{current.title}</p>
            <p className="text-sm text-text-secondary">{current.artist}</p>
          </div>
        )}
        <div className="mt-5 border-t border-white/10 pt-4">
          <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-text-secondary">
            On the station now
          </p>
          {item ? (
            <>
              <p className="mt-2 text-xl font-semibold">{item.title}</p>
              <p className="text-sm text-text-secondary">{item.artist}</p>
              {item.detail && (
                <p className="mt-2 text-sm text-white/80">{item.detail}</p>
              )}
            </>
          ) : (
            <p className="mt-2 text-sm text-text-secondary">
              {unavailable
                ? "Waiting for the next station update."
                : programme
                  ? "The shared programme is currently off air."
                  : "Loading the station…"}
            </p>
          )}
        </div>
        {item?.kind === "music" && item.story && (
          <div className="mt-5 border-t border-white/10 pt-4">
            <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-text-secondary">
              Behind the song
            </p>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              {item.story}
            </p>
          </div>
        )}
      </article>
      <div className="grid gap-4">
        <article className="border border-white/10 bg-bg-card/30 p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-brand">
            Coming up on the station
          </p>
          {upcoming.length ? (
            <ol className="mt-3 space-y-3">
              {upcoming.map((entry, index) => (
                <li key={entry.id || index}>
                  <p className="text-sm font-semibold">{entry.title}</p>
                  <p className="text-xs text-text-secondary">
                    {[entry.artist, entry.detail].filter(Boolean).join(" · ")}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 text-sm text-text-secondary">
              {unavailable
                ? "The programme will update when the connection returns."
                : "More music is on its way."}
            </p>
          )}
        </article>
        {snippets.length > 0 && (
          <article className="border border-white/10 bg-bg-card/30 p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-brand">
              Between the songs
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              {snippets.map((entry) => (
                <li key={entry.id}>
                  {entry.title} · {entry.artist}
                </li>
              ))}
            </ul>
          </article>
        )}
      </div>
    </section>
  );
}
