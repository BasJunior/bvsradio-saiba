import Image from "next/image";
import Link from "next/link";
import HomeListenPanel from "@/components/HomeListenPanel";
import { getPublicProgrammes } from "@/lib/station-content";

const listenerPaths = [
  { title: "Listen", copy: "Start the continuous BVS music rotation and keep it playing while you browse.", href: "/radio", cta: "Open radio" },
  { title: "Discover", copy: "Search real tracks, artists, programmes and stories from one place.", href: "/search", cta: "Search BVS" },
  { title: "Your library", copy: "Save music, follow programmes and return to your recent listening on this device.", href: "/library", cta: "View library" },
];

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
        <div className="relative mx-auto grid min-h-[min(88vh,900px)] max-w-7xl items-center gap-8 px-4 py-12 sm:gap-12 sm:px-6 sm:py-16 lg:grid-cols-[1.05fr_.95fr]">
          <div className="min-w-0 max-w-full">
            <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-brand sm:mb-5 sm:text-xs sm:tracking-[0.2em]">
              Best Virtual Sound · Zimbabwe to the world
            </p>
            <h1 className="max-w-4xl text-balance text-[1.85rem] font-semibold leading-[1.12] tracking-[-0.03em] xs:text-4xl sm:text-5xl sm:leading-[1.08] md:text-6xl lg:text-7xl">
              Radio, music and tools for the people shaping Zimbabwean sound.
            </h1>
            <p className="mt-4 max-w-2xl text-pretty text-base leading-relaxed text-white/75 sm:mt-6 sm:text-lg">
              Listen to the BVS rotation, discover artists and future programmes, or bring your own project to the platform for submission and audio services.
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
            </div>
          </div>
          <div className="min-w-0">
            <HomeListenPanel />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="mb-2 text-xs uppercase tracking-[0.15em] text-brand sm:tracking-[0.2em]">Choose your path</p>
            <h2 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl">
              Easy to enter. Clear where to go next.
            </h2>
          </div>
        </div>
        <div className="grid gap-4 sm:gap-5 md:grid-cols-3">
          {listenerPaths.map((item) => (
            <Link
              key={item.title}
              href={item.href}
              className="group rounded-3xl border border-white/10 bg-bg-card/45 p-6 transition hover:border-brand/40 sm:p-7"
            >
              <h3 className="text-xl font-semibold group-hover:text-brand sm:text-2xl">{item.title}</h3>
              <p className="mt-3 text-sm text-text-secondary sm:min-h-16 sm:text-base">{item.copy}</p>
              <span className="mt-6 inline-block text-sm font-medium text-brand">{item.cta} →</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-y border-white/10 bg-bg-secondary py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="mb-2 text-xs uppercase tracking-[0.15em] text-brand sm:tracking-[0.2em]">Programmes in development</p>
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
                    Preview
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

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-12 sm:gap-8 sm:px-6 sm:py-16 lg:grid-cols-2">
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-bg-card/40">
          <div className="relative aspect-[3/2]">
            <Image
              src="/images/editorial/audio-engineering-work.webp"
              alt="Audio engineer working at a mixing console"
              fill
              className="object-cover"
            />
          </div>
          <div className="p-6 sm:p-7">
            <p className="text-xs uppercase tracking-[0.15em] text-brand sm:tracking-[0.2em]">Audio services</p>
            <h2 className="mt-2 text-balance text-2xl font-semibold sm:text-3xl">Bring the project. Confirm the scope.</h2>
            <p className="mt-3 text-sm text-text-secondary sm:text-base">
              Mixing, mastering and vocal production start with a file review. Engineer, delivery and timetable are confirmed before work begins.
            </p>
            <Link href="/shop" className="mt-6 inline-block font-medium text-brand hover:underline">
              Explore services →
            </Link>
          </div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-bg-card/40 p-6 sm:p-8 lg:p-10">
          <p className="text-xs uppercase tracking-[0.15em] text-brand sm:tracking-[0.2em]">For artists</p>
          <h2 className="mt-2 text-balance text-2xl font-semibold sm:text-3xl md:text-4xl">
            Submit music without guessing what happens next.
          </h2>
          <p className="mt-4 text-base text-text-secondary sm:text-lg">
            Read the requirements, send a real track for editorial review, and keep licensing or engineering orders separate from radio consideration.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <Link href="/upload" className="rounded-full bg-brand px-6 py-3 text-center font-semibold text-black hover:bg-brand-dark">
              Submission guide
            </Link>
            <Link href="/catalogue" className="rounded-full border border-white/20 px-6 py-3 text-center font-semibold hover:bg-white/5">
              Browse music &amp; beats
            </Link>
          </div>
          <p className="mt-6 text-sm text-text-secondary">
            Buying a service never guarantees radio placement. Verified public credits and testimonials will appear only when approved.
          </p>
        </div>
      </section>

      <section className="border-t border-white/10 px-4 py-12 text-center sm:px-6 sm:py-16">
        <p className="mx-auto max-w-2xl text-pretty text-base text-text-secondary sm:text-lg">
          BVS is being prepared as Zimbabwe&apos;s digital radio and music platform: focused enough to feel human, broad enough to serve listeners and working artists.
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
