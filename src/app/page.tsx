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

      <section className="relative mx-auto max-w-5xl overflow-x-hidden px-4 pb-8 pt-10 sm:px-6 sm:pb-12 sm:pt-16">
        <div className="flex flex-wrap items-center gap-3 text-[10px] font-semibold uppercase tracking-[.2em] text-brand sm:text-xs">
          <span className="font-serif text-base tracking-[.14em] sm:text-lg">BVS Radio</span>
          <span className="h-px w-10 bg-brand/55" aria-hidden="true" />
          <span>Best Virtual Sound · Zimbabwe to the world</span>
        </div>
        <h1 className="mt-6 max-w-5xl text-balance text-[2.25rem] font-semibold leading-[1.04] tracking-[-0.045em] sm:text-5xl md:text-6xl lg:text-7xl">
          Radio, music and tools for the people shaping Zimbabwean sound.
        </h1>
        <p className="mt-5 max-w-2xl text-pretty text-base leading-relaxed text-text-secondary sm:text-lg">
          Start with the station, move through the people and projects around it, and keep the same BVS session with you as you explore.
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link href="/radio" className="rounded-full bg-brand px-7 py-3.5 text-center font-semibold text-black hover:bg-brand-dark">
            Start listening
          </Link>
          <Link href="/search" className="rounded-full border border-white/20 px-7 py-3.5 text-center font-semibold hover:border-brand/50 hover:bg-white/[.04]">
            Discover BVS
          </Link>
          <Link href="/creator/studio" className="rounded-full px-7 py-3.5 text-center font-semibold text-text-secondary hover:text-brand">
            Creator Studio
          </Link>
        </div>
        <div className="mt-8 min-w-0 sm:mt-10">
          <HomeListenPanel />
        </div>
      </section>

      <BvsIntentRail />

      <section className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16" aria-label="Discover BVS music">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[.22em] text-brand">Discover</p>
            <h2 className="mt-2 text-balance text-3xl sm:text-4xl md:text-5xl">Start with the sound. Follow where it leads.</h2>
            <p className="mt-3 text-text-secondary">Published artists, releases and beats stay connected to the same listening session and Library.</p>
          </div>
          <Link href="/search" className="text-sm font-semibold text-brand hover:underline">Explore everything →</Link>
        </div>
        <PublishedArtistsShelf limit={6} />
        <div className="mt-10"><PublishedAlbumsShelf /></div>
      </section>

      <HomeBeatRail />

      {flowV2Flags.pulse ? <BvsPulse /> : null}

      <section className="border-y border-white/10 bg-bg-secondary/70 py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-3xl">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[.2em] text-brand">On BVS</p>
              <h2 className="text-balance text-3xl font-semibold sm:text-4xl">Shows built around the scene.</h2>
              <p className="mt-3 text-text-secondary">Programme pages carry schedule, room, video/replay context and follow state without leaving BVS.</p>
            </div>
            <Link href="/shows" className="text-sm font-semibold text-brand hover:underline">View all programmes →</Link>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {shows.map((show) => (
              <Link
                key={show.slug}
                href={`/shows/${show.slug}`}
                className="group relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-black shadow-[0_25px_60px_rgba(0,0,0,.2)]"
              >
                <div className="relative aspect-[4/3]">
                  <Image src={show.image} alt="" fill className="object-cover transition duration-500 group-hover:scale-[1.03]" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-black/10" />
                  <div className="absolute inset-x-0 bottom-0 p-5">
                    <p className="text-[11px] font-medium text-brand">{show.schedule}</p>
                    <h3 className="mt-1 text-xl font-semibold text-white sm:text-2xl">{show.title}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-white/70">{show.tagline}</p>
                    <p className="mt-4 text-sm font-semibold text-brand">Open show →</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <MarketplaceSpotlight />

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="relative overflow-hidden rounded-[2rem] border border-brand/20 bg-gradient-to-br from-brand/[.08] via-bg-card/45 to-bg-card/20 p-6 sm:p-9">
          <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-brand/10 blur-3xl" aria-hidden="true" />
          <p className="text-xs font-semibold uppercase tracking-[.22em] text-brand">Creator work</p>
          <h2 className="mt-2 max-w-3xl text-balance text-3xl font-semibold sm:text-4xl">Build the record without leaving the BVS ecosystem.</h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-text-secondary sm:text-base">
            Submit music, manage releases, publish Marketplace services, track distribution and see money from the same Creator Studio. Commerce stays connected to the creator who owns the work.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/creator/studio" className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-black">Open Creator Studio</Link>
            <Link href="/marketplace" className="rounded-full border border-white/20 px-5 py-2.5 text-sm font-semibold hover:border-brand/50">Marketplace</Link>
            <Link href="/upload" className="rounded-full px-4 py-2.5 text-sm font-semibold text-brand">Submit music →</Link>
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 px-4 py-12 text-center sm:px-6 sm:py-16">
        <p className="mx-auto max-w-2xl text-pretty text-base text-text-secondary sm:text-lg">
          BVS is Zimbabwe&apos;s digital radio and music platform: live continuous rotation for listeners, with editorially reviewed publishing and creator tools for working artists.
        </p>
        <div className="mt-7 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Link href="/auth/signup" className="rounded-full bg-brand px-7 py-3.5 font-semibold text-black">Join free</Link>
          <Link href="/about" className="rounded-full border border-white/20 px-7 py-3.5 font-semibold">About BVS</Link>
        </div>
      </section>
    </div>
  );
}
