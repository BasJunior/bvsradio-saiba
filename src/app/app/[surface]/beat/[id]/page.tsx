import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMobilePublishedBeats } from "@/lib/mobile-app";
import type { MobileSurface } from "@/lib/station-library";

export const dynamic = "force-dynamic";

export default async function MobileBeatPage({ params }: { params: Promise<{ surface: string; id: string }> }) {
  const { surface: rawSurface, id } = await params;
  if (rawSurface !== "ios" && rawSurface !== "android") notFound();
  const surface = rawSurface as MobileSurface;
  const beats = await getMobilePublishedBeats(surface, 100);
  const beat = beats.find((item) => item.id === id);
  if (!beat) notFound();
  const appHome = `/app/${surface}`;
  const webListing = `https://bvsradio.com/catalogue?type=beat&q=${encodeURIComponent(beat.title)}#beatstore`;

  return (
    <div className="mx-auto max-w-3xl px-4 pb-12 pt-7 sm:px-6">
      <Link href={`${appHome}#beats`} className="text-sm text-brand hover:underline">← Back to mobile BeatStore</Link>
      <article className="mt-6 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[.025] p-5 sm:p-7">
        <div className="grid gap-6 sm:grid-cols-[12rem_minmax(0,1fr)] sm:items-center">
          <div className="relative aspect-square overflow-hidden rounded-2xl bg-white/5">
            {beat.artworkUrl ? <Image src={beat.artworkUrl} alt="" fill unoptimized className="object-cover" /> : <span className="absolute inset-0 grid place-items-center text-xl font-semibold text-brand">BEAT</span>}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-emerald-200">Rights-confirmed BeatStore listing</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{beat.title}</h1>
            <Link href={`${appHome}/artist/${beat.producerSlug}`} className="mt-2 inline-block text-lg text-text-secondary hover:text-brand">{beat.producer}</Link>
            <p className="mt-3 text-sm text-text-secondary">{[beat.genre, beat.mood, beat.bpm ? `${beat.bpm} BPM` : null, beat.musicalKey].filter(Boolean).join(" · ") || "Published producer beat"}</p>
          </div>
        </div>

        {beat.previewUrl ? <audio controls preload="metadata" src={beat.previewUrl} className="mt-7 h-11 w-full" aria-label={`Preview ${beat.title}`} /> : <p className="mt-7 rounded-xl border border-dashed border-white/10 p-4 text-sm text-text-secondary">This listing has no first-party preview available in the mobile edition.</p>}

        <section className="mt-7 rounded-2xl border border-white/10 p-5">
          <h2 className="text-lg font-semibold">Available licence options</h2>
          <div className="mt-3 space-y-2">
            {beat.licences.map((licence) => (
              <div key={licence.id} className="flex items-center justify-between gap-4 rounded-xl bg-white/[.035] px-4 py-3 text-sm">
                <span>{licence.licence_name}</span>
                <span className="font-semibold text-emerald-200">${Number(licence.price_usd).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <a href={webListing} target="_blank" rel="noopener noreferrer" className="mt-5 block rounded-full border border-brand/50 px-4 py-2.5 text-center text-sm font-semibold text-brand">Open licence checkout on BVS website ↗</a>
          <p className="mt-3 text-xs leading-5 text-text-secondary">Licence purchase is a website commerce flow and is not embedded as third-party streaming or catalogue playback in the native listener surface.</p>
        </section>
      </article>
    </div>
  );
}
