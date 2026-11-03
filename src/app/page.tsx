import CreatorPortraitRail from "@/components/home/CreatorPortraitRail";
import { Suspense } from "react";
import Link from "next/link";
import HomeListenPanel from "@/components/HomeListenPanel";
import HomeContinueListening from "@/components/home/HomeContinueListening";
import HomeSignupPrompt from "@/components/home/HomeSignupPrompt";
import HomeTopFive from "@/components/home/HomeTopFive";
import { DeferredHomeBeatRail, DeferredHomeCreatorBands, DeferredHomeEngagementHub, DeferredHomePublicPlaylistRail, DeferredPublishedAlbumsShelf } from "@/components/home/DeferredHomeSections";
import HomeNewThisWeek from "@/components/home/HomeNewThisWeek";
import HomeShowsSection from "@/components/home/HomeShowsSection";

export default function HomePage() {
  return (
    <div className="bvs-square-home relative overflow-hidden bg-bg-primary text-text-primary">
      <HomeSignupPrompt />

      <section className="relative mx-auto max-w-7xl px-4 pb-8 pt-8 sm:px-6 sm:pb-12 sm:pt-12 lg:pt-10">
        <div className="grid gap-x-8 gap-y-7 lg:grid-cols-[minmax(0,1.15fr)_minmax(24rem,.85fr)] lg:items-start">
          <div className="min-w-0 lg:pt-3">
            <div className="flex flex-wrap items-center gap-3 text-[10px] font-semibold uppercase tracking-[.2em] text-white/70 sm:text-xs">
              <span className="border border-brand/70 px-2.5 py-1 text-brand">BVS Radio</span>
              <span>Sound · Culture · Creator Tools</span>
            </div>

            <h1 className="mt-6 max-w-3xl text-balance text-4xl font-black leading-[.98] tracking-[-0.05em] text-white sm:text-5xl lg:text-[4.4rem]">
              Listen closer. Build what comes next.
            </h1>
            <p className="mt-5 max-w-2xl text-pretty text-sm leading-relaxed text-white/72 sm:text-base lg:text-lg">
              Discover sound from everywhere, support independent creators and move from inspiration to your next release in one place.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="#listen" className="inline-flex min-h-11 items-center justify-center bg-brand px-6 py-3 text-sm font-bold text-black transition hover:bg-brand-dark">
                Listen live
              </Link>
              <Link href="/search" className="inline-flex min-h-11 items-center justify-center border border-white/35 px-6 py-3 text-sm font-semibold text-white transition hover:border-white/60 hover:bg-white/5">
                Explore BVS
              </Link>
            </div>
          </div>

          <div className="min-w-0">
            <HomeTopFive />
          </div>

          <article className="overflow-hidden border border-white/15 bg-black shadow-[0_20px_70px_rgba(0,0,0,.3)]">
            <div className="relative aspect-video overflow-hidden bg-black">
              <video
                className="h-full w-full object-cover"
                src="/media/bvs-home-stage-loop.mp4"
                autoPlay
                muted
                loop
                playsInline
                controls
                preload="metadata"
                aria-label="BVS Original"
              />
              <div className="pointer-events-none absolute left-3 top-3 border border-white/15 bg-black/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-[.18em] text-white backdrop-blur-sm sm:left-4 sm:top-4">
                BVS Original
              </div>
            </div>
          </article>

          <div id="listen" className="bvs-culture-listen min-w-0 scroll-mt-24 border border-white/15 bg-black/45 p-2 shadow-[0_20px_70px_rgba(0,0,0,.28)] sm:p-3">
            <HomeListenPanel />
          </div>
        </div>

        <HomeContinueListening />
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
