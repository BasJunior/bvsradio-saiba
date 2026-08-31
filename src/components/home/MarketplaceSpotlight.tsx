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
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-16" aria-labelledby="marketplace-spotlight-title">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3 sm:mb-7 sm:gap-4">
        <div className="max-w-3xl">
          <p className="bvs-section-kicker">Studios & services</p>
          <h2 id="marketplace-spotlight-title" className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
            Bring the project to the people who can finish it.
          </h2>
        </div>
        <Link href="/marketplace" className="text-sm font-semibold text-brand hover:underline">Browse Marketplace →</Link>
      </div>

      <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
        {providers.map((provider) => (
          <Link
            key={provider.slug}
            href={`/marketplace/${provider.slug}`}
            className="bvs-surface bvs-surface-hover group relative min-h-[18rem] overflow-hidden rounded-[1.65rem] bg-black sm:min-h-[22rem] sm:rounded-[2rem]"
          >
            <Image
              src={provider.image}
              alt=""
              fill
              sizes="(max-width:1024px) 100vw, 50vw"
              className={`object-cover transition duration-500 group-hover:scale-[1.03] ${provider.imagePosition}`}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/10" />
            <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8">
              <div className="flex flex-wrap items-center gap-2">
                <span className="bvs-chip bvs-chip-brand">{provider.eyebrow}</span>
                <span className="bvs-chip">{provider.price}</span>
              </div>
              <h3 className="mt-3 font-serif text-3xl font-semibold tracking-tight text-white sm:text-4xl">{provider.name}</h3>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/72 sm:text-base">{provider.headline}</p>
              <p className="mt-4 text-sm font-semibold text-brand transition group-hover:translate-x-1 sm:mt-5">{provider.cta} →</p>
            </div>
          </Link>
        ))}
      </div>
      <p className="mt-4 max-w-3xl text-sm leading-relaxed text-text-secondary sm:mt-5">
        Provider services, prices, policies and real published availability stay under one storefront. BVS does not invent booking slots.
      </p>
    </section>
  );
}
