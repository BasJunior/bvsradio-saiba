import Link from "next/link";
import { notFound } from "next/navigation";
import LibraryAction from "@/components/LibraryAction";
import AppShareButton from "@/components/app-vnext/AppShareButton";
import ShowEpisodeList from "@/components/shows/ShowEpisodeList";
import DetailHero, { DetailSection } from "@/components/DetailHero";
import type { DiscoveryItem } from "@/lib/discovery";
import { getPublishedEpisodes } from "@/lib/published-shows";
import { getPublicProgramme, getPublicShowContext, getPublicShowEvent } from "@/lib/station-content";

export const dynamic = "force-dynamic";

export default async function AppShowPage({ params }: { params: Promise<{ surface: string; slug: string }> }) {
  const { surface, slug } = await params;
  if (surface !== "ios" && surface !== "android") notFound();
  const programme = await getPublicProgramme(slug);
  if (!programme) notFound();
  const episodes = await getPublishedEpisodes(slug);
  const event = await getPublicShowEvent(slug);
  const context = event ? await getPublicShowContext(event.id) : { creators: [], setlist: [] };
  const item: DiscoveryItem = { id: `show-${programme.slug}`, kind: "show", title: programme.title, subtitle: programme.schedule, href: `/app/${surface}/show/${programme.slug}`, image: programme.image };
  const phase = event?.status || programme.status || "preview";
  const media = event?.status === "live" ? event.liveVideoUrl : (event?.replayVideoUrl || event?.liveVideoUrl);
  const phaseLabels: Record<string, string> = { live: "Live now", scheduled: "Coming up", ended: "Replay", archived: "Replay", active: "Show", preview: "Show", cancelled: "Cancelled" };
  const phaseLabel = phaseLabels[String(phase)] || "Show";
  return <main className="bvs-app-page bvs-detail-page mx-auto max-w-5xl px-4 pb-14 sm:px-6" data-app-accent="lime">
    <DetailHero
      image={programme.image}
      imageAlt={`${programme.title} artwork`}
      eyebrow={phaseLabel}
      title={programme.title}
      subtitle={`Hosted by ${programme.host}`}
      facts={[programme.schedule]}
      actions={<>
        {event?.roomId ? <Link href={`/shows/${programme.slug}?room=${encodeURIComponent(event.roomId)}`} className="bvs-app-pill bvs-app-pill--primary min-h-11 px-5">{phase === "live" ? "Join the live room" : "Open show room"}</Link> : null}
        <LibraryAction item={item} section="follows" />
        <AppShareButton title={programme.title} text={`${programme.title} on BVS`} path={`/shows/${encodeURIComponent(programme.slug)}`} image={programme.image} kicker="BVS Show" />
      </>}
    />
    {programme.description ? <p className="mx-auto max-w-prose text-center text-sm leading-6 text-white/60 sm:mx-0 sm:text-left">{programme.description}</p> : null}

    {media ? <DetailSection title={event?.status === "live" ? "Watch live" : "Watch the replay"} id="show-media-heading"><div className="aspect-video overflow-hidden bg-black"><iframe src={media} title={`${programme.title} ${event?.status === "live" ? "live" : "replay"}`} className="h-full w-full" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen /></div></DetailSection> : null}

    {context.creators.length ? <DetailSection title="People behind the show" id="show-creators-heading"><div>{context.creators.map((creator) => creator.username
      ? <Link key={creator.id} href={`/app/${surface}/creator/${creator.username}`} className="bvs-app-row flex items-center justify-between gap-3 py-3"><span className="min-w-0"><span className="block truncate font-semibold">{creator.publicName}</span><span className="block text-sm text-white/50">{creator.role}</span></span><span aria-hidden="true" className="text-white/35">›</span></Link>
      : <div key={creator.id} className="bvs-app-row py-3"><span className="block font-semibold">{creator.publicName}</span><span className="block text-sm text-white/50">{creator.role}</span></div>)}</div></DetailSection> : null}

    {context.setlist.length ? <DetailSection title="Music played" id="show-setlist-heading"><ol>{context.setlist.map((track, index) => <li key={track.id} className="bvs-app-row flex items-center gap-3 py-2.5"><span className="w-6 shrink-0 text-center text-sm tabular-nums text-white/40">{index + 1}</span><div className="min-w-0"><p className="truncate font-semibold">{track.title}</p><p className="truncate text-sm text-white/50">{track.artistName}</p></div></li>)}</ol></DetailSection> : null}

    {episodes.length ? <DetailSection title="Episodes" id="show-episodes-heading"><ShowEpisodeList episodes={episodes} /></DetailSection> : null}

    <p className="mt-8 border-t border-white/12 pt-4 text-sm text-white/50">Follow this show to keep it in your Library. If show notifications are on, we’ll remind you when it starts.</p>
  </main>;
}
