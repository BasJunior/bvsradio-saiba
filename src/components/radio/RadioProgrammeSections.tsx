import Image from "next/image";
import Link from "next/link";
import { shouldBypassImageOptimizer } from "@/lib/image-optimization";
import { getPublicProgrammes } from "@/lib/station-content";
import type { Show } from "@/lib/station";

const dayOrder: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

function nextOccurrence(show: Show) {
  const [dayLabel = "", timeLabel = ""] = show.schedule.split(" · ");
  const day = dayOrder[dayLabel.trim().toLowerCase()];
  const match = timeLabel.match(/(\d{1,2}):(\d{2})/);
  if (day === undefined || !match) return Number.POSITIVE_INFINITY;

  const nowParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Harare",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (type: Intl.DateTimeFormatPartTypes) => nowParts.find((part) => part.type === type)?.value || "";
  const currentDay = dayOrder[get("weekday").toLowerCase()] ?? 0;
  const currentMinutes = Number(get("hour") || 0) * 60 + Number(get("minute") || 0);
  const showMinutes = Number(match[1]) * 60 + Number(match[2]);
  let deltaDays = (day - currentDay + 7) % 7;
  if (deltaDays === 0 && showMinutes <= currentMinutes) deltaDays = 7;
  return deltaDays * 24 * 60 + showMinutes - currentMinutes;
}

export default async function RadioProgrammeSections() {
  const shows = await getPublicProgrammes();
  const upcoming = shows
    .filter((show) => Number.isFinite(nextOccurrence(show)))
    .sort((a, b) => nextOccurrence(a) - nextOccurrence(b));
  const nextShow = upcoming[0];
  const laterShow = upcoming[1];

  return (
    <>
      <section id="radio-coming-up" className="mt-12 scroll-mt-28" aria-labelledby="coming-up-heading">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-text-secondary">Schedule · Times in CAT unless stated</p>
            <h2 id="coming-up-heading" className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">On the programme</h2>
          </div>
          <Link href="/radio/schedule" className="text-sm text-brand hover:underline">Full schedule →</Link>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <article className="rounded-2xl border border-brand/30 bg-brand/[0.06] p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-brand">The station</p>
            <h3 className="mt-2 text-xl font-semibold">BVS Continuous Rotation</h3>
            <p className="mt-2 text-sm text-text-secondary">Approved artist releases and selected curated tracks. Press play above to listen.</p>
          </article>

          <article className="rounded-2xl border border-white/10 bg-bg-card/30 p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-brand">Next scheduled</p>
            <h3 className="mt-2 text-xl font-semibold">{nextShow?.title || "Continuous rotation"}</h3>
            <p className="mt-2 text-sm text-text-secondary">{nextShow ? `${nextShow.schedule} · ${nextShow.host}` : "More named programmes will appear here as editorial schedules them."}</p>
            {nextShow ? <Link href={`/shows/${nextShow.slug}`} className="mt-4 inline-block text-sm text-brand hover:underline">Show details →</Link> : null}
          </article>

          <article className="rounded-2xl border border-white/10 bg-bg-card/30 p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-brand">Later</p>
            <h3 className="mt-2 text-xl font-semibold">{laterShow?.title || "BVS stays on"}</h3>
            <p className="mt-2 text-sm text-text-secondary">{laterShow ? `${laterShow.schedule} · ${laterShow.host}` : "The station returns to continuous rotation between named programmes."}</p>
            {laterShow ? <Link href={`/shows/${laterShow.slug}`} className="mt-4 inline-block text-sm text-brand hover:underline">Show details →</Link> : null}
          </article>
        </div>
      </section>

      <section id="radio-shows" className="mt-14 scroll-mt-28" aria-labelledby="continue-bvs-heading">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-text-secondary">More voices. More stories.</p>
            <h2 id="continue-bvs-heading" className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">Shows</h2>
          </div>
          <Link href="/shows" className="text-sm text-brand hover:underline">All shows →</Link>
        </div>
      {shows.length ? (
          <div className="grid gap-5 md:grid-cols-3">
            {shows.slice(0, 3).map((show) => (
              <Link key={show.slug} href={`/shows/${show.slug}`} className="group overflow-hidden rounded-2xl border border-white/10 bg-bg-card/35">
                <div className="relative aspect-[16/9] overflow-hidden">
                  <Image src={show.image} alt="" fill sizes="(min-width: 768px) 33vw, 100vw" unoptimized={shouldBypassImageOptimizer(show.image)} className="object-cover transition duration-500 group-hover:scale-105" />
                  {show.status === "active" ? <span className="absolute left-3 top-3 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">On BVS</span> : null}
                </div>
                <div className="p-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-brand">{show.schedule}</p>
                  <h3 className="mt-2 text-xl font-semibold group-hover:text-brand">{show.title}</h3>
                  <p className="mt-2 line-clamp-2 text-sm text-text-secondary">{show.tagline}</p>
                </div>
              </Link>
            ))}
          </div>
      ) : <p className="rounded-2xl border border-white/10 p-6 text-sm text-text-secondary">Published shows will appear here. In the meantime, explore the station rotation.</p>}
      </section>
    </>
  );
}
