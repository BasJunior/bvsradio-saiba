import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import RadioPlayer from "@/components/RadioPlayer";
import AppJoinCard from "@/components/app-vnext/AppJoinCard";
import { getPublishedArtists } from "@/lib/artist-content";
import { getPublicProgrammes } from "@/lib/station-content";
import { getStationTracks, type MobileSurface } from "@/lib/station-library";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "BVS — Best Virtual Sound",
  description: "Listen, discover and create across BVS.",
};

export default async function MobileAppPage({ params }: { params: Promise<{ surface: string }> }) {
  const raw = (await params).surface;
  if (raw !== "ios" && raw !== "android") notFound();
  const surface = raw as MobileSurface;
  const [tracks, artists, shows] = await Promise.all([
    getStationTracks(surface),
    getPublishedArtists(),
    getPublicProgrammes(),
  ]);
  const base = `/app/${surface}`;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-12 pt-5 sm:px-6 sm:pt-8">
      <section className="relative overflow-hidden rounded-[2.2rem] border border-white/[.08] bg-[#111113]/72 px-5 py-7 shadow-[0_28px_90px_rgba(0,0,0,.35)] backdrop-blur-2xl sm:px-9 sm:py-10">
        <div className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full bg-brand/[.13] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-[18%] h-56 w-56 rounded-full bg-indigo-500/[.07] blur-3xl" />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[.22em]">
            <span className="text-brand">Best Virtual Sound</span>
            <span className="text-white/22">•</span>
            <span className="text-white/45">Built in Zimbabwe · Open to the world</span>
          </div>

          <h1 className="mt-5 max-w-4xl text-[2.8rem] font-semibold leading-[.98] tracking-[-.05em] sm:text-7xl">
            Music moves differently here.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/58 sm:text-lg">
            Listen to what’s next, follow the people behind it, and build your own path. BVS brings music, creators, live experiences and creative tools into one modern ecosystem.
          </p>

          <div className="mt-7 flex flex-wrap gap-2.5">
            <a href="#listen" className="inline-flex min-h-11 items-center rounded-full bg-white px-5 text-sm font-semibold text-black transition hover:bg-brand">
              Listen now
            </a>
            <Link href={`${base}/explore`} className="inline-flex min-h-11 items-center rounded-full border border-white/12 bg-white/[.035] px-5 text-sm font-semibold text-white/82 transition hover:border-brand/35 hover:text-white">
              Discover music
            </Link>
          </div>

          <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/42">
            <span><strong className="font-semibold text-white/76">{tracks.length}</strong> available recording{tracks.length === 1 ? "" : "s"}</span>
            <span>One identity from listener to creator</span>
            <span>Offline-ready where rights allow</span>
          </div>
        </div>
      </section>

      <section id="listen" className="mt-5 scroll-mt-24">
        <RadioPlayer />
      </section>

      <div className="mt-5">
        <AppJoinCard surface={surface} />
      </div>

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
              href={`${base}/creator/${artist.username}`}
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
                <div className="p-4.5 p-4">
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

      <section className="mt-12 grid gap-3 sm:grid-cols-3">
        <Link href={`${base}/library`} className="group rounded-[1.65rem] border border-white/[.07] bg-white/[.025] p-5 transition hover:border-white/15 hover:bg-white/[.04]">
          <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-brand">Library</p>
          <h2 className="mt-3 text-2xl font-semibold">Everything you want to come back to.</h2>
          <p className="mt-3 text-sm leading-6 text-white/42">Likes, playlists, follows, history and offline music in one place.</p>
          <span className="mt-5 inline-block text-sm font-semibold text-white/64 group-hover:text-brand">Open Library →</span>
        </Link>
        <Link href={`${base}/studio`} className="group rounded-[1.65rem] border border-brand/18 bg-brand/[.045] p-5 transition hover:border-brand/30 hover:bg-brand/[.07]">
          <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-brand">Studio</p>
          <h2 className="mt-3 text-2xl font-semibold">From listening to releasing.</h2>
          <p className="mt-3 text-sm leading-6 text-white/42">Create, submit, follow review, publish and understand what happens next.</p>
          <span className="mt-5 inline-block text-sm font-semibold text-brand">Enter Studio →</span>
        </Link>
        <Link href={`${base}/marketplace`} className="group rounded-[1.65rem] border border-white/[.07] bg-white/[.025] p-5 transition hover:border-white/15 hover:bg-white/[.04]">
          <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-brand">Marketplace</p>
          <h2 className="mt-3 text-2xl font-semibold">Find the people who move your work forward.</h2>
          <p className="mt-3 text-sm leading-6 text-white/42">Studios, production and creative services, connected to the same ecosystem.</p>
          <span className="mt-5 inline-block text-sm font-semibold text-white/64 group-hover:text-brand">Browse Marketplace →</span>
        </Link>
      </section>
    </div>
  );
}
