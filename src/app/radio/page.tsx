import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import RadioPlayer from "@/components/RadioPlayer";
import RadioSessionHome from "@/components/RadioSessionHome";
import RadioShelfNav from "@/components/RadioShelfNav";
import { getPublicProgrammes } from "@/lib/station-content";
import type { Show } from "@/lib/station";

export const metadata: Metadata = {
  title: "Listen | BVS Radio",
  description: "Settle into BVS Radio: continuous rotation, scheduled programmes, verified music context and the live listener room.",
};

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

export default async function RadioPage() {
  const shows = await getPublicProgrammes();
  const activeShow = shows.find((show) => show.status === "active");
  const upcoming = shows
    .filter((show) => show.status !== "active")
    .sort((a, b) => nextOccurrence(a) - nextOccurrence(b));
  const nextShow = upcoming[0];
  const laterShow = upcoming[1];

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[.18em] text-brand">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" /> On air
            </span>
            <span className="text-xs text-text-secondary">CAT · Zimbabwe roots</span>
          </div>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">BVS Radio</h1>
          <p className="mt-2 max-w-2xl text-base text-text-secondary sm:text-lg">African sound, rooted in Zimbabwe. Stay awhile.</p>
        </div>
        <nav className="flex flex-wrap gap-2 text-sm" aria-label="Radio pages">
          <Link href="/radio/schedule" className="rounded-full border border-white/15 px-4 py-2 hover:bg-white/5">Schedule</Link>
          <Link href="/radio/room" className="rounded-full border border-white/15 px-4 py-2 hover:bg-white/5">Live room</Link>
          <Link href="/shows" className="rounded-full border border-white/15 px-4 py-2 hover:bg-white/5">Shows</Link>
        </nav>
      </header>

      <RadioShelfNav />

      <section id="radio-on-air" className="scroll-mt-28" aria-labelledby="now-playing-heading">
        <h2 id="now-playing-heading" className="sr-only">Now playing on BVS Radio</h2>
        <RadioPlayer />
      </section>

      <div id="radio-session" className="mt-8 scroll-mt-28">
        <RadioSessionHome />
      </div>

      <section id="radio-coming-up" className="mt-12 scroll-mt-28" aria-labelledby="coming-up-heading">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-brand">Station clock</p>
            <h2 id="coming-up-heading" className="mt-1 text-3xl font-semibold">Now, next, later.</h2>
          </div>
          <Link href="/radio/schedule" className="text-sm text-brand hover:underline">Full schedule →</Link>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <article className="rounded-2xl border border-brand/30 bg-brand/[0.06] p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-brand">Now</p>
            <h3 className="mt-2 text-xl font-semibold">{activeShow?.title || "BVS Continuous Rotation"}</h3>
            <p className="mt-2 text-sm text-text-secondary">
              {activeShow ? `${activeShow.schedule} · Presented by ${activeShow.host}` : "Approved artist releases and selected curated tracks keep the station moving."}
            </p>
            {activeShow ? <Link href={`/shows/${activeShow.slug}`} className="mt-4 inline-block text-sm text-brand hover:underline">Open show →</Link> : null}
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

      {shows.length ? (
        <section id="radio-shows" className="mt-14 scroll-mt-28" aria-labelledby="continue-bvs-heading">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.18em] text-brand">Continue with BVS</p>
              <h2 id="continue-bvs-heading" className="mt-1 text-3xl font-semibold">Shows worth staying for.</h2>
            </div>
            <Link href="/shows" className="text-sm text-brand hover:underline">All shows →</Link>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {shows.slice(0, 3).map((show) => (
              <Link key={show.slug} href={`/shows/${show.slug}`} className="group overflow-hidden rounded-2xl border border-white/10 bg-bg-card/35">
                <div className="relative aspect-[16/9] overflow-hidden">
                  <Image src={show.image} alt="" fill className="object-cover transition duration-500 group-hover:scale-105" />
                  {show.status === "active" ? <span className="absolute left-3 top-3 rounded-full bg-brand px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-black">Live</span> : null}
                </div>
                <div className="p-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-brand">{show.schedule}</p>
                  <h3 className="mt-2 text-xl font-semibold group-hover:text-brand">{show.title}</h3>
                  <p className="mt-2 line-clamp-2 text-sm text-text-secondary">{show.tagline}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-14 flex flex-col gap-4 rounded-2xl border border-white/10 bg-bg-card/25 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-brand">For artists</p>
          <h2 className="mt-1 text-2xl font-semibold">Want your music in the BVS ecosystem?</h2>
          <p className="mt-2 text-sm text-text-secondary">Submit for editorial review. Publishing and rotation remain separate from Premium distribution.</p>
        </div>
        <Link href="/upload" className="shrink-0 rounded-full bg-brand px-5 py-2.5 text-center text-sm font-medium text-black">Submit music</Link>
      </section>
    </main>
  );
}
