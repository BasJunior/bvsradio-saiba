import Link from "next/link";
import { notFound } from "next/navigation";
import AppBeatPreviewPlayer from "@/components/app-vnext/AppBeatPreviewPlayer";
import AppShareButton from "@/components/app-vnext/AppShareButton";
import DetailHero, { DetailSection } from "@/components/DetailHero";
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
    `https://bvsradio.com/buy?beat=${encodeURIComponent(beat.id)}&licence=${encodeURIComponent(licenceId)}`;

  return <main className="bvs-app-page bvs-detail-page mx-auto max-w-4xl px-4 pb-14 sm:px-6" data-app-accent="beats">
    <DetailHero
      image={artwork}
      imageAlt={`${beat.title} artwork`}
      eyebrow="Beat"
      title={beat.title}
      subtitle={producerHandle ? <Link href={`/app/${surface}/creator/${producerHandle}?as=producer`}>{producerName}</Link> : producerName}
      facts={[beat.genre, beat.mood, beat.bpm ? `${beat.bpm} BPM` : null, beat.musical_key]}
      fallback="BEAT"
      actions={<>
        {primaryLicence?.id ? <a href={licenceCheckoutHref(String(primaryLicence.id))} target="_blank" rel="noopener noreferrer" className="bvs-app-pill bvs-app-pill--primary min-h-11 px-5">Buy {primaryLicence.licence_name || "licence"} · ${Number(primaryLicence.price_usd).toFixed(2)}</a> : null}
        <AppShareButton title={beat.title} text={`${beat.title} by ${producerName} on BVS BeatStore`} path={`/beat/${encodeURIComponent(beat.id)}`} image={artwork || undefined} kicker="BVS BeatStore" />
      </>}
    />
    {beat.description ? <p className="mx-auto max-w-prose text-center text-sm leading-6 text-white/60 sm:mx-0 sm:text-left">{beat.description}</p> : null}

    {preview ? <DetailSection title="Listen before you buy" id="beat-preview-heading">
      <AppBeatPreviewPlayer
        title={beat.title}
        artist={producerName}
        preview={preview}
        artwork={artwork || undefined}
        genre={beat.genre || undefined}
        beatId={beat.id}
        surface={surface}
      />
      <p className="mt-3 text-xs leading-5 text-white/45">Listening is free. To use this beat in your own music, buy a licence below.</p>
    </DetailSection> : null}

    <DetailSection title="Licences" id="beat-licences-heading">
      <p className="text-sm text-white/55">Each licence opens checkout on bvsradio.com with this beat and licence already selected.</p>
      <div className="mt-3">{licences.map((licence) => <div key={licence.id} className="bvs-app-row flex items-center gap-3 py-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold">{licence.licence_name}</h3>
          <p className="mt-0.5 text-[13px] leading-5 text-white/50">{licence.terms_summary || "You’ll see the full licence terms before you pay."}</p>
        </div>
        {licence.id ? <a href={licenceCheckoutHref(String(licence.id))} target="_blank" rel="noopener noreferrer" className="bvs-app-pill bvs-app-pill--accent shrink-0">${Number(licence.price_usd).toFixed(2)}</a> : <span className="shrink-0 text-sm font-semibold text-white/60">${Number(licence.price_usd).toFixed(2)}</span>}
      </div>)}</div>
      {!licences.length ? <p className="border border-dashed border-white/15 p-4 text-sm text-white/55">Licences for this beat aren’t available right now. Check back soon.</p> : null}
    </DetailSection>
  </main>;
}
