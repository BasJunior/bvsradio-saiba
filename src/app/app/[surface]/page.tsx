import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import AppJoinCard from "@/components/app-vnext/AppJoinCard";
import AppHomeStationCard from "@/components/app-vnext/AppHomeStationCard";
import AppHomeDiscoverySections from "@/components/app-vnext/AppHomeDiscoverySections";
import type { MobileSurface } from "@/lib/station-library";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "BVS — Best Virtual Sound",
  description: "Listen, discover and create across BVS.",
};

function HomeDiscoveryFallback() {
  return (
    <div className="mt-11 space-y-10" aria-label="Loading BVS discovery">
      <section>
        <div className="h-7 w-48 animate-pulse rounded-full bg-white/[.05]" />
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="aspect-[.82] animate-pulse rounded-[1.4rem] bg-white/[.035]" />
          ))}
        </div>
      </section>
    </div>
  );
}

export default async function MobileAppPage({ params }: { params: Promise<{ surface: string }> }) {
  const raw = (await params).surface;
  if (raw !== "ios" && raw !== "android") notFound();
  const surface = raw as MobileSurface;
  const base = `/app/${surface}`;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-12 pt-5 sm:px-6 sm:pt-8">
      <section className="bvs-app-home-hero relative isolate overflow-hidden rounded-[2.2rem] border border-white/[.08] bg-[#111113]/72 px-5 py-7 shadow-[0_28px_90px_rgba(0,0,0,.35)] backdrop-blur-2xl [clip-path:inset(0_round_2.2rem)] [contain:paint] sm:px-9 sm:py-10">
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]" aria-hidden="true">
          <div className="absolute -right-24 -top-32 h-80 w-80 rounded-full bg-brand/[.13] blur-3xl" />
          <div className="absolute -bottom-24 left-[18%] h-56 w-56 rounded-full bg-indigo-500/[.07] blur-3xl" />
        </div>
        <div className="relative z-[1]">
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[.22em]">
            <span className="text-brand">Best Virtual Sound</span>
            <span className="text-white/22">•</span>
            <span className="text-white/45">Built in Zimbabwe · Open to the world</span>
          </div>

          <h1 className="mt-5 max-w-4xl text-[2.8rem] font-semibold leading-[.98] tracking-[-.05em] sm:text-7xl">
            Music moves differently here.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/58 sm:text-lg">
            Listen to what’s next, follow the people behind it, and build your own path. BVS brings music, creators, live experiences and creative tools into one modern ecosystem.
          </p>

          <div className="mt-7 flex flex-wrap gap-2.5">
            <a href="#listen" className="inline-flex min-h-11 items-center rounded-full bg-white px-5 text-sm font-semibold text-black transition hover:bg-brand">
              Listen now
            </a>
            <Link href={`${base}/explore`} className="inline-flex min-h-11 items-center rounded-full border border-white/12 bg-white/[.035] px-5 text-sm font-semibold text-white/82 transition hover:border-brand/35 hover:text-white">
              Discover music
            </Link>
          </div>

          <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/42">
            <span><strong className="font-semibold text-white/76">Live</strong> BVS rotation ready</span>
            <span>One identity from listener to creator</span>
            <span>Offline-ready where rights allow</span>
          </div>
        </div>
      </section>

      <div className="mt-5">
        <AppHomeStationCard />
      </div>

      <Link
        href={`${base}/feed`}
        className="bvs-app-feed-entry group mt-5 flex items-center justify-between gap-5 overflow-hidden rounded-[1.55rem] border border-brand/15 bg-gradient-to-r from-brand/[.075] via-white/[.025] to-white/[.015] px-5 py-4 transition hover:border-brand/30 hover:bg-brand/[.085]"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.2em] text-brand">
            <span className="h-2 w-2 rounded-full bg-brand shadow-[0_0_16px_rgba(212,175,55,.7)]" aria-hidden="true" />
            BVS Feed
          </div>
          <p className="mt-2 text-base font-semibold text-white">Feel what’s moving across BVS.</p>
          <p className="mt-1 text-xs leading-5 text-white/42">New music, creators, BeatStore drops, live moments and Marketplace activity.</p>
        </div>
        <span className="shrink-0 text-2xl text-brand transition-transform group-hover:translate-x-1" aria-hidden="true">→</span>
      </Link>

      <div className="mt-5">
        <AppJoinCard surface={surface} />
      </div>

      <Suspense fallback={<HomeDiscoveryFallback />}>
        <AppHomeDiscoverySections surface={surface} />
      </Suspense>

      <section className="mt-12 grid gap-3 sm:grid-cols-3">
        <Link href={`${base}/library`} className="group rounded-[1.65rem] border border-white/[.07] bg-white/[.025] p-5 transition hover:border-white/15 hover:bg-white/[.04]">
          <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-brand">Library</p>
          <h2 className="mt-3 text-2xl font-semibold">Everything you want to come back to.</h2>
          <p className="mt-3 text-sm leading-6 text-white/42">Likes, playlists, follows, history and offline music in one place.</p>
          <span className="mt-5 inline-block text-sm font-semibold text-white/64 group-hover:text-brand">Open Library →</span>
        </Link>
        <Link href={`${base}/studio`} className="group rounded-[1.65rem] border border-brand/18 bg-brand/[.045] p-5 transition hover:border-brand/30 hover:bg-brand/[.07]">
          <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-brand">Studio</p>
          <h2 className="mt-3 text-2xl font-semibold">From listening to releasing.</h2>
          <p className="mt-3 text-sm leading-6 text-white/42">Create, submit, follow review, publish and understand what happens next.</p>
          <span className="mt-5 inline-block text-sm font-semibold text-brand">Enter Studio →</span>
        </Link>
        <Link href={`${base}/marketplace`} className="group rounded-[1.65rem] border border-white/[.07] bg-white/[.025] p-5 transition hover:border-white/15 hover:bg-white/[.04]">
          <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-brand">Marketplace</p>
          <h2 className="mt-3 text-2xl font-semibold">Find the people who move your work forward.</h2>
          <p className="mt-3 text-sm leading-6 text-white/42">Studios, production and creative services, connected to the same ecosystem.</p>
          <span className="mt-5 inline-block text-sm font-semibold text-white/64 group-hover:text-brand">Browse Marketplace →</span>
        </Link>
      </section>
    </div>
  );
}
