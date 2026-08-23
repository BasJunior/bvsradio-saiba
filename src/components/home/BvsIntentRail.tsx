import Link from "next/link";

const intents = [
  {
    label: "Listen",
    title: "Stay with the station",
    detail: "Live rotation, programmes, queue and replay context in one listening session.",
    href: "/radio",
    cta: "Open Radio",
    mark: "01",
  },
  {
    label: "Discover",
    title: "Follow the sound",
    detail: "Artists, releases, beats, stories and live BVS activity without breaking playback.",
    href: "/search",
    cta: "Explore BVS",
    mark: "02",
  },
  {
    label: "Work",
    title: "Find people to finish the record",
    detail: "Studios, engineers, producers and official BVS services live in one Marketplace.",
    href: "/marketplace",
    cta: "Open Marketplace",
    mark: "03",
  },
  {
    label: "Keep",
    title: "Come back to what matters",
    detail: "Saved music, followed creators and shows, history and purchases stay in your Library.",
    href: "/library",
    cta: "Open Library",
    mark: "04",
  },
];

export default function BvsIntentRail() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14" aria-labelledby="bvs-intent-title">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[.22em] text-brand">One BVS</p>
          <h2 id="bvs-intent-title" className="mt-2 text-3xl font-semibold sm:text-4xl">Listen. Discover. Work. Keep.</h2>
        </div>
        <p className="max-w-xl text-sm leading-relaxed text-text-secondary">
          The same music, people and projects should stay connected as you move through BVS.
        </p>
      </div>
      <div className="grid gap-px overflow-hidden rounded-[2rem] border border-white/10 bg-white/10 md:grid-cols-2 xl:grid-cols-4">
        {intents.map((intent) => (
          <Link
            key={intent.label}
            href={intent.href}
            className="group relative min-h-56 bg-bg-primary p-6 transition hover:bg-white/[.035] sm:p-7"
          >
            <div className="flex items-center justify-between gap-4">
              <p className="text-[11px] font-semibold uppercase tracking-[.2em] text-brand">{intent.label}</p>
              <span className="font-serif text-2xl text-brand/55" aria-hidden="true">{intent.mark}</span>
            </div>
            <h3 className="mt-8 max-w-[16rem] text-2xl font-semibold leading-tight">{intent.title}</h3>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-text-secondary">{intent.detail}</p>
            <p className="mt-7 text-sm font-semibold text-brand transition group-hover:translate-x-1">{intent.cta} →</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
