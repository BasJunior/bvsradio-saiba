import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMobileRadioTracks, mobileCreatorSlug } from "@/lib/mobile-app";
import type { MobileSurface } from "@/lib/station-library";

export const dynamic = "force-dynamic";

export default async function MobileTrackPage({ params }: { params: Promise<{ surface: string; id: string }> }) {
  const { surface: rawSurface, id } = await params;
  if (rawSurface !== "ios" && rawSurface !== "android") notFound();
  const surface = rawSurface as MobileSurface;
  const tracks = await getMobileRadioTracks(surface);
  const track = tracks.find((item) => item.id === id);
  if (!track) notFound();
  const appHome = `/app/${surface}`;

  return (
    <div className="mx-auto max-w-3xl px-4 pb-12 pt-7 sm:px-6">
      <Link href={`${appHome}#catalogue`} className="text-sm text-brand hover:underline">← Back to mobile music</Link>
      <article className="mt-6 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[.025] p-5 sm:p-7">
        <div className="grid gap-6 sm:grid-cols-[12rem_minmax(0,1fr)] sm:items-center">
          <div className="relative aspect-square overflow-hidden rounded-2xl bg-white/5">
            {track.artwork ? <Image src={track.artwork} alt="" fill unoptimized className="object-cover" /> : <span className="absolute inset-0 grid place-items-center text-2xl font-semibold text-brand">BVS</span>}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-emerald-200">Mobile-cleared recording</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{track.title}</h1>
            <Link href={`${appHome}/artist/${mobileCreatorSlug(track.artist)}`} className="mt-2 inline-block text-lg text-text-secondary hover:text-brand">{track.artist}</Link>
            <p className="mt-3 text-sm text-text-secondary">{track.project || "BVS mobile rotation"}{track.genre ? ` · ${track.genre}` : ""}</p>
          </div>
        </div>
        <audio controls preload="metadata" src={track.src} className="mt-7 h-11 w-full" aria-label={`Play ${track.title}`} />
        <p className="mt-4 text-xs leading-5 text-text-secondary">This detail route is built only from the same surface-specific cleared response used by the mobile radio queue. If the item is no longer cleared, this page returns not found rather than falling back to the website catalogue.</p>
      </article>
    </div>
  );
}
