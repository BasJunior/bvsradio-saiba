/* eslint-disable @next/next/no-img-element -- tile images include signed media covers */
import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import CreatorPortraitRail from "@/components/home/CreatorPortraitRail";
import HomeMediaStage from "@/components/home/HomeMediaStage";
import AppJoinCard from "@/components/app-vnext/AppJoinCard";
import AppHomeStationCard from "@/components/app-vnext/AppHomeStationCard";
import AppHomeDiscoverySections from "@/components/app-vnext/AppHomeDiscoverySections";
import HomeContinueListening from "@/components/home/HomeContinueListening";
import HomeFeaturedOffer from "@/components/home/HomeFeaturedOffer";
import HomeCreatorOffer from "@/components/home/HomeCreatorOffer";
import IosHomeListenPanel from "@/components/app/IosHomeListenPanel";
import { DeferredHomeBeatRail, DeferredHomeCreatorBands, DeferredHomePublicPlaylistRail, DeferredPublishedAlbumsShelf } from "@/components/home/DeferredHomeSections";
import type { MobileSurface } from "@/lib/station-library";
import { LibIcon, type LibIconName } from "@/components/app-vnext/LibraryVisuals";
import AppHomeTopFive from "@/components/app-vnext/AppHomeTopFive";
import { readTrending } from "@/lib/trending-server";

function HomeQuickLink({ href, icon, rgb, label, note, image }: { href: string; icon: LibIconName; rgb: string; label: string; note: string; image?: string | null }) {
  return (
    <Link href={href} className="bvs-app-card flex items-center gap-3 p-2.5">
      <span aria-hidden="true" className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden" style={{ background: `rgb(${rgb} / .14)`, color: `rgb(${rgb})` }}>
        {image ? <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" /> : null}
        {image ? <span className="absolute bottom-0.5 right-0.5 grid h-5 w-5 place-items-center bg-black/70" style={{ color: `rgb(${rgb})` }}><LibIcon name={icon} size={12} /></span> : <LibIcon name={icon} size={20} />}
      </span>
      <span className="min-w-0"><span className="block truncate text-sm font-semibold">{label}</span><span className="block truncate text-xs text-white/45">{note}</span></span>
    </Link>
  );
}

async function topTrendingArtwork() {
  try {
    const board = await Promise.race([readTrending("week"), new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500))]);
    return board?.entries.find((entry) => entry.artwork)?.artwork || null;
  } catch {
    return null;
  }
}

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "BVS — Best Virtual Sound",
  description: "Music moves differently here. Listen, discover and create across BVS.",
};

function HomeDiscoveryFallback() {
  return (
    <div className="mt-11 space-y-10" aria-label="Loading BVS discovery">
      <section>
        <div className="h-7 w-48 animate-pulse rounded-full bg-white/[.05]" />
        <div className="mt-5 flex gap-4 overflow-hidden">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="aspect-[.82] w-40 shrink-0 animate-pulse bg-white/[.035]" />
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
  const story = (
      <HomeMediaStage
        eyebrow="BVS Original"
        title="BVS for artists"
        description="A quick look inside BVS for artists, creators and the people building what comes next."
        src="/media/bvs-home-stage-loop.mp4"
        actions={[
          { href: `${base}/studio`, label: "Open Creator Studio", accent: "studio" },
          { href: `${base}/explore`, label: "Discover music", accent: "discover" },
        ]}
      />
  );

  if (surface === "ios") {
    const trendingArt = await topTrendingArtwork();
    return (
      <div className="bvs-square-home bvs-app-page bvs-app-home mx-auto max-w-6xl pb-12" data-app-accent="lime">
        <section className="relative px-4 pb-2 pt-5 sm:px-6 sm:pt-8" aria-labelledby="ios-home-title">
          <header className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="bvs-app-eyebrow">BVS Radio · Zimbabwe to the world</p>
              <h1 id="ios-home-title" className="mt-1 text-[2.4rem] font-bold leading-none tracking-tight sm:text-6xl">Listen now</h1>
            </div>
            <Link href={`${base}/feed`} aria-label="BVS Feed" className="bvs-app-icon-button border border-white/15"><LibIcon name="chat" /></Link>
          </header>
          <p className="mt-2 max-w-xl text-sm text-white/50">Independent sound, the people behind it, and the tools to make your own.</p>

          <nav className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4" aria-label="Jump to">
            <HomeQuickLink href="#listen" icon="radio" rgb="193 255 82" label="Live radio" note="On air now" image="/images/editorial/radio-studio-harare.webp" />
            <HomeQuickLink href={`${base}/explore`} icon="sparkle" rgb="163 219 255" label="Discover" note="New for you" image="/images/editorial/music-discovery-show.webp" />
            <HomeQuickLink href={`${base}/trending`} icon="trending" rgb="255 210 92" label="Trending" note="BVS Top 20" image={trendingArt || "/images/editorial/audio-engineering-work.webp"} />
            <HomeQuickLink href={`${base}/studio`} icon="mic" rgb="193 167 255" label="Studio" note="Create and release" image="/images/hero-studio.jpg" />
          </nav>

          <AppHomeTopFive surface={surface} />

          <section id="listen" className="bvs-app-shelf bvs-culture-listen scroll-mt-24" aria-labelledby="ios-listening-room-title">
            <div className="flex items-center justify-between gap-3">
              <h2 id="ios-listening-room-title" className="bvs-app-shelf-title">On air now</h2>
              <Link href={`${base}/radio`} className="inline-flex min-h-9 shrink-0 items-center gap-0.5 px-2 text-[13px] font-semibold text-brand">BVS Radio<LibIcon name="chevron" size={15} /></Link>
            </div>
            <div className="mt-3"><IosHomeListenPanel /></div>
          </section>

          <HomeContinueListening />

          <section className="bvs-app-shelf" aria-labelledby="ios-home-from-bvs">
            <h2 id="ios-home-from-bvs" className="bvs-app-shelf-title">From BVS</h2>
            <div className="mt-3 grid gap-4 lg:grid-cols-2">
              <div className="bvs-home-media">{story}</div>
              <div id="home-offers" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                <HomeFeaturedOffer surface={surface} />
                <HomeCreatorOffer surface={surface} />
              </div>
            </div>
          </section>
        </section>

        <DeferredHomeCreatorBands surface={surface}>
          <DeferredPublishedAlbumsShelf surface={surface} />
        </DeferredHomeCreatorBands>
        <DeferredHomeBeatRail surface={surface} />
        <DeferredHomePublicPlaylistRail surface={surface} />
        <Suspense fallback={<div className="min-h-[20rem] border-y border-white/10 bg-white/[.02]" aria-hidden="true" />}>
          <AppHomeDiscoverySections surface={surface} includeCreators={false} />
        </Suspense>

        <CreatorPortraitRail data-home-accent="marketplace" title="Marketplace" kicker="The people and services behind your next record" tone="charcoal" allHref={`${base}/marketplace`} items={[
          { id: "services", name: "Creator services", image: "/images/editorial/audio-engineering-work.webp", href: `${base}/marketplace`, detail: "Explore production, recording, mixing and mastering" },
          { id: "studio", name: "BVS Studio services", image: "/images/hero-studio.jpg", href: `${base}/marketplace?provider=bvs-studio-services`, detail: "Explore official BVS audio services" },
        ]} />

        <section aria-labelledby="ios-home-community-title" className="border-t border-white/15 bg-[#141414] px-4 py-10 sm:px-6 sm:py-14">
          <div className="mx-auto max-w-6xl">
            <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-brand">Best Virtual Sound · Rooted in Zimbabwe</p>
            <h2 id="ios-home-community-title" className="mt-3 max-w-3xl text-balance text-3xl font-bold leading-tight tracking-tight sm:text-4xl">Independent sound. A place to belong.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/65 sm:text-base">BVS Radio brings music, people and ideas together. Listen to the station, discover independent artists, and meet the producers and creators behind your next favourite.</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Link href={`${base}/library`} className="group border border-white/15 bg-white/[.025] p-5 transition hover:border-brand/50">
                <span className="text-[10px] font-semibold uppercase tracking-[.18em] text-brand">For the listeners</span>
                <h3 className="mt-2 text-xl font-semibold">Keep what moves you.</h3>
                <p className="mt-2 text-sm leading-5 text-white/60">Save the songs you find, build your own playlists and follow the artists you want to hear more from.</p>
                <span className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-brand">Open your Library <span aria-hidden="true" className="ml-2">→</span></span>
              </Link>
              <Link href={`${base}/studio`} className="group border border-white/15 bg-white/[.025] p-5 transition hover:border-purple-200/50">
                <span className="text-[10px] font-semibold uppercase tracking-[.18em] text-purple-200">For the creators</span>
                <h3 className="mt-2 text-xl font-semibold">Bring your sound to BVS.</h3>
                <p className="mt-2 text-sm leading-5 text-white/60">Submit music, build a beat catalogue and follow your releases from one workspace.</p>
                <span className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-purple-200">Explore Creator Studio <span aria-hidden="true" className="ml-2">→</span></span>
              </Link>
            </div>
            <div className="mt-6 flex flex-col gap-4 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div><h3 className="text-lg font-semibold">Make yourself at home.</h3><p className="mt-1 text-sm text-white/60">Join free to save music, follow creators and start building your BVS collection.</p></div>
              <Link href={`${base}/join`} className="inline-flex min-h-11 items-center justify-center rounded-sm bg-brand px-5 text-sm font-bold text-black">Join BVS free</Link>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="bvs-square-home mx-auto max-w-6xl px-4 pb-12 pt-5 sm:px-6 sm:pt-8">
      {story}

      <div className="mt-5"><AppHomeStationCard surface={surface} /></div>

      <HomeContinueListening />

      <Link
        href={`${base}/feed`}
        data-home-accent="feed" className="bvs-home-accent-card bvs-app-feed-entry group mt-5 flex items-center justify-between gap-5 overflow-hidden rounded-[1.55rem] border border-white/[.07] bg-white/[.022] px-5 py-4"
      >
        <div className="min-w-0">
          <div className="bvs-home-accent-label flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.2em]">
            <span className="h-2 w-2 rounded-full bg-brand shadow-[0_0_16px_rgba(212,175,55,.7)]" aria-hidden="true" />
            BVS Feed
          </div>
          <p className="mt-2 text-base font-semibold text-white">Feel what’s moving across BVS.</p>
          <p className="mt-1 text-xs leading-5 text-white/42">New music, creators, BeatStore drops, live moments and Marketplace activity.</p>
        </div>
        <span className="bvs-home-accent-arrow shrink-0 text-2xl transition-transform group-hover:translate-x-1" aria-hidden="true">→</span>
      </Link>

      {surface === "android" ? <div className="mt-5">
        <AppJoinCard surface={surface} />
      </div> : null}

      <Suspense fallback={<HomeDiscoveryFallback />}>
        <AppHomeDiscoverySections surface={surface} />
      </Suspense>

      <div className="bvs-app-creator-bands">
        <CreatorPortraitRail title="Your BVS" kicker="Keep listening, collecting and creating" tone="charcoal" allHref={`${base}/library`} items={[
          { id: "library", name: "Your Library", image: "/images/editorial/music-discovery-show.webp", href: `${base}/library`, detail: "Likes, playlists, follows, history and offline music" },
          { id: "studio", accent: "studio", name: "Creator Studio", image: "/images/editorial/radio-studio-harare.webp", href: `${base}/studio`, detail: "Create, submit, follow review and publish" },
          { id: "marketplace", accent: "marketplace", name: "Marketplace", image: "/images/editorial/audio-engineering-work.webp", href: `${base}/marketplace`, detail: "Studios, production and creative services" },
        ]} />
      </div>
    </div>
  );
}
