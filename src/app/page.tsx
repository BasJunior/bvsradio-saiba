import Image from "next/image";
import Link from "next/link";
import HomeListenPanel from "@/components/HomeListenPanel";
import PublishedArtistsShelf from "@/components/PublishedArtistsShelf";
import PublishedAlbumsShelf from "@/components/PublishedAlbumsShelf";
import HomeBeatRail from "@/components/flow/HomeBeatRail";
import HomeEngagementHub from "@/components/home/HomeEngagementHub";
import HomePublicPlaylistRail from "@/components/home/HomePublicPlaylistRail";
import { getPublicProgrammes } from "@/lib/station-content";

const paths = [
  {
    eyebrow: "Listen",
    title: "Start with the sound",
    copy: "Drop into the live rotation and keep listening while you move through BVS.",
    href: "/radio",
    cta: "Listen now",
  },
  {
    eyebrow: "Discover",
    title: "Find what is moving next",
    copy: "Explore artists, releases, playlists, beats and the people connected to the music.",
    href: "/search",
    cta: "Discover BVS",
  },
  {
    eyebrow: "Create",
    title: "Take your music further",
    copy: "Submit a track, follow its review path and build from the same creator workspace.",
    href: "/creator/studio",
    cta: "Open Studio",
  },
];

export default async function HomePage() {
  const shows = await getPublicProgrammes();

  return (
    <div className="relative overflow-hidden bg-bg-primary text-text-primary">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[42rem] opacity-80"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(circle at 20% 4%, rgba(212,175,55,.15), transparent 30%), radial-gradient(circle at 82% 12%, rgba(104,86,255,.10), transparent 28%)",
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

            <h1 className="mt-5 max-w-3xl text-balance text-4xl font-semibold leading-[1.03] tracking-[-0.04em] sm:text-5xl lg:text-[3.65rem]">
              Music moves differently here.
            </h1>
            <p className="mt-4 max-w-xl text-pretty text-base leading-relaxed text-text-secondary sm:text-lg">
              Live radio, new music and creator tools in one connected BVS experience — built for listeners finding what is next and artists ready to move.
            </p>

            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
              <Link href="#listen" className="rounded-full bg-brand px-6 py-3 text-center text-sm font-semibold text-black shadow-[0_14px_38px_rgba(212,175,55,.20)] hover:bg-brand-dark">
                Start listening
              </Link>
              <Link href="/search" className="rounded-full border border-white/15 bg-white/[.035] px-6 py-3 text-center text-sm font-semibold backdrop-blur-sm hover:border-brand/50 hover:bg-white/[.07]">
                Discover music
              </Link>
              <Link href="/creator/studio" className="rounded-full px-5 py-3 text-center text-sm font-semibold text-text-secondary hover:text-brand">
                Creator Studio →
              </Link>
            </div>
          </div>

          <div id="listen" className="min-w-0 scroll-mt-24 rounded-[1.75rem] border border-white/10 bg-white/[.025] p-2 shadow-[0_24px_80px_rgba(0,0,0,.28)] backdrop-blur-sm sm:p-3">
            <HomeListenPanel />
          </div>
        </div>

        <div className="mt-8 grid gap-3 sm:mt-10 md:grid-cols-3">
          {paths.map((item) => (
            <Link
              key={item.eyebrow}
              href={item.href}
              className="group rounded-[1.4rem] border border-white/10 bg-white/[.025] p-5 transition hover:-translate-y-0.5 hover:border-brand/35 hover:bg-white/[.045]"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-brand">{item.eyebrow}</p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight">{item.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-text-secondary">{item.copy}</p>
              <p className="mt-4 text-sm font-semibold text-brand">{item.cta} →</p>
            </Link>
          ))}
        </div>
      </section>

      <HomeEngagementHub />

      <section className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-16" aria-label="Discover BVS music">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[.2em] text-brand">Discover</p>
            <h2 className="mt-2 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">Find your next favourite before everyone else does.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-secondary sm:text-base">
              Move from a song to the artist, release and wider BVS catalogue without breaking the listening flow.
            </p>
          </div>
          <Link href="/search" className="text-sm font-semibold text-brand hover:underline">Explore everything →</Link>
        </div>
        <PublishedArtistsShelf limit={6} />
        <div className="mt-8 sm:mt-10"><PublishedAlbumsShelf /></div>
      </section>

      <HomePublicPlaylistRail />

      <HomeBeatRail />

      <section className="border-y border-white/10 bg-bg-secondary/65 py-10 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[.2em] text-brand">Shows on BVS</p>
              <h2 className="mt-2 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">More than a playlist.</h2>
              <p className="mt-3 text-sm text-text-secondary sm:text-base">Programmes, conversations and replay moments built around the music and the people making it.</p>
            </div>
            <Link href="/shows" className="text-sm font-semibold text-brand hover:underline">View all shows →</Link>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {shows.map((show, index) => {
              const featured = index === 0;
              return (
                <Link
                  key={show.slug}
                  href={`/shows/${show.slug}`}
                  className={`group relative overflow-hidden rounded-[1.55rem] border border-white/10 bg-black ${featured ? "md:col-span-2 lg:col-span-2" : ""}`}
                >
                  <div className={`relative ${featured ? "aspect-[16/9]" : "aspect-[4/3]"}`}>
                    <Image src={show.image} alt="" fill className="object-cover transition duration-500 group-hover:scale-[1.025]" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
                      <p className="text-[10px] font-semibold uppercase tracking-[.17em] text-brand">{show.schedule}</p>
                      <h3 className={`mt-2 font-semibold text-white ${featured ? "text-2xl sm:text-3xl" : "text-xl"}`}>{show.title}</h3>
                      <p className="mt-1 line-clamp-2 text-sm text-white/70">{show.tagline}</p>
                      <p className="mt-3 text-sm font-semibold text-brand">Open show →</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-16">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="relative overflow-hidden rounded-[1.65rem] border border-white/10 bg-white/[.03] p-6 sm:p-8">
            <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand/10 blur-3xl" aria-hidden="true" />
            <p className="text-xs font-semibold uppercase tracking-[.2em] text-brand">Marketplace</p>
            <h2 className="mt-2 max-w-xl text-balance text-3xl font-semibold tracking-tight">Find the people and services that move a record forward.</h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-text-secondary sm:text-base">
              Browse real creator services and availability when you need production, recording, mixing, mastering or other specialist help.
            </p>
            <Link href="/marketplace" className="mt-6 inline-flex rounded-full border border-brand/35 bg-brand/10 px-5 py-2.5 text-sm font-semibold text-brand hover:bg-brand/15">
              Explore Marketplace →
            </Link>
          </div>

          <div className="grid overflow-hidden rounded-[1.65rem] border border-white/10 bg-bg-card/45 sm:grid-cols-[12rem_1fr]">
            <div className="relative min-h-48 sm:min-h-full">
              <Image src="/images/editorial/audio-engineering-work.webp" alt="Audio engineer working at a mixing console" fill className="object-cover" />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/15" />
            </div>
            <div className="p-6 sm:p-7">
              <p className="text-xs font-semibold uppercase tracking-[.2em] text-brand">Creator Studio</p>
              <h2 className="mt-2 text-balance text-2xl font-semibold tracking-tight sm:text-3xl">From first upload to what comes next.</h2>
              <p className="mt-3 text-sm leading-relaxed text-text-secondary">
                Submit music, follow review and release progress, then see performance and money from one creator workspace. Your first BVS release does not require Premium.
              </p>
              <div className="mt-5 flex flex-wrap gap-2.5">
                <Link href="/creator/studio" className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-black">Open Studio</Link>
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
