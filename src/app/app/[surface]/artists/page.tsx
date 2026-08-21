import Link from "next/link";
import { notFound } from "next/navigation";
import { getMobilePublishedBeats, getMobileRadioTracks, mobileCreatorSlug } from "@/lib/mobile-app";
import type { MobileSurface } from "@/lib/station-library";

export const dynamic = "force-dynamic";

export default async function MobileArtistsPage({ params }: { params: Promise<{ surface: string }> }) {
  const { surface: rawSurface } = await params;
  if (rawSurface !== "ios" && rawSurface !== "android") notFound();
  const surface = rawSurface as MobileSurface;
  const [tracks, beats] = await Promise.all([
    getMobileRadioTracks(surface),
    getMobilePublishedBeats(surface, 100),
  ]);
  const creators = new Map<string, { name: string; trackCount: number; beatCount: number }>();
  for (const track of tracks) {
    const slug = mobileCreatorSlug(track.artist);
    const current = creators.get(slug) || { name: track.artist, trackCount: 0, beatCount: 0 };
    current.trackCount += 1;
    creators.set(slug, current);
  }
  for (const beat of beats) {
    const current = creators.get(beat.producerSlug) || { name: beat.producer, trackCount: 0, beatCount: 0 };
    current.beatCount += 1;
    creators.set(beat.producerSlug, current);
  }
  const list = [...creators.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name));
  const appHome = `/app/${surface}`;

  return (
    <div className="mx-auto max-w-4xl px-4 pb-12 pt-7 sm:px-6">
      <Link href={appHome} className="text-sm text-brand hover:underline">← Back to BVS Radio</Link>
      <div className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-brand">Mobile creators</p>
        <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Artists and producers in this edition</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary">This directory is derived only from the mobile-cleared radio catalogue and rights-confirmed BeatStore listings. It does not import the wider website catalogue.</p>
      </div>
      {list.length ? (
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          {list.map(([slug, creator]) => (
            <Link key={slug} href={`${appHome}/artist/${slug}`} className="rounded-2xl border border-white/10 bg-white/[.025] p-5 hover:border-brand/40">
              <h2 className="font-semibold">{creator.name}</h2>
              <p className="mt-2 text-xs text-text-secondary">{creator.trackCount} cleared recording{creator.trackCount === 1 ? "" : "s"} · {creator.beatCount} rights-confirmed beat{creator.beatCount === 1 ? "" : "s"}</p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-7 rounded-2xl border border-dashed border-white/15 p-8 text-center text-sm text-text-secondary">No creators are available in the mobile edition right now.</div>
      )}
    </div>
  );
}
