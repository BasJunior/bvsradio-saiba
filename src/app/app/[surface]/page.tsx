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
import type { MobileSurface } from "@/lib/station-library";

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

  return (
    <div className="bvs-square-home mx-auto max-w-6xl px-4 pb-12 pt-5 sm:px-6 sm:pt-8">
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

      <div className="mt-5">
        <AppHomeStationCard />
      </div>

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

      <div className="mt-5">
        <AppJoinCard surface={surface} />
      </div>

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
