import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import ShowFollowButton from "@/components/ShowFollowButton";
import { flowV2Flags } from "@/lib/feature-flags";
import { getPublicProgrammes, getPublicShowEvent } from "@/lib/station-content";
import { resolveShowPhase, showPhaseLabel } from "@/lib/show-events";

export const metadata: Metadata = {
  title: "Shows",
  description: "Explore live and upcoming BVS Radio programmes.",
};

export default async function ShowsPage() {
  const shows = await getPublicProgrammes();
  const canResolveEvents = flowV2Flags.showRooms || flowV2Flags.tvExperience;
  const rows = await Promise.all(
    shows.map(async (show) => {
      const event = canResolveEvents ? await getPublicShowEvent(show.slug) : null;
      const phase = event ? resolveShowPhase(event) : null;
      const mediaUrl =
        phase === "live"
          ? event?.liveVideoUrl
          : phase === "archived"
            ? event?.replayVideoUrl
            : null;
      return {
        show,
        event,
        phase,
        hasWatchExperience: Boolean(flowV2Flags.tvExperience && mediaUrl),
      };
    }),
  );

  return (
    <div className="mx-auto max-w-6xl px-6 py-14">
      <p className="text-xs uppercase tracking-[.2em] text-brand">BVS programmes</p>
      <h1 className="mt-2 text-5xl font-semibold">Programme schedule and upcoming originals.</h1>
      <p className="mt-5 max-w-2xl text-lg text-text-secondary">
        BVS labels every programme clearly: upcoming concepts remain previews, while verified live and archived events show their real state.
      </p>
      <div className="mt-12 grid gap-6 md:grid-cols-2">
        {rows.map(({ show, event, phase, hasWatchExperience }) => (
          <article
            key={show.slug}
            className="grid overflow-hidden rounded-2xl border border-white/10 bg-white/[.03] sm:grid-cols-[12rem_1fr]"
          >
            <Link href={`/shows/${show.slug}`} className="group relative min-h-48">
              <Image src={show.image} alt="" fill className="object-cover transition group-hover:scale-[1.02]" />
            </Link>
            <div className="p-6">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-brand">
                {phase ? showPhaseLabel(phase) : "Programme preview"}
              </span>
              <h2 className="mt-2 text-2xl font-semibold">
                <Link href={`/shows/${show.slug}`} className="hover:text-brand">
                  {show.title}
                </Link>
              </h2>
              <p className="mt-2 text-sm text-text-secondary">{show.description}</p>
              <p className="mt-5 text-xs text-text-secondary">
                {event?.startsAt ? "Verified event · " : "Planned slot · "}
                {show.schedule}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <ShowFollowButton
                  slug={show.slug}
                  title={show.title}
                  subtitle={show.tagline}
                  image={show.image}
                />
                <Link
                  href={`/shows/${show.slug}`}
                  className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-4 text-sm font-semibold hover:border-brand/40 hover:text-brand"
                >
                  Open show
                </Link>
                {hasWatchExperience ? (
                  <Link
                    href={`/shows/${show.slug}/watch`}
                    className="inline-flex min-h-11 items-center rounded-full border border-brand/35 bg-brand/10 px-4 text-sm font-semibold text-brand"
                  >
                    {phase === "live" ? "Watch live" : "Watch replay"}
                  </Link>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
