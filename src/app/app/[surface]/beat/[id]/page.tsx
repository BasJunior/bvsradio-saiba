import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import AppShareButton from "@/components/app-vnext/AppShareButton";
import { listPublishedBeats, loadProducerProfile, publicStorageUrl } from "@/lib/beatstore-server";
import { producerPublicName } from "@/lib/public-name";

export const dynamic = "force-dynamic";

export default async function AppBeatPage({ params }: { params: Promise<{ surface: string; id: string }> }) {
  const { surface, id } = await params;
  if (surface !== "ios" && surface !== "android") notFound();
  const beats = await listPublishedBeats(160);
  const beat = beats.find((item) => item.id === id);
  if (!beat) notFound();
  const producer = await loadProducerProfile(beat.producer_user_id).catch(() => null);
  const producerName = producerPublicName({
    publicName: producer?.display_name,
    username: producer?.username,
  });
  const producerHandle = String(producer?.username || "").trim();
  const artwork = publicStorageUrl(beat.artwork_path);
  const preview = publicStorageUrl(beat.preview_path);
  const licences = (beat.beat_licence_options || []).filter((licence) => licence.is_active !== false && !licence.is_sold_out).sort((a, b) => Number(a.price_usd) - Number(b.price_usd));
  return <div className="mx-auto max-w-4xl px-4 pb-12 pt-6 sm:px-6">
    <Link href={`/app/${surface}/explore`} className="text-sm text-text-secondary">← Explore</Link>
    <section className="mt-5 grid gap-6 sm:grid-cols-[240px,1fr] sm:items-start">
      <div className="relative aspect-square overflow-hidden rounded-[1.8rem] border border-white/10 bg-white/5">{artwork ? <Image src={artwork} alt="" fill unoptimized className="object-cover" priority /> : <div className="absolute inset-0 grid place-items-center text-brand">BVS BEAT</div>}</div>
      <div><p className="text-xs uppercase tracking-[.2em] text-brand">BeatStore · published</p><h1 className="mt-2 text-4xl font-semibold tracking-tight">{beat.title}</h1><p className="mt-2 text-sm text-text-secondary">{producerHandle ? <Link href={`/app/${surface}/creator/${producerHandle}?as=producer`} className="text-white hover:text-brand">{producerName}</Link> : producerName}</p><p className="mt-3 text-sm text-text-secondary">{[beat.genre, beat.mood, beat.bpm ? `${beat.bpm} BPM` : "", beat.musical_key].filter(Boolean).join(" · ")}</p>{beat.description ? <p className="mt-4 text-sm leading-6 text-text-secondary">{beat.description}</p> : null}<div className="mt-5 flex flex-wrap gap-2"><AppShareButton title={beat.title} text={`${beat.title} by ${producerName} on BVS BeatStore`} path={`/app/${surface}/beat/${beat.id}`} /><Link href={`/catalogue?type=beat&q=${encodeURIComponent(beat.title)}#beatstore`} className="min-h-10 rounded-full border border-brand/35 px-4 py-2 text-sm font-semibold text-brand">Licence / buy</Link></div></div>
    </section>
    {preview ? <section className="mt-8 rounded-[1.75rem] border border-brand/20 bg-brand/[.05] p-5"><p className="text-xs uppercase tracking-[.18em] text-brand">Preview</p><audio controls preload="metadata" src={preview} className="mt-3 w-full" /></section> : null}
    <section className="mt-8"><p className="text-xs uppercase tracking-[.18em] text-brand">Licences</p><h2 className="mt-1 text-2xl font-semibold">Choose how you want to build.</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{licences.map((licence) => <div key={licence.id} className="rounded-2xl border border-white/10 bg-white/[.025] p-4"><h3 className="font-semibold">{licence.licence_name}</h3><p className="mt-1 text-2xl font-semibold text-brand">${Number(licence.price_usd).toFixed(2)}</p><p className="mt-2 text-xs text-text-secondary">{licence.terms_summary || "Licence terms are shown before purchase."}</p></div>)}</div>{!licences.length ? <p className="mt-4 rounded-xl border border-dashed border-white/10 p-4 text-sm text-text-secondary">Licence options are temporarily unavailable for this beat.</p> : null}</section>
    <div className="mt-8 rounded-2xl border border-white/10 p-4 text-sm text-text-secondary"><b className="text-white">Store-safe handoff:</b> vNext can present the beat and licence options natively; the final mobile purchase rail is selected by the platform/storefront commerce policy layer rather than assuming the website checkout is permitted.</div>
  </div>;
}
