import Image from "next/image";
import Link from "next/link";
import { getPublishedProducers } from "@/lib/artist-content";

export const metadata = {
  title: "Producers",
  description: "Discover verified BVS producers and their published beats.",
};

export default async function ProducersDirectoryPage() {
  const producers = await getPublishedProducers();
  return (
    <main className="mx-auto min-h-[70vh] max-w-6xl px-6 py-12">
      <p className="text-xs uppercase tracking-[.25em] text-brand">
        BVS BeatStore
      </p>
      <h1 className="mt-2 text-4xl font-semibold md:text-5xl">
        Published producers
      </h1>
      <p className="mt-3 max-w-2xl text-text-secondary">
        Explore verified producers and every beat they have published through
        BVS editorial.
      </p>
      <div className="mt-6 flex gap-3">
        <Link
          href="/catalogue?type=beat#beatstore"
          className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-black"
        >
          Browse all beats
        </Link>
        <Link
          href="/music/artists"
          className="rounded-full border border-white/15 px-5 py-2 text-sm"
        >
          View artists
        </Link>
      </div>
      {producers.length ? (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {producers.map((producer) => (
            <article
              key={producer.id}
              className="overflow-hidden rounded-2xl border border-white/10 bg-white/[.03]"
            >
              <Link href={`/artist/${producer.username}?as=producer`}>
                <div className="relative aspect-square overflow-hidden bg-black/40">
                  <Image
                    src={producer.image}
                    alt={producer.name}
                    fill
                    unoptimized={/^https?:\/\//i.test(producer.image)}
                    sizes="(max-width:768px) 100vw, 33vw"
                    className="object-cover object-center transition duration-300 group-hover:scale-[1.04]"
                  />
                </div>
                <div className="p-5">
                  <p className="text-[10px] uppercase tracking-[.2em] text-brand">
                    Verified producer
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold">
                    {producer.name}
                  </h2>
                  <p className="mt-2 text-sm text-text-secondary">
                    {producer.beatCount} published{" "}
                    {producer.beatCount === 1 ? "beat" : "beats"}
                    {producer.genres.length
                      ? ` · ${producer.genres.join(" · ")}`
                      : ""}
                  </p>
                </div>
              </Link>
              <div className="px-5 pb-5">
                <Link
                  href={`/catalogue?type=beat&producer=${encodeURIComponent(producer.username)}#browse`}
                  className="text-sm text-brand"
                >
                  View this producer’s catalogue →
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-10 rounded-2xl border border-dashed border-white/15 p-10 text-center">
          <h2 className="text-xl">No producer profiles are published yet</h2>
          <p className="mt-2 text-text-secondary">
            They will appear after verification and their first published beat.
          </p>
        </div>
      )}
    </main>
  );
}
