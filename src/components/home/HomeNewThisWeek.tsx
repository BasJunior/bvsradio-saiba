import Link from "next/link";
import { discoveryItems } from "@/lib/discovery";

export default function HomeNewThisWeek() {
  const items = discoveryItems.filter((item) => item.kind === "track" && item.image).slice(5, 9);
  return (
    <section className="border-y border-white/10 bg-white/[.015] px-4 py-8 sm:px-6 sm:py-10" aria-labelledby="home-new-title">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-brand">From the BVS collection</p>
            <h2 id="home-new-title" className="mt-1 text-2xl font-semibold sm:text-3xl">Worth a listen.</h2>
            <p className="mt-1.5 text-sm text-text-secondary">Independent sounds and discoveries to add to your rotation.</p>
          </div>
          <Link href="/search" className="text-sm font-semibold text-brand hover:underline">Discover more →</Link>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => (
            <Link key={item.id} href={item.href} className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-black/15 p-3 hover:border-brand/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.image} alt="" loading="lazy" decoding="async" className="h-14 w-14 rounded-xl object-cover transition group-hover:scale-105" />
              <span className="min-w-0">
                <span className="block truncate font-semibold">{item.title}</span>
                <span className="mt-0.5 block truncate text-sm text-text-secondary">{item.subtitle}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
