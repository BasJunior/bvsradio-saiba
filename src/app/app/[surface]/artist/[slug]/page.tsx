import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMobilePublishedBeats, getMobileRadioTracks, mobileCreatorSlug } from "@/lib/mobile-app";
import type { MobileSurface } from "@/lib/station-library";

export const dynamic = "force-dynamic";

export default async function MobileCreatorPage({ params }: { params: Promise<{ surface: string; slug: string }> }) {
  const { surface: rawSurface, slug } = await params;
  if (rawSurface !== "ios" && rawSurface !== "android") notFound();
  const surface = rawSurface as MobileSurface;
  const [tracks, beats] = await Promise.all([
    getMobileRadioTracks(surface),
    getMobilePublishedBeats(surface, 100),
  ]);
  const creatorTracks = tracks.filter((track) => mobileCreatorSlug(track.artist) === slug);
  const creatorBeats = beats.filter((beat) => beat.producerSlug === slug);
  if (!creatorTracks.length && !creatorBeats.length) notFound();
  const displayName = creatorTracks[0]?.artist || creatorBeats[0]?.producer || "BVS creator";
  const image = creatorTracks.find((track) => track.artwork)?.artwork || creatorBeats.find((beat) => beat.artworkUrl)?.artworkUrl;
  const appHome = `/app/${surface}`;

  return (
    <div className="mx-auto max-w-4xl px-4 pb-12 pt-7 sm:px-6">
      <Link href={`${appHome}/artists`} className="text-sm text-brand hover:underline">← Back to mobile creators</Link>
      <header className="mt-6 flex items-center gap-5 rounded-[2rem] border border-white/10 bg-white/[.025] p-5 sm:p-7">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-white/5 sm:h-28 sm:w-28">
          {image ? <Image src={image} alt="" fill unoptimized className="object-cover" /> : <span className="absolute inset-0 grid place-items-center text-xl font-semibold text-brand">BVS</span>}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-brand">Mobile creator profile</p>
          <h1 className="mt-2 truncate text-3xl font-semibold sm:text-4xl">{displayName}</h1>
          <p className="mt-2 text-sm text-text-secondary">Only objects already admitted to this mobile edition appear below.</p>
        </div>
      </header>

      {creatorTracks.length ? (
        <section className="mt-8">
          <h2 className="text-2xl font-semibold">Cleared recordings</h2>
          <div className="mt-4 space-y-3">
            {creatorTracks.map((track) => (
              <Link key={track.id || track.src} href={track.id ? `${appHome}/track/${encodeURIComponent(track.id)}` : `${appHome}#listen`} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[.025] p-4 hover:border-brand/40">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-white/5">
                  {track.artwork ? <Image src={track.artwork} alt="" fill unoptimized className="object-cover" /> : null}
                </div>
                <div className="min-w-0"><h3 className="truncate font-medium">{track.title}</h3><p className="truncate text-xs text-text-secondary">{track.project || "BVS mobile rotation"}</p></div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {creatorBeats.length ? (
        <section className="mt-8">
          <h2 className="text-2xl font-semibold">Rights-confirmed beats</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {creatorBeats.map((beat) => (
              <Link key={beat.id} href={`${appHome}/beat/${encodeURIComponent(beat.id)}`} className="rounded-2xl border border-white/10 bg-white/[.025] p-4 hover:border-brand/40">
                <h3 className="font-medium">{beat.title}</h3>
                <p className="mt-2 text-xs text-text-secondary">{[beat.genre, beat.bpm ? `${beat.bpm} BPM` : null].filter(Boolean).join(" · ") || "Published beat"}</p>
                {beat.startingPrice != null ? <p className="mt-2 text-xs text-emerald-200">Licences from ${beat.startingPrice.toFixed(2)}</p> : null}
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
