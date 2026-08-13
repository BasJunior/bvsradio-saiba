"use client";

import HomeListenPanel from "@/components/HomeListenPanel";

export default function AppListenHero({
  surfaceLabel,
  trackCount,
}: {
  surfaceLabel: string;
  trackCount: number;
}) {
  return (
    <section id="listen" className="scroll-mt-24">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-brand">Live on BVS · {surfaceLabel}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">Start listening.</h1>
        </div>
        <p className="text-xs text-text-secondary">
          {trackCount > 0 ? `${trackCount} cleared recording${trackCount === 1 ? "" : "s"}` : "Selection in progress"}
        </p>
      </div>
      <HomeListenPanel />
    </section>
  );
}
