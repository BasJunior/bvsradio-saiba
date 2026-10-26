import CreatorPortraitRail from "@/components/home/CreatorPortraitRail";
import { Suspense } from "react";
import Link from "next/link";
import HomeListenPanel from "@/components/HomeListenPanel";
import SharedListenButton from "@/components/SharedListenButton";
import HomeContinueListening from "@/components/home/HomeContinueListening";
import HomeMediaStage from "@/components/home/HomeMediaStage";
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
    <div className="bvs-square-home relative overflow-hidden bg-bg-primary text-text-primary">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[42rem] opacity-80"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(circle at 20% 4%, rgba(196,243,67,.09), transparent 30%), radial-gradient(circle at 82% 12%, rgba(193,167,255,.12), transparent 28%)",
        }}
      />

      <section className="relative mx-auto max-w-7xl px-4 pb-8 pt-8 sm:px-6 sm:pb-12 sm:pt-12 lg:pt-14">
        <div className="grid gap-7 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,.85fr)] lg:items-start lg:gap-8">
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

          <div id="listen" className="bvs-culture-listen min-w-0 scroll-mt-24 rounded-[1.75rem] border border-white/10 bg-white/[.025] p-2 shadow-[0_24px_80px_rgba(0,0,0,.28)] backdrop-blur-sm sm:p-3">
            <HomeListenPanel />
          </div>
        </div>

        <HomeContinueListening />

        <div className="mt-8 grid gap-3 sm:mt-10 md:grid-cols-3">
          {paths.map((item) => item.accent === "listen" ? (
            <div
              key={item.eyebrow}
              data-home-accent={item.accent}
              className="bvs-home-accent-card rounded-[1.4rem] border border-white/10 bg-white/[.025] p-5"
            >
              <p className="bvs-home-accent-label text-[10px] font-semibold uppercase tracking-[.18em]">{item.eyebrow}</p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight">{item.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-text-secondary">{item.copy}</p>
              <SharedListenButton idleLabel="Listen now" className="bvs-home-accent-arrow mt-4 text-left text-sm font-semibold" />
            </div>
          ) : (
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

      <DeferredPublishedAlbumsShelf />

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
