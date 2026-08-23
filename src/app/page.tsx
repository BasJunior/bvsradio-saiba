import Image from "next/image";
import Link from "next/link";
import HomeListenPanel from "@/components/HomeListenPanel";
import PublishedArtistsShelf from "@/components/PublishedArtistsShelf";
import PublishedAlbumsShelf from "@/components/PublishedAlbumsShelf";
import HomeBeatRail from "@/components/flow/HomeBeatRail";
import { getPublicProgrammes } from "@/lib/station-content";
import BvsPulse from "@/components/flow/BvsPulse";
import { flowV2Flags } from "@/lib/feature-flags";

const intentCards = [
  {
    label: "Listen",
    title: "Radio, shows and what is playing now.",
    href: "/radio",
    detail: "Stay inside one listening session while you move through BVS.",
  },
  {
    label: "Discover",
    title: "Artists, releases, beats and stories.",
    href: "/search",
    detail: "Follow the people, credits and work shaping Zimbabwean sound.",
  },
  {
    label: "Work",
    title: "Creator Studio, services and bookings.",
    href: "/creator/studio",
    detail: "Publish, sell, book professional help and manage creator work.",
  },
  {
    label: "Keep",
    title: "Your library, follows and saved work.",
    href: "/library",
    detail: "Come back to music, creators, shows and purchases without starting over.",
  },
];

export default async function HomePage() {
  const shows = await getPublicProgrammes();

  return (
    <div className="bg-bg-primary text-text-primary">
      <section className="relative overflow-hidden border-b border-white/10 bg-black">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#d8b36a]/80 to-transparent" />
        <div className="pointer-events-none absolute left-1/2 top-0 h-80 w-[44rem] -translate-x-1/2 rounded-full bg-[#d8b36a]/[0.055] blur-3xl" />
        <div className="relative mx-auto max-w-5xl px-4 pb-12 pt-12 sm:px-6 sm:pb-16 sm:pt-20">
          <div className="max-w-4xl">
            <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#d8b36a] sm:text-xs">
              Best Virtual Sound · Zimbabwe to the world
            </p>
            <h1 className="max-w-4xl text-balance text-[2.1rem] font-semibold leading-[1.06] tracking-[-0.045em] text-white sm:text-5xl md:text-6xl lg:text-7xl">
              Radio, music and tools for the people shaping Zimbabwean sound.
            </h1>
            <p className="mt-5 max-w-2xl text-pretty text-base leading-relaxed text-white/65 sm:text-lg">
              The continuous rotation is live. Discover the scene, keep what matters, and move from listening to creator work without leaving BVS.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link href="/radio" className="rounded-full bg-brand px-7 py-3.5 text-center font-semibold text-black hover:bg-brand-dark">
                Start listening
              </Link>
              <Link href="/search" className="rounded-full border border-white/20 px-7 py-3.5 text-center font-semibold text-white hover:bg-white/10">
                Explore BVS
              </Link>
              <Link href="/marketplace" className="rounded-full px-7 py-3.5 text-center font-semibold text-white/60 hover:text-[#d8b36a]">
                Find a studio or service
              </Link>
            </div>
          </div>

          <div className="mt-9 min-w-0">
            <HomeListenPanel />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14" aria-labelledby="bvs-paths-title">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[.2em] text-[#d8b36a]">One BVS</p>
          <h2 id="bvs-paths-title" className="mt-2 text-balance text-3xl font-semibold sm:text-4xl">Listen. Discover. Work. Keep.</h2>
          <p className="mt-3 text-text-secondary">Four simple intentions, one connected platform. Radio, discovery, creator tools, Marketplace and Library should reinforce each other instead of behaving like separate products.</p>
        </div>
        <div className="mt-7 grid gap-3 md:grid-cols-2">
          {intentCards.map((item) => (
            <Link key={item.label} href={item.href} className="group rounded-2xl border border-white/10 bg-white/[.025] p-5 transition hover:border-[#d8b36a]/35 hover:bg-white/[.04]">
              <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-[#d8b36a]">{item.label}</p>
              <h3 className="mt-2 text-xl font-semibold group-hover:text-white">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-text-secondary">{item.detail}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14" aria-label="Discover BVS music">
        <div className="mb-6 max-w-3xl">
          <p className="text-xs uppercase tracking-[.2em] text-brand">Inside BVS now</p>
          <h2 className="mt-2 text-balance text-3xl sm:text-4xl md:text-5xl">Start with the sound. Follow where it leads.</h2>
          <p className="mt-3 text-text-secondary">Open an artist or release, follow verified credits and keep the original music playing while you explore.</p>
        </div>
        <Link href="/catalogue" className="text-sm text-brand hover:underline">Browse catalogue →</Link>
        <div className="mt-8 space-y-10">
          <PublishedArtistsShelf limit={6} />
          <PublishedAlbumsShelf />
        </div>
      </section>

      {flowV2Flags.pulse ? <BvsPulse /> : null}

      <HomeBeatRail />

      <section className="border-y border-white/10 bg-bg-secondary py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="mb-2 text-xs uppercase tracking-[0.18em] text-[#d8b36a]">Programmes</p>
              <h2 className="text-balance text-2xl font-semibold sm:text-3xl md:text-4xl">Shows built around the scene.</h2>
            </div>
            <Link href="/shows" className="text-sm text-brand hover:underline">View all programmes →</Link>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {shows.map((show) => (
              <Link key={show.slug} href={`/shows/${show.slug}`} className="group relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-black">
                <div className="relative aspect-[4/3]">
                  <Image src={show.image} alt="" fill className="object-cover transition duration-500 group-hover:scale-[1.03]" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-black/10" />
                  <div className="absolute inset-x-0 bottom-0 p-5">
                    <p className="text-[11px] font-medium text-white/65">{show.schedule}</p>
                    <h3 className="mt-1 text-xl font-semibold text-white sm:text-2xl">{show.title}</h3>
                    <p className="mt-1 text-sm text-white/65">{show.tagline}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16" aria-labelledby="home-marketplace-title">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[.2em] text-[#d8b36a]">Studios &amp; services</p>
            <h2 id="home-marketplace-title" className="mt-2 text-balance text-3xl font-semibold sm:text-4xl">Take the project somewhere real.</h2>
            <p className="mt-3 text-text-secondary">Marketplace is the single home for BVS studios, engineers, provider stores and official services.</p>
          </div>
          <Link href="/marketplace" className="text-sm text-brand hover:underline">Open Marketplace →</Link>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <Link href="/marketplace/wolfbridges-studio" className="group relative min-h-72 overflow-hidden rounded-[2rem] border border-white/10 bg-black">
            <Image src="/images/marketplace/wolfbridges-studio.jpg" alt="WolfBridges Studio" fill className="object-cover object-top transition duration-500 group-hover:scale-[1.02]" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6">
              <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-[#d8b36a]">Madokero, Harare</p>
              <h3 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">WolfBridges Studio</h3>
              <p className="mt-2 max-w-lg text-sm text-white/70">Recording, mixing, mastering and beat-based production. Studio packages from $30.</p>
              <p className="mt-4 text-sm font-semibold text-brand">Open Wolf Studio →</p>
            </div>
          </Link>

          <Link href="/marketplace/bvs-studio-services" className="group relative min-h-72 overflow-hidden rounded-[2rem] border border-white/10 bg-black">
            <Image src="/images/editorial/audio-engineering-work.webp" alt="Audio engineer working at a mixing console" fill className="object-cover transition duration-500 group-hover:scale-[1.02]" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6">
              <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-[#d8b36a]">Official BVS provider</p>
              <h3 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">BVS Studio Services</h3>
              <p className="mt-2 max-w-lg text-sm text-white/70">Official mixing, mastering, vocal production and release-preparation services inside the same Marketplace.</p>
              <p className="mt-4 text-sm font-semibold text-brand">Open BVS Studio →</p>
            </div>
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="rounded-[2rem] border border-white/10 bg-bg-card/40 p-6 sm:p-8">
          <p className="text-xs uppercase tracking-[0.2em] text-[#d8b36a]">Build on BVS</p>
          <h2 className="mt-2 max-w-2xl text-balance text-2xl font-semibold sm:text-3xl">Publish your work, open your store, build your audience.</h2>
          <p className="mt-3 max-w-3xl text-sm text-text-secondary sm:text-base">Creator Studio is the working surface. Marketplace is where services and products meet customers. Radio, discovery and Library keep the public journey connected to that work.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/creator/studio" className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-black">Open Creator Studio</Link>
            <Link href="/creator/marketplace" className="rounded-full border border-white/20 px-5 py-2.5 text-sm font-semibold">Manage provider store</Link>
            <Link href="/upload" className="rounded-full px-4 py-2.5 text-sm text-brand">Submit music →</Link>
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 px-4 py-12 text-center sm:px-6 sm:py-16">
        <p className="mx-auto max-w-2xl text-pretty text-base text-text-secondary sm:text-lg">BVS is Zimbabwe&apos;s digital radio and music platform: live listening, editorial discovery, creator tools and professional services connected in one system.</p>
        <div className="mt-7 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Link href="/auth/signup" className="rounded-full bg-brand px-7 py-3.5 font-semibold text-black">Join free</Link>
          <Link href="/contact" className="rounded-full border border-white/20 px-7 py-3.5 font-semibold">Contact BVS</Link>
        </div>
      </section>
    </div>
  );
}
