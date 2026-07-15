import Image from "next/image";
import Link from "next/link";
import HomeListenPanel from "@/components/HomeListenPanel";
import { shows } from "@/lib/station";

const listenerPaths = [
  { title: "Listen", copy: "Start the continuous BVS music rotation and keep it playing while you browse.", href: "/radio", cta: "Open radio" },
  { title: "Discover", copy: "Search real tracks, artists, programmes and stories from one place.", href: "/search", cta: "Search BVS" },
  { title: "Your library", copy: "Save music, follow programmes and return to your recent listening on this device.", href: "/library", cta: "View library" },
];

export default function HomePage() {
  return (
    <div className="bg-bg-primary text-text-primary">
      <section className="relative min-h-[88vh] overflow-hidden">
        <Image src="/images/editorial/radio-studio-harare.webp" alt="Independent radio studio prepared for a BVS programme" fill className="object-cover" priority />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/75 to-black/25" />
        <div className="relative mx-auto grid min-h-[88vh] max-w-7xl items-center gap-12 px-6 py-16 lg:grid-cols-[1.05fr_.95fr]">
          <div>
            <p className="mb-5 text-xs font-semibold uppercase tracking-[.25em] text-brand">Best Virtual Sound · Zimbabwe to the world</p>
            <h1 className="max-w-4xl text-6xl font-semibold tracking-[-.045em] sm:text-7xl">Radio, music and tools for the people shaping Zimbabwean sound.</h1>
            <p className="mt-6 max-w-2xl text-lg text-white/70">Listen to the BVS rotation, discover artists and future programmes, or bring your own project to the platform for submission and audio services.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/radio" className="rounded-full bg-brand px-7 py-3 font-semibold text-black hover:bg-brand-dark">Start listening</Link>
              <Link href="/upload" className="rounded-full border border-white/30 px-7 py-3 font-semibold hover:bg-white/10">For artists</Link>
            </div>
          </div>
          <HomeListenPanel />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div><p className="mb-2 text-xs uppercase tracking-[.2em] text-brand">Choose your path</p><h2 className="text-4xl font-semibold tracking-tight">Easy to enter. Clear where to go next.</h2></div>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {listenerPaths.map((item) => <Link key={item.title} href={item.href} className="group rounded-3xl border border-white/10 bg-bg-card/45 p-7 transition hover:border-brand/40"><h3 className="text-2xl font-semibold group-hover:text-brand">{item.title}</h3><p className="mt-3 min-h-16 text-text-secondary">{item.copy}</p><span className="mt-6 inline-block text-sm font-medium text-brand">{item.cta} →</span></Link>)}
        </div>
      </section>

      <section className="border-y border-white/10 bg-bg-secondary py-16">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-8 flex items-end justify-between gap-4"><div><p className="mb-2 text-xs uppercase tracking-[.2em] text-brand">Programmes in development</p><h2 className="text-4xl font-semibold">Shows built around the scene.</h2></div><Link href="/shows" className="hidden text-sm text-brand hover:underline sm:block">View all programmes →</Link></div>
          <div className="grid gap-5 md:grid-cols-3">
            {shows.map((show) => <Link key={show.slug} href={`/shows/${show.slug}`} className="group overflow-hidden rounded-3xl border border-white/10 bg-black/30"><div className="relative aspect-[4/3]"><Image src={show.image} alt="" fill className="object-cover transition group-hover:scale-[1.02]" /><span className="absolute left-4 top-4 rounded-full bg-black/70 px-3 py-1 text-[10px] uppercase tracking-widest">Preview</span></div><div className="p-5"><h3 className="text-xl font-semibold group-hover:text-brand">{show.title}</h3><p className="mt-2 text-sm text-text-secondary">{show.tagline}</p><p className="mt-4 text-xs text-brand">{show.schedule}</p></div></Link>)}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-6 py-16 lg:grid-cols-2">
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-bg-card/40"><div className="relative aspect-[3/2]"><Image src="/images/editorial/audio-engineering-work.webp" alt="Audio engineer working at a mixing console" fill className="object-cover" /></div><div className="p-7"><p className="text-xs uppercase tracking-[.2em] text-brand">Audio services</p><h2 className="mt-2 text-3xl font-semibold">Bring the project. Confirm the scope.</h2><p className="mt-3 text-text-secondary">Mixing, mastering and vocal production start with a file review. Engineer, delivery and timetable are confirmed before work begins.</p><Link href="/shop" className="mt-6 inline-block font-medium text-brand hover:underline">Explore services →</Link></div></div>
        <div className="rounded-3xl border border-white/10 bg-bg-card/40 p-8 lg:p-10"><p className="text-xs uppercase tracking-[.2em] text-brand">For artists</p><h2 className="mt-2 text-4xl font-semibold">Submit music without guessing what happens next.</h2><p className="mt-4 text-lg text-text-secondary">Read the requirements, send a real track for editorial review, and keep licensing or engineering orders separate from radio consideration.</p><div className="mt-8 grid gap-3 sm:grid-cols-2"><Link href="/upload" className="rounded-full bg-brand px-6 py-3 text-center font-semibold text-black hover:bg-brand-dark">Submission guide</Link><Link href="/catalogue" className="rounded-full border border-white/20 px-6 py-3 text-center font-semibold hover:bg-white/5">Browse music &amp; beats</Link></div><p className="mt-6 text-sm text-text-secondary">Buying a service never guarantees radio placement. Verified public credits and testimonials will appear only when approved.</p></div>
      </section>

      <section className="border-t border-white/10 px-6 py-16 text-center"><p className="mx-auto max-w-2xl text-lg text-text-secondary">BVS is being prepared as Zimbabwe&apos;s digital radio and music platform: focused enough to feel human, broad enough to serve listeners and working artists.</p><div className="mt-7 flex flex-wrap justify-center gap-3"><Link href="/auth/signup" className="rounded-full bg-brand px-7 py-3 font-semibold text-black">Join free</Link><Link href="/contact" className="rounded-full border border-white/20 px-7 py-3 font-semibold">Contact BVS</Link></div></section>
    </div>
  );
}
