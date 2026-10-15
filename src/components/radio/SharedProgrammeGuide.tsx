"use client";

import { useEffect, useState } from "react";
import type { ProgrammeSnapshot } from "@/lib/station-programme";

export default function SharedProgrammeGuide() {
  const [programme, setProgramme] = useState<ProgrammeSnapshot | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch("/api/station/now", { cache: "no-store", signal: controller.signal });
        if (!response.ok) return;
        setProgramme(await response.json() as ProgrammeSnapshot);
      } catch {
        /* The player keeps the last good moment. */
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 4000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, []);

  const item = programme?.onAir ? programme.item : null;
  const upcoming = programme?.upNext || [];
  const snippets = [
    ...(item && item.kind !== "music" ? [item] : []),
    ...upcoming.filter((entry) => entry.kind && entry.kind !== "music"),
  ];

  return (
    <section className="mt-8 grid gap-4 lg:grid-cols-3" aria-label="Shared programme">
      <article className="rounded-2xl border border-white/10 bg-bg-card/30 p-5 lg:col-span-2">
        <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-brand">Station intro</p>
        <h2 className="mt-2 text-2xl font-semibold">One programme. The same moment for everyone.</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
          You are on the shared BVS programme. The server keeps the clock. Skipping here leaves only this browser.
        </p>
        <div className="mt-5 border-t border-white/10 pt-4">
          <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-text-secondary">On now</p>
          {item ? (
            <>
              <p className="mt-2 text-xl font-semibold">{item.title}</p>
              <p className="text-sm text-text-secondary">{item.artist}</p>
              {item.detail ? <p className="mt-2 text-sm text-white/80">{item.detail}</p> : null}
            </>
          ) : (
            <p className="mt-2 text-sm text-text-secondary">The shared programme is quiet. Press Listen live and it will pick up the station clock.</p>
          )}
        </div>
        <div className="mt-5 border-t border-white/10 pt-4">
          <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-text-secondary">Studio story</p>
          <p className="mt-2 text-sm leading-6 text-text-secondary">
            {item && item.kind !== "music"
              ? "This break is a host snippet. The music returns on the shared clock."
              : item?.story || "No studio note is saved for this song yet. Editorial adds one before the host can say it."}
          </p>
        </div>
      </article>
      <div className="grid gap-4">
        <article className="rounded-2xl border border-white/10 bg-bg-card/30 p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-brand">Coming up</p>
          {upcoming.length ? (
            <ol className="mt-3 space-y-3">
              {upcoming.map((entry, index) => (
                <li key={entry.id || index}>
                  <p className="text-sm font-semibold">{entry.title}</p>
                  <p className="text-xs text-text-secondary">{entry.detail || entry.artist}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 text-sm text-text-secondary">The next songs appear when the station clock has them lined up.</p>
          )}
        </article>
        <article className="rounded-2xl border border-white/10 bg-bg-card/30 p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-brand">Snippets</p>
          {snippets.length ? (
            <ul className="mt-3 space-y-2 text-sm">
              {snippets.map((entry) => (
                <li key={entry.id}>{entry.title} · {entry.artist}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm leading-6 text-text-secondary">Approved host snippets sit between songs. None is on the clock yet, so the music keeps going.</p>
          )}
        </article>
      </div>
    </section>
  );
}
