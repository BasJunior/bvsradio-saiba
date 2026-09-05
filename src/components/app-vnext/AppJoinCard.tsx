"use client";

import Link from "next/link";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";
import { useAppSession } from "@/components/app-vnext/AppSessionProvider";

export default function AppJoinCard({ surface }: { surface: AppSurface }) {
  const { user, loading, isCreator } = useAppSession();

  if (loading) {
    return <div className="h-32 animate-pulse rounded-[1.75rem] border border-white/[.06] bg-white/[.025]" aria-hidden="true" />;
  }

  if (user) {
    return (
      <section className="rounded-[1.75rem] border border-white/[.07] bg-white/[.025] p-5 backdrop-blur-xl sm:p-6">
        <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-brand">Your BVS</p>
        <div className="mt-3 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-2xl font-semibold sm:text-3xl">Pick up where you left off.</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/45">
              {isCreator
                ? "Your music, audience activity and creator tools stay connected to the same identity."
                : "Your likes, follows and listening history stay with you across BVS."}
            </p>
          </div>
          <Link
            href={`/app/${surface}/${isCreator ? "studio" : "library"}`}
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-black transition hover:bg-brand"
          >
            {isCreator ? "Open Studio" : "Open Library"}
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden rounded-[1.9rem] border border-brand/16 bg-gradient-to-br from-brand/[.075] via-white/[.028] to-transparent p-5 sm:p-7">
      <div className="pointer-events-none absolute -right-20 -top-24 h-52 w-52 rounded-full bg-brand/[.08] blur-3xl" />
      <div className="relative">
        <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-brand">One account · every side of BVS</p>
        <h2 className="mt-3 max-w-2xl text-2xl font-semibold sm:text-3xl">Save what you love. Create when you’re ready.</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/46">
          Your BVS identity keeps your music, playlists, follows and creator access together — without forcing you into a creator account before you need one.
        </p>
        <div className="mt-6 flex flex-wrap gap-2.5">
          <Link href={`/app/${surface}/join`} className="inline-flex min-h-11 items-center rounded-full bg-white px-5 text-sm font-semibold text-black transition hover:bg-brand">
            Create account
          </Link>
          <Link
            href={`/app/${surface}/login?next=${encodeURIComponent(`/app/${surface}`)}`}
            className="inline-flex min-h-11 items-center rounded-full border border-white/12 px-5 text-sm font-semibold text-white/72 transition hover:border-white/25 hover:text-white"
          >
            Sign in
          </Link>
        </div>
      </div>
    </section>
  );
}
