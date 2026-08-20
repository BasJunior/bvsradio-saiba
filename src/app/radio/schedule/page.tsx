import type { Metadata } from "next";
import Link from "next/link";
import { schedule as fallbackSchedule } from "@/lib/station";
import { getPublicProgrammes } from "@/lib/station-content";

export const metadata: Metadata = {
  title: "Radio Schedule | BVS Radio",
  description: "See the BVS Radio programme schedule and move from the station into individual shows.",
};

export default async function RadioSchedulePage() {
  const shows = await getPublicProgrammes();
  const hasActiveProgramme = shows.some((show) => show.status === "active");
  const rows = hasActiveProgramme || shows.length
    ? shows.map((show) => {
        const [day = "Schedule TBA", time = "Time TBA"] = show.schedule.split(" · ");
        return {
          id: show.slug,
          day,
          time,
          title: show.title,
          note: show.status === "active" ? `On air · Presented by ${show.host}` : `Presented by ${show.host}`,
          href: `/shows/${show.slug}`,
          active: show.status === "active",
        };
      })
    : fallbackSchedule.map((slot, index) => ({
        id: `${slot.day}-${index}`,
        day: slot.day,
        time: slot.time,
        title: slot.title,
        note: slot.note,
        href: "/radio",
        active: false,
      }));

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8">
        <Link href="/radio" className="text-sm text-brand hover:underline">← Back to BVS Radio</Link>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[.22em] text-brand">Station schedule</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">When to come back live.</h1>
        <p className="mt-4 max-w-2xl text-base text-text-secondary sm:text-lg">
          BVS runs continuous rotation between scheduled programmes. Programme pages hold the lasting show, replay and creator context.
        </p>
      </header>

      <section className="space-y-3" aria-label="BVS Radio schedule">
        {rows.map((row) => (
          <Link
            key={row.id}
            href={row.href}
            className={`grid gap-2 rounded-2xl border p-4 transition hover:bg-white/[0.04] sm:grid-cols-[9rem_9rem_minmax(0,1fr)] sm:items-center sm:p-5 ${
              row.active ? "border-brand/35 bg-brand/[0.06]" : "border-white/10 bg-bg-card/30"
            }`}
          >
            <span className="text-sm text-text-secondary">{row.day}</span>
            <span className="text-sm font-medium">{row.time}</span>
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{row.title}</span>
                {row.active ? <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-black">Live</span> : null}
              </span>
              <span className="mt-1 block text-xs text-text-secondary">{row.note}</span>
            </span>
          </Link>
        ))}
      </section>

      <section className="mt-10 rounded-2xl border border-white/10 bg-bg-card/30 p-6">
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-brand">Always on</p>
        <h2 className="mt-2 text-2xl font-semibold">BVS continuous rotation</h2>
        <p className="mt-2 max-w-2xl text-sm text-text-secondary">When a named programme is not live, approved artist releases and selected curated tracks keep the station moving.</p>
        <Link href="/radio" className="mt-5 inline-flex rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-black">Return to the station</Link>
      </section>
    </main>
  );
}
