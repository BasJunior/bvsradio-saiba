import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import RadioPlayer from "@/components/RadioPlayer";
import { beatHeaders, beatUrl, listPublishedBeats, publicStorageUrl } from "@/lib/beatstore-server";
import { creatorPublicName } from "@/lib/public-name";
import { getStationTracks, type MobileSurface } from "@/lib/station-library";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "BVS Radio App",
  description: "The curated BVS Radio mobile edition.",
};

async function getPublishedBeats() {
  const beats = await listPublishedBeats(12);
  const producerIds = [...new Set(beats.map((beat) => beat.producer_user_id))];
  const response = producerIds.length
    ? await fetch(
        beatUrl(`profiles?id=in.(${producerIds.join(",")})&select=id,username,creator_public_name,creator_name_status`),
        { headers: beatHeaders, cache: "no-store" },
      )
    : null;
  const producers = response?.ok
    ? await response.json() as Array<{ id: string; username?: string; creator_public_name?: string; creator_name_status?: string }>
    : [];

  return beats.map((beat) => {
    const producer = producers.find((item) => item.id === beat.producer_user_id);
    const prices = (beat.beat_licence_options || [])
      .filter((licence) => licence.is_active !== false && !licence.is_sold_out)
      .map((licence) => Number(licence.price_usd))
      .filter((price) => Number.isFinite(price) && price > 0);
    return {
      ...beat,
      producer: creatorPublicName({
        publicName: producer?.creator_public_name,
        publicNameStatus: producer?.creator_name_status,
        username: producer?.username,
      }),
      artworkUrl: publicStorageUrl(beat.artwork_path),
      previewUrl: publicStorageUrl(beat.preview_path),
      startingPrice: prices.length ? Math.min(...prices) : 29,
    };
  });
}

export default async function MobileAppPage({ params }: { params: Promise<{ surface: string }> }) {
  const { surface: rawSurface } = await params;
  if (rawSurface !== "ios" && rawSurface !== "android") notFound();
  const surface = rawSurface as MobileSurface;
  const [tracks, beats] = await Promise.all([getStationTracks(surface), getPublishedBeats()]);
  const isIos = surface === "ios";

  return (
    <div className="mx-auto max-w-5xl px-4 pb-12 pt-7 sm:px-6">
      <section className="overflow-hidden rounded-[2rem] border border-brand/20 bg-gradient-to-br from-brand/[.14] via-white/[.035] to-transparent p-6 sm:p-9">
        <div className="flex items-start justify-between gap-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.24em] text-brand">BVS Radio · {isIos ? "iOS" : "Android"} edition</p>
            <h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">BVS Radio, made for listening on the go.</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-text-secondary sm:text-base">
              Stream selected releases, discover artists and explore BVS stories in a focused mobile experience. Your account, library and creator identity stay connected across BVS Radio.
            </p>
          </div>
          <Image src="/branding/bvs-logo.png" alt="BVS Radio" width={132} height={72} className="hidden h-16 w-auto rounded-xl object-contain sm:block" priority />
        </div>
        <div className="mt-6 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-emerald-400/10 px-3 py-1.5 text-emerald-200">Curated by BVS</span>
          <span className="rounded-full border border-white/10 px-3 py-1.5 text-text-secondary">{tracks.length} recording{tracks.length === 1 ? "" : "s"}</span>
          <span className="rounded-full border border-white/10 px-3 py-1.5 text-text-secondary">Updated from BVS</span>
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
          <Link href="/account" className="rounded-full border border-white/15 px-4 py-2 text-xs text-text-secondary">Account</Link>
        </div>

        {tracks.length ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {tracks.map((track, index) => (
              <article key={track.id || `${track.src}-${index}`} className="flex min-w-0 items-center gap-4 rounded-2xl border border-white/10 bg-white/[.025] p-3">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white/5">
                  {track.artwork ? <Image src={track.artwork} alt="" fill unoptimized className="object-cover" /> : <span className="absolute inset-0 grid place-items-center text-xs text-brand">BVS</span>}
                </div>
                <div className="min-w-0">
                  <h3 className="truncate font-medium">{track.title}</h3>
                  <p className="truncate text-sm text-text-secondary">{track.artist}</p>
                  <p className="mt-1 text-[11px] text-emerald-200">Available in the BVS app</p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-white/15 p-8 text-center">
            <h3 className="font-medium">More music is on the way</h3>
            <p className="mt-2 text-sm text-text-secondary">The BVS team is preparing the next selection for this edition.</p>
          </div>
        )}
      </section>

      <section id="beats" className="mt-10 scroll-mt-24">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[.2em] text-brand">BVS BeatStore</p>
            <h2 className="mt-1 text-3xl font-semibold">Beats from BVS producers</h2>
            <p className="mt-2 max-w-2xl text-sm text-text-secondary">Preview published instrumentals and open the full listing to review licence options.</p>
          </div>
          <Link href="/catalogue?type=beat#beatstore" className="hidden rounded-full border border-white/15 px-4 py-2 text-xs text-text-secondary sm:block">All beats</Link>
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
                    <h3 className="truncate font-medium">{beat.title}</h3>
                    <p className="truncate text-sm text-text-secondary">{beat.producer || "BVS producer"}</p>
                    <p className="mt-1 text-xs text-text-secondary">
                      {[beat.genre, beat.mood, beat.bpm ? `${beat.bpm} BPM` : null].filter(Boolean).join(" · ") || "Published beat"}
                    </p>
                    <p className="mt-1 text-xs text-emerald-200">Licences from ${beat.startingPrice.toFixed(2)}</p>
                  </div>
                </div>
                {beat.previewUrl && <audio controls preload="none" src={beat.previewUrl} className="mt-4 h-10 w-full" aria-label={`Preview ${beat.title}`} />}
                <Link href={`/catalogue?type=beat&q=${encodeURIComponent(beat.title)}#beatstore`} className="mt-4 block rounded-full border border-brand/50 px-4 py-2 text-center text-sm font-semibold text-brand">View licence</Link>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-white/15 p-8 text-center">
            <h3 className="font-medium">Published beats will appear here</h3>
            <p className="mt-2 text-sm text-text-secondary">BeatStore listings are added after BVS Editorial approval.</p>
          </div>
        )}
      </section>

      <section className="mt-10 grid gap-3 sm:grid-cols-3">
        <Link href="/artists" className="rounded-2xl border border-white/10 p-5"><p className="text-xs uppercase tracking-wider text-brand">Artists</p><p className="mt-2 font-medium">Meet the BVS roster →</p></Link>
        <Link href="/articles" className="rounded-2xl border border-white/10 p-5"><p className="text-xs uppercase tracking-wider text-brand">Stories</p><p className="mt-2 font-medium">Read BVS Editorial →</p></Link>
        <Link href="/contact" className="rounded-2xl border border-white/10 p-5"><p className="text-xs uppercase tracking-wider text-brand">Support</p><p className="mt-2 font-medium">Contact BVS →</p></Link>
      </section>
    </div>
  );
}
