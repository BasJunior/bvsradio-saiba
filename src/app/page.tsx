import BvsStar from "@/components/branding/BvsStar";
import Image from "next/image";
import { Suspense } from "react";
import Link from "next/link";
import HomeListenPanel from "@/components/HomeListenPanel";
import HomeContinueListening from "@/components/home/HomeContinueListening";
import { DeferredHomeBeatRail, DeferredHomeCreatorBands, DeferredHomeEngagementHub, DeferredHomePublicPlaylistRail, DeferredPublishedAlbumsShelf } from "@/components/home/DeferredHomeSections";
import HomeShowsSection from "@/components/home/HomeShowsSection";

const paths = [
  {
    eyebrow: "Listen",
    title: "Start with the sound",
    copy: "Drop into the live rotation and keep listening while you move through BVS.",
    href: "/radio",
    cta: "Listen now",
    accent: "listen",
  },
  {
    eyebrow: "Discover",
    title: "Find what is moving next",
    copy: "Explore artists, releases, playlists, beats and the people connected to the music.",
    href: "/search",
    cta: "Discover BVS",
    accent: "discover",
  },
  {
    eyebrow: "Create",
    title: "Take your music further",
    copy: "Submit a track, follow its review path and build from the same creator workspace.",
    href: "/creator/studio",
    cta: "Open Studio",
    accent: "studio",
  },
];

export default function HomePage() {
  return (
    <div className="relative overflow-hidden bg-bg-primary text-text-primary">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[42rem] opacity-80"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(circle at 20% 4%, rgba(196,243,67,.09), transparent 30%), radial-gradient(circle at 82% 12%, rgba(193,167,255,.12), transparent 28%)",
        }}
      />

      <section className="relative mx-auto max-w-7xl px-4 pb-8 pt-8 sm:px-6 sm:pb-12 sm:pt-12 lg:pt-14">
        <div className="grid gap-7 lg:grid-cols-[minmax(0,.88fr)_minmax(0,1.12fr)] lg:items-center lg:gap-10">
          <div className="min-w-0 lg:pr-4">
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[.18em] text-brand sm:text-xs">
              <span>Best Virtual Sound</span>
              <span className="h-px w-7 bg-brand/50" aria-hidden="true" />
              <span className="text-text-secondary">Built in Zimbabwe · Open to the world</span>
            </div>

            <div className="bvs-culture-sticker mt-5"><BvsStar /> Your next obsession</div>
            <h1 className="bvs-poster-title mt-5 max-w-3xl text-balance text-4xl font-semibold leading-[1.03] tracking-[-0.04em] sm:text-5xl lg:text-[3.65rem]">
              Music moves differently here.
            </h1>
            <p className="mt-4 max-w-xl text-pretty text-base leading-relaxed text-text-secondary sm:text-lg">
              New sounds. Real people. Your next favourite. Tap into the rotation, discover artists and make your own noise.
            </p>

            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
              <Link href="#listen" className="rounded-full bg-brand px-6 py-3 text-center text-sm font-semibold text-black shadow-[0_14px_38px_rgba(212,175,55,.20)] hover:bg-brand-dark">
                Start listening
              </Link>
              <Link href="/search" data-home-accent="discover" className="bvs-home-accent-button rounded-full border px-6 py-3 text-center text-sm font-semibold backdrop-blur-sm">
                Discover music
              </Link>
              <Link href="/creator/studio" data-home-accent="studio" className="bvs-home-accent-button rounded-full border px-5 py-3 text-center text-sm font-semibold">
                Creator Studio →
              </Link>
            </div>
          </div>

          <div id="listen" className="bvs-culture-listen min-w-0 scroll-mt-24 rounded-[1.75rem] border border-white/10 bg-white/[.025] p-2 shadow-[0_24px_80px_rgba(0,0,0,.28)] backdrop-blur-sm sm:p-3">
            <HomeListenPanel />
          </div>
        </div>

        <HomeContinueListening />

        <div className="mt-8 grid gap-3 sm:mt-10 md:grid-cols-3">
          {paths.map((item) => (
            <Link
              key={item.eyebrow}
              href={item.href}
              data-home-accent={item.accent}
              className="bvs-home-accent-card group rounded-[1.4rem] border border-white/10 bg-white/[.025] p-5 hover:-translate-y-0.5"
            >
              <p className="bvs-home-accent-label text-[10px] font-semibold uppercase tracking-[.18em]">{item.eyebrow}</p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight">{item.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-text-secondary">{item.copy}</p>
              <p className="bvs-home-accent-arrow mt-4 text-sm font-semibold">{item.cta} →</p>
            </Link>
          ))}
        </div>
      </section>

      <DeferredHomeCreatorBands />

      <section data-home-accent="discover" className="bvs-home-release-band relative" aria-label="Discover BVS music"><div>
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-3xl">
            <p className="bvs-home-accent-label text-xs font-semibold uppercase tracking-[.2em]">Discover</p>
            <h2 className="mt-2 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">Find your next favourite before everyone else does.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-secondary sm:text-base">
              Move from a song to the artist, release and wider BVS catalogue without breaking the listening flow.
            </p>
          </div>
          <Link href="/search" data-home-accent="discover" className="bvs-home-accent-button rounded-full border px-4 py-2 text-sm font-semibold">Explore everything →</Link>
        </div>
        <div className="mt-8 sm:mt-10"><DeferredPublishedAlbumsShelf /></div>
      </div></section>

      <DeferredHomeEngagementHub />

      <DeferredHomeBeatRail />

      <DeferredHomePublicPlaylistRail />

      <Suspense fallback={<div className="min-h-[34rem] border-y border-white/10 bg-bg-secondary/65" aria-hidden="true" />}>
        <HomeShowsSection />
      </Suspense>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-16">
        <div className="grid gap-4 lg:grid-cols-2">
          <div data-home-accent="marketplace" className="relative overflow-hidden rounded-[1.65rem] border border-white/10 bg-white/[.03] p-6 sm:p-8">
            <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#91af85]/10 blur-3xl" aria-hidden="true" />
            <p className="bvs-home-accent-label text-xs font-semibold uppercase tracking-[.2em]">Marketplace</p>
            <h2 className="mt-2 max-w-xl text-balance text-3xl font-semibold tracking-tight">Find the people and services that move a record forward.</h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-text-secondary sm:text-base">
              Browse real creator services and availability when you need production, recording, mixing, mastering or other specialist help.
            </p>
            <Link href="/marketplace" className="bvs-home-accent-button mt-6 inline-flex rounded-full border px-5 py-2.5 text-sm font-semibold">
              Explore Marketplace →
            </Link>
          </div>

          <div className="grid overflow-hidden rounded-[1.65rem] border border-white/10 bg-bg-card/45 sm:grid-cols-[12rem_1fr]">
            <div className="relative min-h-48 sm:min-h-full">
              <Image src="/images/editorial/audio-engineering-work.webp" alt="Audio engineer working at a mixing console" fill className="object-cover" />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/15" />
            </div>
            <div data-home-accent="studio" className="p-6 sm:p-7">
              <p className="bvs-home-accent-label text-xs font-semibold uppercase tracking-[.2em]">Creator Studio</p>
              <h2 className="mt-2 text-balance text-2xl font-semibold tracking-tight sm:text-3xl">From first upload to what comes next.</h2>
              <p className="mt-3 text-sm leading-relaxed text-text-secondary">
                Submit music, follow review and release progress, then see performance and money from one creator workspace. Your first BVS release does not require Premium.
              </p>
              <div className="mt-5 flex flex-wrap gap-2.5">
                <Link href="/creator/studio" className="bvs-home-accent-button rounded-full border px-5 py-2.5 text-sm font-semibold">Open Studio</Link>
                <Link href="/upload" className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold">Submit music</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 px-4 py-10 text-center sm:px-6 sm:py-16">
        <p className="text-xs font-semibold uppercase tracking-[.2em] text-brand">Built in Zimbabwe · Open to the world</p>
        <h2 className="mx-auto mt-3 max-w-2xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">Listen now. Find something worth coming back for.</h2>
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
