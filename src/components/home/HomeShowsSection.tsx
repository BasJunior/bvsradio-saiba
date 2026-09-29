import Image from "next/image";
import Link from "next/link";
import { getPublicProgrammes } from "@/lib/station-content";

export default async function HomeShowsSection() {
  const shows = await getPublicProgrammes();

  return (
    <section data-home-accent="shows" className="border-y border-white/10 bg-bg-secondary/65 py-10 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-3xl">
            <p className="bvs-home-accent-label text-xs font-semibold uppercase tracking-[.2em]">Shows on BVS</p>
            <h2 className="mt-2 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">More than a playlist.</h2>
            <p className="mt-3 text-sm text-text-secondary sm:text-base">Programmes, conversations and replay moments built around the music and the people making it.</p>
          </div>
          <Link href="/shows" data-home-accent="shows" className="bvs-home-accent-button rounded-full border px-4 py-2 text-sm font-semibold">View all shows →</Link>
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
                    <p className="bvs-home-accent-label text-[10px] font-semibold uppercase tracking-[.17em]">{show.schedule}</p>
                    <h3 className={`mt-2 font-semibold text-white ${featured ? "text-2xl sm:text-3xl" : "text-xl"}`}>{show.title}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-white/70">{show.tagline}</p>
                    <p className="bvs-home-accent-label mt-3 text-sm font-semibold">Open show →</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
