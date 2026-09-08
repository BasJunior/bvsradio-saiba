import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import AppShareButton from "@/components/app-vnext/AppShareButton";
import { listPublishedBeats, publicStorageUrl } from "@/lib/beatstore-server";
import { getPublishedProducers } from "@/lib/artist-content";

export const dynamic = "force-dynamic";

export default async function AppBeatPage({ params }: { params: Promise<{ surface: string; id: string }> }) {
  const { surface, id } = await params;
  if (surface !== "ios" && surface !== "android") notFound();
  const [beats, producers] = await Promise.all([listPublishedBeats(160), getPublishedProducers()]);
  const beat = beats.find((item) => item.id === id);
  if (!beat) notFound();
  const producer = producers.find((item) => item.id === beat.producer_user_id);
  const producerName = producer?.name || "BVS producer";
  const producerHandle = String(producer?.username || "").trim();
  const artwork = publicStorageUrl(beat.artwork_path);
  const preview = publicStorageUrl(beat.preview_path);
  const licences = (beat.beat_licence_options || [])
    .filter((licence) => licence.is_active !== false && !licence.is_sold_out)
    .sort((a, b) => Number(a.price_usd) - Number(b.price_usd));
  const primaryLicence = licences[0];
  const licenceCheckoutHref = (licenceId: string) =>
    `https://bvsradio.com/buy/beat/${encodeURIComponent(beat.id)}/${encodeURIComponent(licenceId)}`;

  return <div className="mx-auto max-w-4xl px-4 pb-12 pt-6 sm:px-6">
    <Link href={`/app/${surface}/explore`} className="text-sm text-text-secondary">← Explore</Link>
    <section className="mt-5 grid gap-6 sm:grid-cols-[240px,1fr] sm:items-start">
      <div className="relative aspect-square overflow-hidden rounded-[1.8rem] border border-white/10 bg-white/5">{artwork ? <Image src={artwork} alt="" fill unoptimized className="object-cover" priority /> : <div className="absolute inset-0 grid place-items-center text-brand">BVS BEAT</div>}</div>
      <div>
        <p className="text-xs uppercase tracking-[.2em] text-brand">BeatStore · published</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">{beat.title}</h1>
        <p className="mt-2 text-sm text-text-secondary">{producerHandle ? <Link href={`/app/${surface}/creator/${producerHandle}?as=producer`} className="text-white hover:text-brand">{producerName}</Link> : producerName}</p>
        <p className="mt-3 text-sm text-text-secondary">{[beat.genre, beat.mood, beat.bpm ? `${beat.bpm} BPM` : "", beat.musical_key].filter(Boolean).join(" · ")}</p>
        {beat.description ? <p className="mt-4 text-sm leading-6 text-text-secondary">{beat.description}</p> : null}
        <div className="mt-5 flex flex-wrap gap-2">
          <AppShareButton title={beat.title} text={`${beat.title} by ${producerName} on BVS BeatStore`} path={`/app/${surface}/beat/${beat.id}`} />
          <a href={`https://bvsradio.com/beat/${encodeURIComponent(beat.id)}`} target="_blank" rel="noopener noreferrer" className="min-h-10 rounded-full border border-brand/35 px-4 py-2 text-sm font-semibold text-brand">Open on BVS web</a>
        </div>
      </div>
    </section>

    {preview ? <section className="mt-8 rounded-[1.75rem] border border-brand/20 bg-brand/[.05] p-5">
      <p className="text-xs uppercase tracking-[.18em] text-brand">Preview</p>
      <audio controls preload="metadata" src={preview} className="mt-3 w-full" />
      {primaryLicence?.id ? <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/15 p-4">
        <div>
          <p className="text-sm font-semibold">Ready to use this beat?</p>
          <p className="mt-1 text-xs text-text-secondary">Choose a licence on BVS web. Checkout opens outside the app.</p>
        </div>
        <a href={licenceCheckoutHref(String(primaryLicence.id))} target="_blank" rel="noopener noreferrer" className="min-h-10 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-black">Buy {primaryLicence.licence_name || "licence"} · ${Number(primaryLicence.price_usd).toFixed(2)}</a>
      </div> : null}
    </section> : null}

    <section className="mt-8">
      <p className="text-xs uppercase tracking-[.18em] text-brand">Licences</p>
      <h2 className="mt-1 text-2xl font-semibold">Choose how you want to build.</h2>
      <p className="mt-2 text-sm text-text-secondary">Every option below opens the canonical BVS website with this exact beat and licence tier selected.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">{licences.map((licence) => <div key={licence.id} className="rounded-2xl border border-white/10 bg-white/[.025] p-4">
        <h3 className="font-semibold">{licence.licence_name}</h3>
        <p className="mt-1 text-2xl font-semibold text-brand">${Number(licence.price_usd).toFixed(2)}</p>
        <p className="mt-2 text-xs text-text-secondary">{licence.terms_summary || "Licence terms are shown before purchase."}</p>
        {licence.id ? <a href={licenceCheckoutHref(String(licence.id))} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-10 items-center rounded-full bg-white px-4 text-sm font-semibold text-black hover:bg-brand">Buy this licence on web →</a> : null}
      </div>)}</div>
      {!licences.length ? <p className="mt-4 rounded-xl border border-dashed border-white/10 p-4 text-sm text-text-secondary">Licence options are temporarily unavailable for this beat.</p> : null}
    </section>
  </div>;
}
