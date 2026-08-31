import Image from "next/image";
import Link from "next/link";
import HomeListenPanel from "@/components/HomeListenPanel";
import PublishedArtistsShelf from "@/components/PublishedArtistsShelf";
import PublishedAlbumsShelf from "@/components/PublishedAlbumsShelf";
import HomeBeatRail from "@/components/flow/HomeBeatRail";
import BvsPulse from "@/components/flow/BvsPulse";
import BvsIntentRail from "@/components/home/BvsIntentRail";
import MarketplaceSpotlight from "@/components/home/MarketplaceSpotlight";
import { getPublicProgrammes } from "@/lib/station-content";
import { flowV2Flags } from "@/lib/feature-flags";

export default async function HomePage() {
  const shows = await getPublicProgrammes();

  return (
    <div className="relative overflow-hidden bg-bg-primary text-text-primary">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[44rem] opacity-80"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(circle at 22% 2%, rgba(212,175,55,.16), transparent 30%), radial-gradient(circle at 78% 8%, rgba(212,175,55,.07), transparent 25%)",
        }}
      />

      <section className="relative mx-auto max-w-5xl overflow-x-hidden px-4 pb-6 pt-8 sm:px-6 sm:pb-12 sm:pt-16">
        <div className="flex flex-wrap items-center gap-2.5 text-[10px] font-semibold uppercase tracking-[.2em] text-brand sm:gap-3 sm:text-xs">
          <span className="font-serif text-base tracking-[.14em] sm:text-lg">BVS Radio</span>
          <span className="h-px w-8 bg-brand/55 sm:w-10" aria-hidden="true" />
          <span className="bvs-chip bvs-chip-brand normal-case tracking-[.14em]">Best Virtual Sound · Zimbabwe to the world</span>
        </div>
        <h1 className="mt-5 max-w-5xl text-balance text-[2.15rem] font-semibold leading-[1.04] tracking-[-0.045em] sm:mt-6 sm:text-5xl md:text-6xl lg:text-7xl">
          Radio, music and tools for the people shaping Zimbabwean sound.
        </h1>
        <p className="mt-4 max-w-2xl text-pretty text-[0.95rem] leading-relaxed text-text-secondary sm:mt-5 sm:text-lg">
          Start with the station, move through the people and projects around it, and keep the same BVS session with you as you explore.
        </p>
        <div className="mt-5 flex flex-col gap-2.5 sm:mt-7 sm:flex-row sm:flex-wrap sm:gap-3">
          <Link href="/radio" className="rounded-full bg-brand px-7 py-3 text-center font-semibold text-black shadow-[0_14px_40px_rgba(212,175,55,.25)] hover:bg-brand-dark sm:py-3.5">
            Start listening
          </Link>
          <Link href="/search" className="rounded-full border border-white/15 bg-white/[.03] px-7 py-3 text-center font-semibold backdrop-blur-sm hover:border-brand/50 hover:bg-white/[.06] sm:py-3.5">
            Discover BVS
          </Link>
          <Link href="/creator/studio" className="rounded-full px-7 py-2.5 text-center font-semibold text-text-secondary hover:text-brand sm:py-3.5">
            Creator Studio
          </Link>
        </div>
        <div className="mt-6 min-w-0 sm:mt-10">
          <HomeListenPanel />
        </div>
      </section>

      <BvsIntentRail />

      <section className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-16" aria-label="Discover BVS music">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3 sm:mb-8 sm:gap-4">
          <div className="max-w-3xl">
            <p className="bvs-section-kicker">Discover</p>
            <h2 className="mt-2 text-balance text-3xl tracking-tight sm:text-4xl md:text-5xl">Start with the sound. Follow where it leads.</h2>
            <p className="mt-2 text-sm text-text-secondary sm:mt-3 sm:text-base">Published artists, releases and beats stay connected to the same listening session and Library.</p>
          </div>
          <Link href="/search" className="text-sm font-semibold text-brand hover:underline">Explore everything →</Link>
        </div>
        <PublishedArtistsShelf limit={6} />
        <div className="mt-6 sm:mt-10"><PublishedAlbumsShelf /></div>
      </section>

      <HomeBeatRail />

      {flowV2Flags.pulse ? <BvsPulse /> : null}

      <section className="border-y border-white/10 bg-bg-secondary/70 py-8 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3 sm:mb-8 sm:gap-4">
            <div className="max-w-3xl">
              <p className="bvs-section-kicker mb-2">On BVS</p>
              <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">Shows built around the scene.</h2>
              <p className="mt-2 text-sm text-text-secondary sm:mt-3 sm:text-base">Programme pages carry schedule, room, video/replay context and follow state without leaving BVS.</p>
            </div>
            <Link href="/shows" className="text-sm font-semibold text-brand hover:underline">View all programmes →</Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 lg:gap-5">
            {shows.map((show, index) => {
              const featured = index === 0;
              return (
                <Link
                  key={show.slug}
                  href={`/shows/${show.slug}`}
                  className={`bvs-surface bvs-surface-hover group relative overflow-hidden rounded-[1.5rem] bg-black sm:rounded-[1.75rem] ${featured ? "md:col-span-2 lg:col-span-2" : ""}`}
                >
                  <div className={`relative ${featured ? "aspect-[16/10] sm:aspect-[16/9]" : "aspect-[4/3]"}`}>
                    <Image src={show.image} alt="" fill className="object-cover transition duration-500 group-hover:scale-[1.03]" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-black/10" />
                    <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
                      <div className="flex flex-wrap items-center gap-2">
                        {featured ? <span className="bvs-chip bvs-chip-brand">Featured show</span> : null}
                        <p className="text-[11px] font-medium text-brand">{show.schedule}</p>
                      </div>
                      <h3 className={`mt-2 font-semibold text-white ${featured ? "text-2xl sm:text-3xl" : "text-xl sm:text-2xl"}`}>{show.title}</h3>
                      <p className="mt-1 line-clamp-2 max-w-2xl text-sm text-white/70">{show.tagline}</p>
                      <p className="mt-3 text-sm font-semibold text-brand sm:mt-4">Open show →</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <MarketplaceSpotlight />

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-14">
        <div className="bvs-surface relative overflow-hidden rounded-[1.65rem] border-brand/20 p-5 sm:rounded-[2rem] sm:p-9">
          <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-brand/10 blur-3xl" aria-hidden="true" />
          <p className="bvs-section-kicker">Creator work</p>
          <h2 className="mt-2 max-w-3xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">Build the record without leaving the BVS ecosystem.</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-text-secondary sm:mt-3 sm:text-base">
            Submit music, manage releases, publish Marketplace services, track distribution and see money from the same Creator Studio. Commerce stays connected to the creator who owns the work.
          </p>
          <div className="mt-5 flex flex-wrap gap-2.5 sm:mt-6 sm:gap-3">
            <Link href="/creator/studio" className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-black shadow-[0_12px_30px_rgba(212,175,55,.22)]">Open Creator Studio</Link>
            <Link href="/marketplace" className="rounded-full border border-white/15 bg-white/[.03] px-5 py-2.5 text-sm font-semibold hover:border-brand/50">Marketplace</Link>
            <Link href="/upload" className="rounded-full px-4 py-2.5 text-sm font-semibold text-brand">Submit music →</Link>
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 px-4 py-8 text-center sm:px-6 sm:py-16">
        <p className="mx-auto max-w-2xl text-pretty text-sm text-text-secondary sm:text-lg">
          BVS is Zimbabwe&apos;s digital radio and music platform: live continuous rotation for listeners, with editorially reviewed publishing and creator tools for working artists.
        </p>
        <div className="mt-5 flex flex-col items-stretch justify-center gap-2.5 sm:mt-7 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
          <Link href="/auth/signup" className="rounded-full bg-brand px-7 py-3 font-semibold text-black sm:py-3.5">Join free</Link>
          <Link href="/about" className="rounded-full border border-white/20 px-7 py-3 font-semibold sm:py-3.5">About BVS</Link>
        </div>
      </section>
    </div>
  );
}
