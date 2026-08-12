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
      {/* overflow-x-hidden only — avoid clipping multi-line hero text on iPhone */}
      <section className="relative min-h-[min(88vh,900px)] overflow-x-hidden">
        <Image
          src="/images/editorial/radio-studio-harare.webp"
          alt="Independent radio studio prepared for a BVS programme"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/90 via-black/75 to-black/50 sm:bg-gradient-to-r sm:from-black sm:via-black/75 sm:to-black/25" />
        <div className="relative mx-auto grid min-h-[min(88vh,900px)] max-w-7xl items-center gap-8 px-4 py-12 text-white sm:gap-12 sm:px-6 sm:py-16 lg:grid-cols-[1.05fr_.95fr]">
          <div className="min-w-0 max-w-full">
            <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-brand sm:mb-5 sm:text-xs sm:tracking-[0.2em]">
              Best Virtual Sound · Zimbabwe to the world
            </p>
            <h1 className="max-w-4xl text-balance text-[1.85rem] font-semibold leading-[1.12] tracking-[-0.03em] xs:text-4xl sm:text-5xl sm:leading-[1.08] md:text-6xl lg:text-7xl">
              Radio, music and tools for the people shaping Zimbabwean sound.
            </h1>
            <p className="mt-4 max-w-2xl text-pretty text-base leading-relaxed text-white/75 sm:mt-6 sm:text-lg">
              The continuous rotation is live. Browse the catalogue and BeatStore, submit music for review, or book mix and master services — all from one place.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:flex-wrap">
              <Link
                href="/radio"
                className="rounded-full bg-brand px-7 py-3.5 text-center font-semibold text-black hover:bg-brand-dark"
              >
                Start listening
              </Link>
              <Link
                href="/upload"
                className="rounded-full border border-white/30 px-7 py-3.5 text-center font-semibold hover:bg-white/10"
              >
                For artists
              </Link>
              <Link
                href="/catalogue?type=beat#beatstore"
                className="rounded-full border border-brand/60 bg-neutral-950/40 px-7 py-3.5 text-center font-semibold text-brand hover:bg-brand hover:text-black"
              >
                Browse BeatStore
              </Link>
            </div>
          </div>
          <div className="min-w-0">
            <HomeListenPanel />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16" aria-label="Discover BVS music">
        <div className="mb-8 max-w-3xl">
          <p className="text-xs uppercase tracking-[.2em] text-brand">Inside BVS now</p>
          <h2 className="mt-2 text-balance text-3xl sm:text-4xl md:text-5xl">Start with the sound. Follow where it leads.</h2>
          <p className="mt-3 text-text-secondary">Open an artist or release, follow verified credits and keep the original music playing while you explore.</p>
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
            <p className="mt-3 max-w-2xl text-sm text-text-secondary sm:text-base">Creator submissions and professional services have clear review, scope and delivery paths away from the listening flow.</p>
            <div className="mt-6 flex flex-wrap gap-3"><Link href="/upload" className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-black">Submit music</Link><Link href="/shop" className="rounded-full border border-white/20 px-5 py-2.5 text-sm font-semibold">Studio services</Link><Link href="/faq" className="rounded-full px-4 py-2.5 text-sm text-brand">Creator FAQs →</Link></div>
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 px-4 py-12 text-center sm:px-6 sm:py-16">
        <p className="mx-auto max-w-2xl text-pretty text-base text-text-secondary sm:text-lg">
          BVS is Zimbabwe&apos;s digital radio and music platform: live continuous rotation for listeners, with editorially reviewed publishing and creator tools for working artists.
        </p>
        <div className="mt-7 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Link href="/auth/signup" className="rounded-full bg-brand px-7 py-3.5 font-semibold text-black">
            Join free
          </Link>
          <Link href="/contact" className="rounded-full border border-white/20 px-7 py-3.5 font-semibold">
            Contact BVS
          </Link>
        </div>
      </section>
    </div>
  );
}
