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
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-14" aria-labelledby="bvs-intent-title">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3 sm:mb-7 sm:gap-4">
        <div className="max-w-2xl">
          <p className="bvs-section-kicker">One BVS</p>
          <h2 id="bvs-intent-title" className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Listen. Discover. Work. Keep.</h2>
        </div>
        <p className="max-w-xl text-sm leading-relaxed text-text-secondary">
          The same music, people and projects should stay connected as you move through BVS.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {intents.map((intent) => (
          <Link
            key={intent.label}
            href={intent.href}
            className="bvs-surface bvs-surface-hover group relative min-h-0 rounded-[1.5rem] p-5 sm:min-h-56 sm:rounded-[1.75rem] sm:p-7"
          >
            <div className="flex items-center justify-between gap-4">
              <p className="bvs-chip bvs-chip-brand">{intent.label}</p>
              <span className="font-serif text-2xl leading-none text-brand/45 transition group-hover:text-brand/70 sm:text-3xl" aria-hidden="true">{intent.mark}</span>
            </div>
            <h3 className="mt-5 max-w-[16rem] text-xl font-semibold leading-tight tracking-tight sm:mt-8 sm:text-2xl">{intent.title}</h3>
            <p className="mt-2.5 max-w-sm text-sm leading-relaxed text-text-secondary sm:mt-3">{intent.detail}</p>
            <p className="mt-4 text-sm font-semibold text-brand transition group-hover:translate-x-1 sm:mt-7">{intent.cta} →</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
