import HomeFeaturedOffer from "@/components/home/HomeFeaturedOffer";
import HomeCreatorOffer from "@/components/home/HomeCreatorOffer";
import CreatorPortraitRail from "@/components/home/CreatorPortraitRail";
import { Suspense } from "react";
import Link from "next/link";
import HomeListenPanel from "@/components/HomeListenPanel";
import HomeTopFive from "@/components/home/HomeTopFive";
import HomePathways from "@/components/home/HomePathways";
import HomeNewThisWeek from "@/components/home/HomeNewThisWeek";
import HomeContinueListening from "@/components/home/HomeContinueListening";
import HomeMediaStage from "@/components/home/HomeMediaStage";
import HomeSignupPrompt from "@/components/home/HomeSignupPrompt";
import { DeferredHomeBeatRail, DeferredHomeCreatorBands, DeferredHomeEngagementHub, DeferredHomePublicPlaylistRail, DeferredPublishedAlbumsShelf } from "@/components/home/DeferredHomeSections";
import HomeShowsSection from "@/components/home/HomeShowsSection";

export default function HomePage() {
  return (
    <div className="bvs-square-home relative overflow-hidden bg-[#111315] text-text-primary">
      <HomeSignupPrompt />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[42rem] opacity-80"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(circle at 20% 4%, rgba(196,243,67,.09), transparent 30%), radial-gradient(circle at 82% 12%, rgba(193,167,255,.12), transparent 28%)",
        }}
      />

      <section aria-labelledby="home-title" className="relative mx-auto max-w-7xl px-4 pb-8 pt-7 sm:px-6 sm:pb-12 sm:pt-12">
        <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,.85fr)] lg:gap-8">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-3 text-[10px] font-semibold uppercase tracking-[.2em] text-text-secondary">
              <span className="rounded-full border border-brand/30 bg-brand/[.07] px-3 py-1 text-brand">BVS Radio</span>
              <span>Sound · culture · creator tools</span>
            </div>
            <h1 id="home-title" className="mt-4 max-w-3xl text-balance text-4xl font-semibold tracking-[-.045em] sm:text-5xl lg:text-[4.25rem]">
              Listen closer. Build what comes next.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-text-secondary sm:text-lg">
              Discover sound from everywhere, support independent creators and move from inspiration to your next release in one place.
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <Link href="/radio" className="inline-flex min-h-11 items-center rounded-full bg-brand px-5 font-semibold text-black shadow-[0_12px_30px_rgba(196,243,67,.16)]">
                Listen live
              </Link>
              <Link href="/search" className="inline-flex min-h-11 items-center rounded-full border border-white/15 bg-white/[.04] px-5 font-semibold hover:border-white/30 hover:bg-white/[.07]">
                Explore BVS
              </Link>
            </div>
          </div>
          <HomeTopFive />
        </div>

        <div className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,.85fr)] lg:gap-6">
          <HomeMediaStage
            eyebrow="BVS Original"
            title="BVS for artists"
            description="A quick look inside BVS for artists, creators and the people building what comes next."
            src="/media/bvs-home-stage-loop.mp4"
            actions={[
              { href: "/creator/studio", label: "Open Creator Studio", accent: "studio" },
              { href: "/search", label: "Discover music", accent: "discover" },
            ]}
          />
          <div className="grid min-w-0 gap-4 lg:self-start">
            <div id="listen" className="bvs-culture-listen scroll-mt-24 rounded-[1.75rem] border border-white/15 bg-white/[.045] p-2 shadow-[0_24px_80px_rgba(0,0,0,.24)] backdrop-blur-sm sm:p-3">
              <HomeListenPanel />
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <HomeFeaturedOffer />
          <HomeCreatorOffer />
        </div>

        <HomeContinueListening />

        <HomePathways />

      </section>

      <DeferredHomeCreatorBands />

      <DeferredPublishedAlbumsShelf />

      <HomeNewThisWeek />

      <DeferredHomeEngagementHub />

      <DeferredHomeBeatRail />

      <DeferredHomePublicPlaylistRail />

      <Suspense fallback={<div className="min-h-[34rem] border-y border-white/10 bg-bg-secondary/65" aria-hidden="true" />}>
        <HomeShowsSection />
      </Suspense>

      <CreatorPortraitRail data-home-accent="marketplace" title="Marketplace" kicker="The people and services behind your next record" tone="charcoal" allHref="/marketplace" items={[
        { id: "services", name: "Creator services", image: "/images/editorial/audio-engineering-work.webp", href: "/marketplace", detail: "Explore production, recording, mixing and mastering" },
        { id: "studio", name: "BVS Studio services", image: "/images/hero-studio.jpg", href: "/shop", detail: "Explore official BVS audio services" },
      ]} />

      <CreatorPortraitRail title="Creator Studio" kicker="From first upload to what comes next" tone="ink" accent="purple" allHref="/creator/studio" items={[
        { id: "workspace", name: "Your workspace", image: "/images/editorial/radio-studio-harare.webp", href: "/creator/studio", detail: "Follow review, release progress, performance and money" },
        { id: "release", name: "Submit music", image: "/images/musicians.jpg", href: "/upload", detail: "Your first BVS release does not require Premium" },
        { id: "beat", name: "Submit a beat", image: "/images/editorial/audio-engineering-work.webp", href: "/creator/studio/create/beat", detail: "Build your producer catalogue" },
      ]} />

      <section className="bvs-home-join-band border-t border-white/10 px-4 py-10 text-center sm:px-6 sm:py-16">
        <p className="text-xs font-semibold uppercase tracking-[.2em] text-brand">Built in Zimbabwe · Open to the world</p>
        <h2 className="mx-auto mt-3 max-w-2xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">Join BVS</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-text-secondary sm:text-base">
          Join free to save music, follow creators and keep your BVS listening experience with you.
        </p>
        <div className="mt-6 flex flex-col items-stretch justify-center gap-2.5 sm:flex-row sm:items-center">
          <Link href="/auth/signup" className="rounded-full bg-brand px-7 py-3 font-semibold text-black">Join BVS free</Link>
          <Link href="/about" className="rounded-full border border-white/20 px-7 py-3 font-semibold">About BVS</Link>
        </div>
      </section>
    </div>
  );
}
