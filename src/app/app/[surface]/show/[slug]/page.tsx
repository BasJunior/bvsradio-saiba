import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import LibraryAction from "@/components/LibraryAction";
import AppShareButton from "@/components/app-vnext/AppShareButton";
import type { DiscoveryItem } from "@/lib/discovery";
import { getPublicProgramme, getPublicShowContext, getPublicShowEvent } from "@/lib/station-content";

export const dynamic = "force-dynamic";

export default async function AppShowPage({ params }: { params: Promise<{ surface: string; slug: string }> }) {
  const { surface, slug } = await params;
  if (surface !== "ios" && surface !== "android") notFound();
  const programme = await getPublicProgramme(slug);
  if (!programme) notFound();
  const event = await getPublicShowEvent(slug);
  const context = event ? await getPublicShowContext(event.id) : { creators: [], setlist: [] };
  const item: DiscoveryItem = { id: `show-${programme.slug}`, kind: "show", title: programme.title, subtitle: programme.schedule, href: `/app/${surface}/show/${programme.slug}`, image: programme.image };
  const phase = event?.status || programme.status || "preview";
  const media = event?.status === "live" ? event.liveVideoUrl : (event?.replayVideoUrl || event?.liveVideoUrl);
  return <div className="mx-auto max-w-5xl px-4 pb-12 pt-6 sm:px-6">
    <Link href={`/app/${surface}`} className="text-sm text-text-secondary">← Home</Link>
    <section className="mt-5 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[.025]"><div className="relative aspect-[16/9] bg-white/5"><Image src={programme.image} alt="" fill className="object-cover" priority /></div><div className="p-5 sm:p-7"><div className="flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-brand/10 px-3 py-1.5 font-semibold text-brand">{phase === "live" ? "LIVE NOW" : phase.toUpperCase()}</span><span className="rounded-full border border-white/10 px-3 py-1.5 text-text-secondary">{programme.schedule}</span></div><h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">{programme.title}</h1><p className="mt-2 text-sm text-text-secondary">Hosted by {programme.host}</p><p className="mt-4 max-w-3xl text-sm leading-6 text-text-secondary">{programme.description}</p><div className="mt-5 flex flex-wrap gap-2"><LibraryAction item={item} section="follows" /><AppShareButton title={programme.title} text={`${programme.title} on BVS`} path={`/app/${surface}/show/${programme.slug}`} />{event?.roomId ? <Link href={`/shows/${programme.slug}?room=${encodeURIComponent(event.roomId)}`} className="min-h-10 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-black">{phase === "live" ? "Join BVS Room" : "Open show room"}</Link> : null}</div></div></section>

    {media ? <section className="mt-7 rounded-[1.75rem] border border-brand/20 bg-brand/[.04] p-5"><p className="text-xs uppercase tracking-[.18em] text-brand">{event?.status === "live" ? "Live" : "Replay"}</p><div className="mt-3 aspect-video overflow-hidden rounded-xl bg-black"><iframe src={media} title={`${programme.title} ${event?.status === "live" ? "live" : "replay"}`} className="h-full w-full" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen /></div></section> : null}

    {context.creators.length ? <section className="mt-8"><p className="text-xs uppercase tracking-[.18em] text-brand">Creators</p><h2 className="mt-1 text-2xl font-semibold">People behind this show.</h2><div className="mt-4 flex flex-wrap gap-2">{context.creators.map((creator) => creator.username ? <Link key={creator.id} href={`/app/${surface}/creator/${creator.username}`} className="rounded-full border border-white/10 px-4 py-2 text-sm hover:border-brand/35"><b>{creator.publicName}</b><span className="text-text-secondary"> · {creator.role}</span></Link> : <span key={creator.id} className="rounded-full border border-white/10 px-4 py-2 text-sm"><b>{creator.publicName}</b><span className="text-text-secondary"> · {creator.role}</span></span>)}</div></section> : null}

    {context.setlist.length ? <section className="mt-8"><p className="text-xs uppercase tracking-[.18em] text-brand">Setlist</p><h2 className="mt-1 text-2xl font-semibold">Music from the room.</h2><div className="mt-4 space-y-2">{context.setlist.map((track, index) => <div key={track.id} className="flex items-center gap-3 rounded-2xl border border-white/10 p-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/5 text-xs text-text-secondary">{index + 1}</span><div className="min-w-0"><p className="truncate font-semibold">{track.title}</p><p className="truncate text-sm text-text-secondary">{track.artistName}</p></div></div>)}</div></section> : null}

    <section className="mt-8 rounded-2xl border border-white/10 p-5"><p className="text-xs uppercase tracking-[.18em] text-brand">Reminder behavior</p><p className="mt-2 text-sm text-text-secondary">Following a show is the durable preference. The vNext notification layer uses that follow plus your Shows notification setting to deliver contextual start/live reminders after the isolated notification schema is activated.</p></section>
  </div>;
}
