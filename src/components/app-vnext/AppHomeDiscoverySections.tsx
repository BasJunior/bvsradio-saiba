import Image from "next/image";
import Link from "next/link";
import { getPublishedArtists } from "@/lib/artist-content";
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
  const [artistRows, shows] = await Promise.all([
    withTimeout(getPublishedArtists(), []),
    withTimeout(getPublicProgrammes(), []),
  ]);
  const artists = fairDailyOrder(artistRows, "artists");
  const base = `/app/${surface}`;

  return (
    <>
      {artists.length ? (
        <section className="mt-11">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-brand">On our radar</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Artists worth knowing.</h2>
            </div>
            <Link href={`${base}/explore`} className="shrink-0 text-sm font-semibold text-white/58 transition hover:text-brand">See all →</Link>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
            {artists.slice(0, 6).map((artist) => (
              <Link
                key={artist.id}
                href={`${base}/creator/${encodeURIComponent(artist.id)}`}
                className="group min-w-0 rounded-[1.4rem] border border-white/[.07] bg-white/[.025] p-2.5 transition hover:-translate-y-0.5 hover:border-white/15 hover:bg-white/[.045]"
              >
                <div className="relative aspect-square overflow-hidden rounded-[1.05rem] bg-white/[.04]">
                  {artist.image ? (
                    <Image src={artist.image} alt="" fill unoptimized className="object-cover transition duration-500 group-hover:scale-[1.025]" />
                  ) : (
                    <span className="absolute inset-0 grid place-items-center text-[10px] font-semibold uppercase tracking-[.16em] text-brand">Artist</span>
                  )}
                </div>
                <h3 className="mt-3 truncate px-1 font-semibold">{artist.name}</h3>
                <p className="truncate px-1 pb-1 text-xs text-white/38">{artist.role}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {shows.length ? (
        <section className="mt-12">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-brand">Live energy</p>
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
                  <Image src={show.image} alt="" fill className="object-cover transition duration-500 group-hover:scale-[1.015]" />
                  <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/55 to-transparent" />
                </div>
                <div className="p-4">
                  <p className="text-xs font-medium text-brand">{show.schedule}</p>
                  <h3 className="mt-1 text-xl font-semibold">{show.title}</h3>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/45">{show.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : (
        <section className="mt-12">
          <Link href={`${base}/rooms`} className="block rounded-[1.65rem] border border-white/[.07] bg-white/[.025] p-5 transition hover:border-brand/25">
            <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-brand">Live rooms</p>
            <h2 className="mt-2 text-2xl font-semibold">Listen together when something is happening.</h2>
          </Link>
        </section>
      )}
    </>
  );
}
