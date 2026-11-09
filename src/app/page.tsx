import HomeFeaturedOffer from "@/components/home/HomeFeaturedOffer";
import HomeCreatorOffer from "@/components/home/HomeCreatorOffer";
import CreatorPortraitRail from "@/components/home/CreatorPortraitRail";
import { Suspense } from "react";
import Link from "next/link";
import HomeListenPanel from "@/components/HomeListenPanel";
import HomeContinueListening from "@/components/home/HomeContinueListening";
import HomeSignupPrompt from "@/components/home/HomeSignupPrompt";
import HomeTopFive from "@/components/home/HomeTopFive";
import { DeferredHomeBeatRail, DeferredHomeCreatorBands, DeferredHomePublicPlaylistRail, DeferredPublishedAlbumsShelf } from "@/components/home/DeferredHomeSections";
import HomeShowsSection from "@/components/home/HomeShowsSection";

// HOMEPAGE EDITING GUIDE
// Sections render from top to bottom in the order below. Move a whole section to reorder it.
// Edit text and Link href values here; open a component's file for its internal content.
// Tailwind: p = padding, m = margin, gap = space between items, text = font size/colour.
// sm: and lg: apply styles at wider screen sizes; unprefixed classes also apply on mobile.
// Shared portrait-card styling lives in src/app/creator-bands.css and
// src/components/home/CreatorPortraitRail.tsx. Changes there affect multiple sections.
// Header, footer and persistent player are supplied by src/app/layout.tsx and its components.
export default function HomePage() {
  return (
    <div className="bvs-square-home relative overflow-hidden bg-bg-primary text-text-primary">
      {/* SIGNUP PROMPT — edit its display rules and message in home/HomeSignupPrompt.tsx. */}
      <HomeSignupPrompt />

      {/* HERO / LISTENING AREA — max-w controls width; px, pt and pb control outer spacing. */}
      <section className="relative mx-auto max-w-7xl px-4 pb-4 pt-8 sm:px-6 sm:pb-5 sm:pt-12 lg:pt-10">
        {/* Desktop columns: adjust lg:grid-cols widths here; gap-x / gap-y set card spacing. */}
        <div className="grid gap-x-8 gap-y-7 lg:grid-cols-[minmax(0,1.15fr)_minmax(24rem,.85fr)] lg:items-stretch">
          {/* INTRO — brand label, main heading, description and navigation buttons are edited here. */}
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

          {/* WEEKLY CHART — slides, artwork, playback and rotation: home/HomeTopFive.tsx. */}
          <div className="min-w-0">
            <HomeTopFive />
          </div>

          {/* LEFT COLUMN — video and offers fill the space beside the taller listening room. */}
          <div className="bvs-home-media flex min-w-0 flex-col gap-5">
          {/* BVS ORIGINAL VIDEO — change src to replace the clip in public/media.
              aspect-video sets the frame ratio; object-cover crops the clip to fill it.
              The text below the video element is its overlaid label. */}
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
            {/* RESTORED VIDEO CONTEXT — edit this introduction and the two links here. */}
            <div className="border-t border-white/15 p-5 sm:p-6">
              <h2 className="text-xl font-semibold">BVS for artists</h2>
              <p className="mt-2 text-sm leading-relaxed text-text-secondary">A quick look inside BVS for artists, creators and the people building what comes next.</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link href="/creator/studio" className="inline-flex min-h-11 items-center border border-purple-200/30 px-4 py-2 text-sm font-semibold text-purple-200">Open Creator Studio →</Link>
                <Link href="/search" className="inline-flex min-h-11 items-center px-2 py-2 text-sm text-brand">Discover music →</Link>
              </div>
            </div>
          </article>

            {/* RESTORED OFFERS — stacked below the video to balance the player column.
                Audio packages: home/HomeFeaturedOffer.tsx; creator messages: home/HomeCreatorOffer.tsx.
                Both pause on hover/focus and have manual selection and pause controls. */}
            <div id="home-offers" className="grid flex-1 scroll-mt-28 gap-4">
              <HomeFeaturedOffer />
              <HomeCreatorOffer />
            </div>
          </div>

          {/* LISTENING ROOM — playback controls and track information: components/HomeListenPanel.tsx.
              Keep id="listen" aligned with the Listen live button's href="#listen" above. */}
          <div id="listen" className="bvs-culture-listen min-w-0 scroll-mt-24 border border-white/15 bg-black/45 p-2 shadow-[0_20px_70px_rgba(0,0,0,.28)] sm:p-3">
            <HomeListenPanel />
          </div>
        </div>

        {/* RECENT LISTENING — resume-card content and visibility: home/HomeContinueListening.tsx. */}
        <HomeContinueListening />
      </section>

      {/* ARTISTS → RELEASES → PRODUCERS
          home/HomeCreatorBands.tsx renders Artists, then this child, then Producers.
          Edit creator cards and the producer limit in that file.
          Deferred wrappers load near the viewport; their timing/placeholders are in
          home/DeferredHomeSections.tsx. Keep Releases nested here to preserve this order. */}
      <DeferredHomeCreatorBands>
        {/* RELEASES — title, card fields and fetch limit: components/PublishedAlbumsShelf.tsx. */}
        <DeferredPublishedAlbumsShelf />
      </DeferredHomeCreatorBands>

      {/* BEATSTORE — homepage cards and fetch limit: components/flow/HomeBeatRail.tsx.
          The full catalogue grid is separate: src/app/catalogue/page.tsx. */}
      <DeferredHomeBeatRail />

      {/* PLAYLISTS — title, ordering and fetch limit: home/HomePublicPlaylistRail.tsx. */}
      <DeferredHomePublicPlaylistRail />

      {/* SHOWS — card fields and heading: home/HomeShowsSection.tsx.
          Suspense reserves space while server content loads; min-h sets placeholder height. */}
      <Suspense fallback={<div className="min-h-[34rem] border-y border-white/10 bg-bg-secondary/65" aria-hidden="true" />}>
        <HomeShowsSection />
      </Suspense>

      {/* MARKETPLACE — edit the cards directly in items below.
          name = title, image = artwork, href = destination, detail = supporting text.
          title/kicker set section headings; allHref sets See all; tone sets its background. */}
      <CreatorPortraitRail data-home-accent="marketplace" title="Marketplace" kicker="The people and services behind your next record" tone="charcoal" allHref="/marketplace" items={[
        { id: "services", name: "Creator services", image: "/images/editorial/audio-engineering-work.webp", href: "/marketplace", detail: "Explore production, recording, mixing and mastering" },
        { id: "studio", name: "BVS Studio services", image: "/images/hero-studio.jpg", href: "/shop", detail: "Explore official BVS audio services" },
      ]} />

      {/* BVS COMMUNITY — the closing introduction connects listening with creating.
          Edit the headline/copy here. The two cards link to existing listener and creator tools.
          md:grid-cols-2 places cards side by side; p and gap control their spacing. */}
      <section aria-labelledby="home-community-title" className="border-t border-white/20 bg-[#141414] px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-6 lg:grid-cols-[1fr_.7fr] lg:items-end lg:gap-16">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.2em] text-brand">Best Virtual Sound · Independent music</p>
              <h2 id="home-community-title" className="mt-4 max-w-3xl text-balance text-3xl font-bold leading-tight tracking-tight sm:text-5xl">Independent sound. A place to belong.</h2>
            </div>
            <p className="max-w-xl text-base leading-relaxed text-white/70">
              BVS Radio brings music, people and ideas together. Listen to the station, discover independent artists, and meet the producers and creators behind your next favourite.
            </p>
          </div>

          {/* LISTENER / CREATOR PATHS — each whole card is one link with a descriptive destination. */}
          <div className="mt-9 grid gap-4 md:grid-cols-2">
            <Link href="/library" className="group flex flex-col border border-white/20 bg-white/[.03] p-6 transition-colors hover:border-brand/60 hover:bg-brand/[.05] sm:p-8">
              <span className="text-[11px] font-semibold uppercase tracking-[.18em] text-brand">For the listeners</span>
              <h3 className="mt-3 text-2xl font-semibold tracking-tight">Keep what moves you.</h3>
              <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/65">Save the songs you find, build your own playlists and follow the artists you want to hear more from.</p>
              <span className="mt-6 inline-flex min-h-11 items-center gap-3 text-sm font-semibold text-brand">Open your Library <span aria-hidden="true">→</span></span>
            </Link>
            <Link href="/creator/studio" className="group flex flex-col border border-white/20 bg-white/[.03] p-6 transition-colors hover:border-[#c1a7ff]/60 hover:bg-[#c1a7ff]/[.05] sm:p-8">
              <span className="text-[11px] font-semibold uppercase tracking-[.18em] text-[#c1a7ff]">For the creators</span>
              <h3 className="mt-3 text-2xl font-semibold tracking-tight">Bring your sound to BVS.</h3>
              <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/65">Submit music, build a beat catalogue and follow your releases from one workspace.</p>
              <span className="mt-6 inline-flex min-h-11 items-center gap-3 text-sm font-semibold text-[#c1a7ff]">Explore Creator Studio <span aria-hidden="true">→</span></span>
            </Link>
          </div>

          {/* JOIN — a single signup invitation; About explains the platform before joining. */}
          <div className="mt-8 flex flex-col gap-5 border-t border-white/15 pt-7 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold">Make yourself at home.</h3>
              <p className="mt-1 text-sm text-white/65">Join free to save music, follow creators and start building your BVS collection.</p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-3">
              <Link href="/auth/signup" className="inline-flex min-h-11 items-center justify-center bg-brand px-6 py-3 text-sm font-bold text-black transition hover:bg-brand-dark">Join BVS free</Link>
              <Link href="/about" className="inline-flex min-h-11 items-center px-3 py-3 text-sm font-semibold text-white/80 hover:text-white">Our story <span aria-hidden="true" className="ml-2">↗</span></Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
