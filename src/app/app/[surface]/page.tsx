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
export const metadata: Metadata = { title: "BVS App vNext", description: "Listen, follow and create across BVS." };

export default async function MobileAppPage({ params }: { params: Promise<{ surface: string }> }) {
  const raw = (await params).surface;
  if (raw !== "ios" && raw !== "android") notFound();
  const surface = raw as MobileSurface;
  const [tracks, artists, shows] = await Promise.all([getStationTracks(surface), getPublishedArtists(), getPublicProgrammes()]);
  const base = `/app/${surface}`;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-10 pt-6 sm:px-6">
      <section className="overflow-hidden rounded-[2rem] border border-brand/20 bg-gradient-to-br from-brand/[.14] via-white/[.035] to-transparent p-5 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[.22em] text-brand">Best Virtual Sound · {surface === "ios" ? "iOS" : "Android"} vNext</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">Listen to Zimbabwe. Follow the people making it. Become one of them.</h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-text-secondary sm:text-base">BVS brings listening, creator identity, shows, BeatStore and Studio into one account that grows with you.</p>
        <div className="mt-5 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-emerald-400/10 px-3 py-1.5 text-emerald-200">Rights-cleared mobile catalogue</span><span className="rounded-full border border-white/10 px-3 py-1.5 text-text-secondary">{tracks.length} app recording{tracks.length === 1 ? "" : "s"}</span><span className="rounded-full border border-white/10 px-3 py-1.5 text-text-secondary">One BVS identity</span></div>
      </section>

      <section id="listen" className="mt-5 scroll-mt-24"><RadioPlayer /></section>
      <div className="mt-5"><AppJoinCard surface={surface} /></div>

      <section className="mt-9"><div className="flex items-end justify-between gap-3"><div><p className="text-xs uppercase tracking-[.18em] text-brand">Your next discovery</p><h2 className="mt-1 text-2xl font-semibold sm:text-3xl">People before algorithms.</h2></div><Link href={`${base}/explore`} className="shrink-0 text-sm font-semibold text-brand">Explore →</Link></div><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">{artists.slice(0, 6).map((artist) => <Link key={artist.id} href={`/artist/${artist.username}`} className="min-w-0 rounded-2xl border border-white/10 bg-white/[.025] p-3 hover:border-brand/30"><div className="relative aspect-square overflow-hidden rounded-xl bg-white/5">{artist.image ? <Image src={artist.image} alt="" fill unoptimized className="object-cover" /> : <span className="absolute inset-0 grid place-items-center text-xs text-brand">ARTIST</span>}</div><h3 className="mt-3 truncate font-semibold">{artist.name}</h3><p className="truncate text-xs text-text-secondary">{artist.role}</p></Link>)}</div></section>

      {shows.length ? <section className="mt-9"><div className="flex items-end justify-between gap-3"><div><p className="text-xs uppercase tracking-[.18em] text-brand">Shows & rooms</p><h2 className="mt-1 text-2xl font-semibold sm:text-3xl">Be there when the scene meets.</h2></div><Link href="/shows" className="shrink-0 text-sm font-semibold text-brand">All shows →</Link></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{shows.slice(0, 3).map((show) => <Link key={show.slug} href={`/shows/${show.slug}`} className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[.025] hover:border-brand/30"><div className="relative aspect-[16/9] bg-white/5"><Image src={show.image} alt="" fill className="object-cover" /></div><div className="p-4"><p className="text-xs text-brand">{show.schedule}</p><h3 className="mt-1 text-lg font-semibold">{show.title}</h3><p className="mt-1 line-clamp-2 text-sm text-text-secondary">{show.description}</p></div></Link>)}</div></section> : null}

      <section className="mt-9 grid gap-3 sm:grid-cols-3"><Link href={`${base}/library`} className="rounded-[1.5rem] border border-white/10 bg-white/[.025] p-5 hover:border-brand/30"><p className="text-xs uppercase tracking-[.16em] text-brand">Library</p><h2 className="mt-2 text-xl font-semibold">Keep your path.</h2><p className="mt-2 text-sm text-text-secondary">Saved music, follows and listening history.</p></Link><Link href={`${base}/studio`} className="rounded-[1.5rem] border border-white/10 bg-white/[.025] p-5 hover:border-brand/30"><p className="text-xs uppercase tracking-[.16em] text-brand">Create</p><h2 className="mt-2 text-xl font-semibold">Turn listener into creator.</h2><p className="mt-2 text-sm text-text-secondary">Use the same BVS identity for releases, beats and work.</p></Link><Link href={`${base}/you`} className="rounded-[1.5rem] border border-white/10 bg-white/[.025] p-5 hover:border-brand/30"><p className="text-xs uppercase tracking-[.16em] text-brand">You</p><h2 className="mt-2 text-xl font-semibold">Control the experience.</h2><p className="mt-2 text-sm text-text-secondary">Account, data mode, notifications and roles.</p></Link></section>
    </div>
  );
}
