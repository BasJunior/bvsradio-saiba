import Link from "next/link";

const pathways = [
  { label: "Listen", title: "Stay in the sound", copy: "Play the live rotation and keep discovering.", href: "/radio", accent: "listen" },
  { label: "Discover", title: "Find your next favorite", copy: "Explore tracks, artists, beats and shows.", href: "/search", accent: "discover" },
  { label: "Create", title: "Build what comes next", copy: "Submit music and grow your creator workspace.", href: "/creator/studio", accent: "studio" },
  { label: "Marketplace", title: "Move your project forward", copy: "Find services, beats and collaborators.", href: "/marketplace", accent: "marketplace" },
] as const;

export default function HomePathways() {
  return (
    <section className="mt-8 sm:mt-10" aria-labelledby="home-pathways-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-text-secondary">Choose your next move</p>
          <h2 id="home-pathways-title" className="mt-1 text-2xl font-semibold">There’s more than one way into BVS.</h2>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {pathways.map((item) => (
          <Link key={item.label} href={item.href} data-home-accent={item.accent} className="bvs-home-accent-card group flex min-h-44 flex-col rounded-[1.35rem] border border-white/15 bg-gradient-to-br from-white/[.09] to-white/[.035] p-5 shadow-[0_12px_35px_rgba(0,0,0,.12)] transition hover:-translate-y-0.5 hover:border-white/25">
            <p className="bvs-home-accent-label text-[10px] font-semibold uppercase tracking-[.18em]">{item.label}</p>
            <h3 className="mt-2 text-lg font-semibold">{item.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">{item.copy}</p>
            <p className="bvs-home-accent-arrow mt-auto pt-4 text-sm font-semibold">Open →</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
