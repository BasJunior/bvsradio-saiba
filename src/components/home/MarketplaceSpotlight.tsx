import Image from "next/image";
import Link from "next/link";

const providers = [
  {
    slug: "wolfbridges-studio",
    name: "WolfBridges Studio",
    eyebrow: "Madokero, Harare",
    headline: "Recording, mixing, mastering and beat-based production.",
    price: "From $30",
    image: "/images/marketplace/wolfbridges-studio.jpg",
    imagePosition: "object-top",
    cta: "Open Wolf Studio",
  },
  {
    slug: "bvs-studio-services",
    name: "BVS Studio Services",
    eyebrow: "Official BVS provider",
    headline: "Mixing, mastering, vocal production and release preparation.",
    price: "Official services",
    image: "/images/hero-studio.jpg",
    imagePosition: "object-center",
    cta: "Open BVS Studio",
  },
];

export default function MarketplaceSpotlight() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16" aria-labelledby="marketplace-spotlight-title">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[.22em] text-brand">Studios &amp; services</p>
          <h2 id="marketplace-spotlight-title" className="mt-2 text-3xl font-semibold sm:text-4xl md:text-5xl">
            Bring the project to the people who can finish it.
          </h2>
        </div>
        <Link href="/marketplace" className="text-sm font-semibold text-brand hover:underline">Browse Marketplace →</Link>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {providers.map((provider) => (
          <Link
            key={provider.slug}
            href={`/marketplace/${provider.slug}`}
            className="group relative min-h-[22rem] overflow-hidden rounded-[2rem] border border-white/10 bg-black shadow-[0_30px_80px_rgba(0,0,0,.28)]"
          >
            <Image
              src={provider.image}
              alt=""
              fill
              sizes="(max-width:1024px) 100vw, 50vw"
              className={`object-cover transition duration-500 group-hover:scale-[1.025] ${provider.imagePosition}`}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-black/5" />
            <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[.18em] text-brand">
                <span>{provider.eyebrow}</span>
                <span className="text-white/35">·</span>
                <span>{provider.price}</span>
              </div>
              <h3 className="mt-2 font-serif text-3xl font-semibold text-white sm:text-4xl">{provider.name}</h3>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/70 sm:text-base">{provider.headline}</p>
              <p className="mt-5 text-sm font-semibold text-brand transition group-hover:translate-x-1">{provider.cta} →</p>
            </div>
          </Link>
        ))}
      </div>
      <p className="mt-5 max-w-3xl text-sm leading-relaxed text-text-secondary">
        Provider services, prices, policies and real published availability stay under one storefront. BVS does not invent booking slots.
      </p>
    </section>
  );
}
