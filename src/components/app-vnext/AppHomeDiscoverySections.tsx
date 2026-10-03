import Image from "next/image";
import { shouldBypassImageOptimizer } from "@/lib/image-optimization";
import Link from "next/link";
import { getPublishedArtists, getPublishedProducers } from "@/lib/artist-content";
import CreatorPortraitRail from "@/components/home/CreatorPortraitRail";
import { fairDailyOrder } from "@/lib/fair-discovery-order";
import { getPublicProgrammes } from "@/lib/station-content";
import type { MobileSurface } from "@/lib/station-library";

const DISCOVERY_TIMEOUT_MS = 2200;

async function withTimeout<T>(work: Promise<T>, fallback: T): Promise<T> {
  return Promise.race([
    work.catch(() => fallback),
    new Promise<T>((resolve) => {
      setTimeout(() => resolve(fallback), DISCOVERY_TIMEOUT_MS);
    }),
  ]);
}

export default async function AppHomeDiscoverySections({ surface }: { surface: MobileSurface }) {
  const [artistRows, producerRows, shows] = await Promise.all([
    withTimeout(getPublishedArtists(), []),
    withTimeout(getPublishedProducers(), []),
    withTimeout(getPublicProgrammes(), []),
  ]);
  const artists = fairDailyOrder(artistRows, "artists");
  const producers = fairDailyOrder(producerRows, "producers");
  const base = `/app/${surface}`;

  return (
    <>
      <div data-home-accent="discover" className="bvs-app-creator-bands">
        <CreatorPortraitRail title="Artists" tone="charcoal" allHref={`${base}/explore?kind=artists`} items={artists.slice(0, 18).map(artist => ({ id: artist.id, name: artist.name, image: artist.image, href: `${base}/creator/${encodeURIComponent(artist.id)}`, detail: `${artist.trackCount} published ${artist.trackCount === 1 ? "track" : "tracks"}` }))} />
        <CreatorPortraitRail title="Producers" tone="ink" accent="purple" allHref={`${base}/explore?kind=producers`} items={producers.slice(0, 18).map(producer => ({ id: producer.id, name: producer.name, image: producer.image, href: `${base}/creator/${encodeURIComponent(producer.id)}`, detail: `${producer.beatCount} ${producer.beatCount === 1 ? "beat" : "beats"} · BeatStore` }))} />
      </div>

      {shows.length ? (
        <section data-home-accent="shows" className="mt-12">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="bvs-home-accent-label text-[10px] font-semibold uppercase tracking-[.2em]">Live energy</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Shows, rooms, conversations.</h2>
            </div>
            <Link href={`${base}/rooms`} className="shrink-0 text-sm font-semibold text-white/58 transition hover:text-brand">Open rooms →</Link>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shows.slice(0, 3).map((show) => (
              <Link
                key={show.slug}
                href={`${base}/show/${show.slug}`}
                className="group overflow-hidden rounded-[1.65rem] border border-white/[.07] bg-white/[.025] transition hover:border-white/15 hover:bg-white/[.04]"
              >
                <div className="relative aspect-[16/9] bg-white/[.04]">
                  <Image src={show.image} alt="" fill unoptimized={shouldBypassImageOptimizer(show.image)} className="object-cover transition duration-500 group-hover:scale-[1.015]" />
                  <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/55 to-transparent" />
                </div>
                <div className="p-4">
                  <p className="bvs-home-accent-label text-xs font-medium">{show.schedule}</p>
                  <h3 className="mt-1 text-xl font-semibold">{show.title}</h3>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/45">{show.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : (
        <section className="mt-12">
          <Link href={`${base}/rooms`} data-home-accent="shows" className="bvs-home-accent-card block rounded-[1.65rem] border border-white/[.07] bg-white/[.025] p-5">
            <p className="bvs-home-accent-label text-[10px] font-semibold uppercase tracking-[.2em]">Live rooms</p>
            <h2 className="mt-2 text-2xl font-semibold">Listen together when something is happening.</h2>
          </Link>
        </section>
      )}
    </>
  );
}
