import Image from "next/image";
import Link from "next/link";
import HomeListenPanel from "@/components/HomeListenPanel";
import PublishedArtistsShelf from "@/components/PublishedArtistsShelf";
import PublishedAlbumsShelf from "@/components/PublishedAlbumsShelf";
import HomeBeatRail from "@/components/flow/HomeBeatRail";
import { getPublicProgrammes } from "@/lib/station-content";

export default async function HomePage() {
  const shows = await getPublicProgrammes();
  return (
    <div className="bg-bg-primary text-text-primary">
      <section className="border-b border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent)]">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-7 sm:px-6 sm:py-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center lg:py-12">
          <div className="min-w-0 lg:pr-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand sm:text-xs sm:tracking-[0.2em]">
              Best Virtual Sound · African music, built between Zimbabwe and the world
            </p>
            <h1 className="mt-3 max-w-3xl text-balance text-3xl font-semibold tracking-[-0.03em] sm:text-5xl">
              Start with the sound.
            </h1>
            <p className="mt-3 max-w-xl text-pretty text-sm leading-relaxed text-text-secondary sm:text-base">
              Live rotation, published music and BeatStore — keep listening while you follow the people behind it.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href="#listen" className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-black hover:bg-brand-dark">
                Listen live
              </Link>
              <Link href="/search" className="rounded-full border border-white/20 px-5 py-2.5 text-sm font-semibold hover:bg-white/10">
                Explore
              </Link>
            </div>
          </div>
          <div id="listen" className="min-w-0 scroll-mt-24">
            <HomeListenPanel />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14" aria-label="Discover BVS music">
        <div className="mb-8 max-w-3xl">
          <p className="text-xs uppercase tracking-[.2em] text-brand">Inside BVS now</p>
          <h2 className="mt-2 text-balance text-3xl sm:text-4xl">Follow where the music leads.</h2>
          <p className="mt-3 text-text-secondary">Open an artist or release, keep the original music playing, and move through verified credits.</p>
        </div>
        <PublishedArtistsShelf limit={6} />
        <PublishedAlbumsShelf />
      </section>

      <HomeBeatRail />

      <section className="border-y border-white/10 bg-bg-secondary py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="mb-2 text-xs uppercase tracking-[0.15em] text-brand sm:tracking-[0.2em]">Upcoming programmes</p>
              <h2 className="text-balance text-2xl font-semibold sm:text-3xl md:text-4xl">Shows built around the scene.</h2>
            </div>
            <Link href="/shows" className="text-sm text-brand hover:underline">
              View all programmes →
            </Link>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {shows.map((show) => (
              <Link
                key={show.slug}
                href={`/shows/${show.slug}`}
                className="group overflow-hidden rounded-3xl border border-white/10 bg-black/30"
              >
                <div className="relative aspect-[4/3]">
                  <Image src={show.image} alt="" fill className="object-cover transition group-hover:scale-[1.02]" />
                  <span className="absolute left-4 top-4 rounded-full bg-black/70 px-3 py-1 text-[10px] uppercase tracking-widest">
                    Upcoming
                  </span>
                </div>
                <div className="p-5">
                  <h3 className="text-lg font-semibold group-hover:text-brand sm:text-xl">{show.title}</h3>
                  <p className="mt-2 text-sm text-text-secondary">{show.tagline}</p>
                  <p className="mt-4 text-xs text-brand">{show.schedule}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="grid overflow-hidden rounded-3xl border border-white/10 bg-bg-card/40 md:grid-cols-[17rem_1fr]">
          <div className="relative min-h-52 md:min-h-full">
            <Image
              src="/images/editorial/audio-engineering-work.webp"
              alt="Audio engineer working at a mixing console"
              fill
              className="object-cover"
            />
          </div>
          <div className="p-6 sm:p-8">
            <p className="text-xs uppercase tracking-[0.2em] text-brand">Build on BVS</p>
            <h2 className="mt-2 text-balance text-2xl font-semibold sm:text-3xl">Submit music or bring the project to the studio.</h2>
            <p className="mt-3 max-w-2xl text-sm text-text-secondary sm:text-base">Creator submissions and professional services sit away from the listening flow, with clear review and delivery paths.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/upload" className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-black">Submit music</Link>
              <Link href="/shop" className="rounded-full border border-white/20 px-5 py-2.5 text-sm font-semibold">Studio services</Link>
              <Link href="/faq" className="rounded-full px-4 py-2.5 text-sm text-brand">Creator FAQs →</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
