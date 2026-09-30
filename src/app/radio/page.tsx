import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import RadioPlayer from "@/components/RadioPlayer";
import RadioSessionHome from "@/components/RadioSessionHome";
import RadioShelfNav from "@/components/RadioShelfNav";
import RadioProgrammeSections from "@/components/radio/RadioProgrammeSections";

export const metadata: Metadata = {
  title: "Listen | BVS Radio",
  description: "Settle into BVS Radio: continuous rotation, scheduled programmes, verified music context and the live listener room.",
};

export default function RadioPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[.18em] text-brand">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" /> On air
            </span>
            <span className="text-xs text-text-secondary">CAT · Zimbabwe roots</span>
          </div>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">BVS Radio</h1>
          <p className="mt-2 max-w-2xl text-base text-text-secondary sm:text-lg">Independent sound, rooted in Zimbabwe. Stay awhile.</p>
        </div>
        <nav className="flex flex-wrap gap-2 text-sm" aria-label="Radio pages">
          <Link href="/radio/schedule" className="rounded-full border border-white/15 px-4 py-2 hover:bg-white/5">Schedule</Link>
          <Link href="/radio/room" className="rounded-full border border-white/15 px-4 py-2 hover:bg-white/5">Live room</Link>
          <Link href="/shows" className="rounded-full border border-white/15 px-4 py-2 hover:bg-white/5">Shows</Link>
        </nav>
      </header>

      <RadioShelfNav />

      <section id="radio-on-air" className="scroll-mt-28" aria-labelledby="now-playing-heading">
        <h2 id="now-playing-heading" className="sr-only">Now playing on BVS Radio</h2>
        <RadioPlayer />
      </section>

      <div id="radio-session" className="mt-8 scroll-mt-28">
        <RadioSessionHome />
      </div>

      <Suspense
        fallback={
          <div className="mt-12 space-y-4" aria-label="Loading radio programme">
            <div className="h-32 animate-pulse rounded-2xl border border-white/10 bg-bg-card/20" />
            <div className="h-48 animate-pulse rounded-2xl border border-white/10 bg-bg-card/20" />
          </div>
        }
      >
        <RadioProgrammeSections />
      </Suspense>

      <section className="mt-14 flex flex-col gap-4 rounded-2xl border border-white/10 bg-bg-card/25 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-brand">For artists</p>
          <h2 className="mt-1 text-2xl font-semibold">Want your music in the BVS ecosystem?</h2>
          <p className="mt-2 text-sm text-text-secondary">Submit for editorial review. Publishing and rotation remain separate from Premium distribution.</p>
        </div>
        <Link href="/upload" className="shrink-0 rounded-full bg-brand px-5 py-2.5 text-center text-sm font-medium text-black">Submit music</Link>
      </section>
    </main>
  );
}
