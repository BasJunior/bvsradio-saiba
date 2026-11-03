"use client";

import { useOfferRotation } from "./useOfferRotation";
import Link from "next/link";

const offers = [
  {
    category: "BVS Creator Services",
    title: "Put your next release in motion",
    description: "Submit music to BVS, follow its review path and keep your release work in one creator workspace.",
    cta: "Open Creator Studio",
    href: "/creator/studio",
  },
  {
    category: "BVS BeatStore",
    title: "Find the sound for your next record",
    description: "Browse beats from BVS producers and discover the right starting point for your next release.",
    cta: "Explore BeatStore",
    href: "/catalogue?type=beat#beatstore",
  },
  {
    category: "BVS Creator Services",
    title: "Get your music heard by more people",
    description: "Build your artist presence, submit your music and keep your BVS profile ready for discovery.",
    cta: "Start creating",
    href: "/upload",
  },
] as const;

export default function HomeCreatorOffer() {
  const rotation = useOfferRotation(offers.length);
  const activeIndex = rotation.index;
  const offer = offers[activeIndex];

  return (
    <section
      {...rotation.sectionProps}
      aria-labelledby="creator-offer-title"
      data-home-accent="studio"
      className="h-full rounded-2xl border border-purple-300/30 bg-gradient-to-br from-purple-200/[.09] via-white/[.035] to-transparent p-5 shadow-[0_18px_50px_rgba(0,0,0,.18)] sm:p-6"
    >
      <p className="text-xs font-semibold uppercase tracking-widest text-purple-200">{offer.category}</p>
      <h2 id="creator-offer-title" className="mt-2 text-2xl font-semibold">{offer.title}</h2>
      <p className="mt-2 text-sm text-text-secondary">{offer.description}</p>
      <div className="mt-4">
        <Link
          href={offer.href}
          className="inline-flex min-h-11 items-center rounded-full bg-purple-200 px-5 font-semibold text-black"
        >
          {offer.cta}
        </Link>
      </div>
      <div className="mt-5 flex items-center gap-2" aria-label="Creator offers">
        {offers.map((item, index) => (
          <button
            key={item.title}
            type="button"
            aria-label={`Show ${item.title}`}
            aria-current={index === activeIndex ? "true" : undefined}
            onClick={() => rotation.select(index)}
            className="grid h-11 w-9 place-items-center"
          ><span aria-hidden="true" className={`h-2 rounded-full ${index === activeIndex ? "w-7 bg-purple-200" : "w-2 bg-white/30"}`} /></button>
        ))}
        <button type="button" onClick={rotation.toggle} aria-label={rotation.paused ? "Resume creator offers" : "Pause creator offers"} aria-pressed={rotation.paused} className="ml-auto min-h-11 px-2 text-xs text-text-secondary">{rotation.paused ? "Resume" : "Pause"}</button>
        <span className="ml-1 text-xs text-text-secondary">Offer {activeIndex + 1} of {offers.length}</span>
      </div>
    </section>
  );
}
