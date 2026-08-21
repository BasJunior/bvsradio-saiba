import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import RadioPlayer from "@/components/RadioPlayer";
import {
  getMobilePublishedBeats,
  getMobileRadioTracks,
  mobileCreatorSlug,
} from "@/lib/mobile-app";
import type { MobileSurface } from "@/lib/station-library";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "BVS Radio App",
  description: "The curated BVS Radio mobile edition.",
};

export default async function MobileAppPage({ params }: { params: Promise<{ surface: string }> }) {
  const { surface: rawSurface } = await params;
  if (rawSurface !== "ios" && rawSurface !== "android") notFound();
  const surface = rawSurface as MobileSurface;
  const [tracks, beats] = await Promise.all([
    getMobileRadioTracks(surface),
    getMobilePublishedBeats(surface, 12),
  ]);
  const isIos = surface === "ios";
  const appHome = `/app/${surface}`;

  return (
    <div className="mx-auto max-w-5xl px-4 pb-12 pt-7 sm:px-6">
      <section className="overflow-hidden rounded-[2rem] border border-brand/20 bg-gradient-to-br from-brand/[.14] via-white/[.035] to-transparent p-6 sm:p-9">
        <div className="flex items-start justify-between gap-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.24em] text-brand">BVS Radio · {isIos ? "iOS" : "Android"} edition</p>
            <h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">BVS Radio, made for listening on the go.</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-text-secondary sm:text-base">
              Stream the BVS mobile rotation, discover cleared releases and explore rights-confirmed producer beats in a focused listener experience.
            </p>
          </div>
          <Image src="/branding/bvs-logo.png" alt="BVS Radio" width={132} height={72} className="hidden h-16 w-auto rounded-xl object-contain sm:block" priority />
        </div>
        <div className="mt-6 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-emerald-400/10 px-3 py-1.5 text-emerald-200">Curated by BVS</span>
          <span className="rounded-full border border-white/10 px-3 py-1.5 text-text-secondary">{tracks.length} cleared recording{tracks.length === 1 ? "" : "s"}</span>
          <span className="rounded-full border border-white/10 px-3 py-1.5 text-text-secondary">Fail-closed mobile catalogue</span>
        </div>
      </section>

      <section id="listen" className="mt-7 scroll-mt-24">
        <RadioPlayer />
      </section>

      <section id="catalogue" className="mt-10 scroll-mt-24">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[.2em] text-brand">Featured music</p>
            <h2 className="mt-1 text-3xl font-semibold">Listen on {isIos ? "iPhone and iPad" : "Android"}</h2>
          </div>
          <Link href={`${appHome}/account`} className="rounded-full border border-white/15 px-4 py-2 text-xs text-text-secondary">Account</Link>
        </div>

        {tracks.length ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {tracks.map((track, index) => {
              const trackHref = track.id ? `${appHome}/track/${encodeURIComponent(track.id)}` : `${appHome}#listen`;
              const artistHref = `${appHome}/artist/${mobileCreatorSlug(track.artist)}`;
              return (
                <article key={track.id || `${track.src}-${index}`} className="flex min-w-0 items-center gap-4 rounded-2xl border border-white/10 bg-white/[.025] p-3">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white/5">
                    {track.artwork ? <Image src={track.artwork} alt="" fill unoptimized className="object-cover" /> : <span className="absolute inset-0 grid place-items-center text-xs text-brand">BVS</span>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link href={trackHref} className="block truncate font-medium hover:text-brand">{track.title}</Link>
                    <Link href={artistHref} className="block truncate text-sm text-text-secondary hover:text-brand">{track.artist}</Link>
                    <p className="mt-1 text-[11px] text-emerald-200">Cleared for the BVS {isIos ? "iOS" : "Android"} edition</p>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-white/15 p-8 text-center">
            <h3 className="font-medium">No mobile-cleared recordings are available right now</h3>
            <p className="mt-2 text-sm text-text-secondary">The app does not fall back to the wider website archive when mobile rights clearance is unavailable.</p>
          </div>
        )}
      </section>

      <section id="beats" className="mt-10 scroll-mt-24">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[.2em] text-brand">BVS BeatStore</p>
            <h2 className="mt-1 text-3xl font-semibold">Rights-confirmed producer beats</h2>
            <p className="mt-2 max-w-2xl text-sm text-text-secondary">Only published, public BeatStore listings with producer rights confirmation and an active licence are discoverable here.</p>
          </div>
        </div>

        {beats.length ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {beats.map((beat) => (
              <article key={beat.id} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[.025] p-4">
                <div className="flex min-w-0 gap-4">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-white/5">
                    {beat.artworkUrl ? <Image src={beat.artworkUrl} alt="" fill unoptimized className="object-cover" /> : <span className="absolute inset-0 grid place-items-center text-xs text-brand">BEAT</span>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link href={`${appHome}/beat/${encodeURIComponent(beat.id)}`} className="block truncate font-medium hover:text-brand">{beat.title}</Link>
                    <Link href={`${appHome}/artist/${beat.producerSlug}`} className="block truncate text-sm text-text-secondary hover:text-brand">{beat.producer}</Link>
                    <p className="mt-1 text-xs text-text-secondary">
                      {[beat.genre, beat.mood, beat.bpm ? `${beat.bpm} BPM` : null].filter(Boolean).join(" · ") || "Published beat"}
                    </p>
                    {beat.startingPrice != null ? <p className="mt-1 text-xs text-emerald-200">Licences from ${beat.startingPrice.toFixed(2)}</p> : null}
                  </div>
                </div>
                {beat.previewUrl ? <audio controls preload="none" src={beat.previewUrl} className="mt-4 h-10 w-full" aria-label={`Preview ${beat.title}`} /> : <p className="mt-4 text-xs text-text-secondary">Preview unavailable in the mobile edition.</p>}
                <Link href={`${appHome}/beat/${encodeURIComponent(beat.id)}`} className="mt-4 block rounded-full border border-brand/50 px-4 py-2 text-center text-sm font-semibold text-brand">Beat details</Link>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-white/15 p-8 text-center">
            <h3 className="font-medium">No rights-confirmed BeatStore listings are available right now</h3>
            <p className="mt-2 text-sm text-text-secondary">Incomplete rights or licence records are excluded from mobile discovery.</p>
          </div>
        )}
      </section>

      <section className="mt-10 grid gap-3 sm:grid-cols-3">
        <Link href={`${appHome}/artists`} className="rounded-2xl border border-white/10 p-5"><p className="text-xs uppercase tracking-wider text-brand">Artists</p><p className="mt-2 font-medium">Creators in this mobile edition →</p></Link>
        <a href="https://bvsradio.com/articles" target="_blank" rel="noopener noreferrer" className="rounded-2xl border border-white/10 p-5"><p className="text-xs uppercase tracking-wider text-brand">BVS website</p><p className="mt-2 font-medium">Open editorial stories externally ↗</p></a>
        <a href="https://bvsradio.com/contact" target="_blank" rel="noopener noreferrer" className="rounded-2xl border border-white/10 p-5"><p className="text-xs uppercase tracking-wider text-brand">Support</p><p className="mt-2 font-medium">Contact BVS externally ↗</p></a>
      </section>
    </div>
  );
}
