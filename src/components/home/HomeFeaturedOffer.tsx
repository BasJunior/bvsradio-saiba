"use client";

import { useOfferRotation } from "./useOfferRotation";
import { useRouter } from "next/navigation";
import { officialBvsServices } from "@/lib/official-services";
import { seededMarketplaceServiceRef } from "@/lib/marketplace-storefronts";
import { writeCartLines } from "@/lib/cart-client";
import OfferAnalytics from "@/components/OfferAnalytics";
import Link from "next/link";

export default function HomeFeaturedOffer() {
  const router = useRouter();
  const offers = [
    { serviceId: "mixing", tierIndex: 0, title: "Get your track professionally mixed" },
    { serviceId: "mastering", tierIndex: 0, title: "Make your release ready to share" },
    { serviceId: "mix-master-bundle", tierIndex: 0, title: "Take your track from stems to master" },
  ].map((offer) => {
    const service = officialBvsServices.find((item) => item.id === offer.serviceId)!;
    return { ...offer, service, tier: service.tiers[offer.tierIndex] };
  });
  const rotation = useOfferRotation(offers.length);
  const activeIndex = rotation.index;
  const activeOffer = offers[activeIndex];
  const { service, tier } = activeOffer;
  const id = `marketplace:${seededMarketplaceServiceRef("bvs-studio-services", service.id, 0)}`;

  return <OfferAnalytics id={id} kind="service" source="home_featured_offer">
    <section {...rotation.sectionProps} aria-labelledby="featured-offer-title" data-home-accent="marketplace" className="h-full rounded-2xl border border-brand/30 bg-gradient-to-br from-brand/[.08] via-white/[.035] to-transparent p-5 shadow-[0_18px_50px_rgba(0,0,0,.18)] sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-brand">BVS Audio Services · {tier.price} USD</p>
      <h2 id="featured-offer-title" className="mt-2 text-2xl font-semibold">{activeOffer.title}</h2>
      <p className="mt-2 text-sm text-text-secondary">{tier.name}: {tier.desc}. Reference tracks welcome.</p>
      <p className="mt-2 text-xs text-text-secondary">Confirm scheduling with BVS before ordering if you have a release deadline.</p>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <button data-offer-action type="button" className="min-h-11 rounded-full bg-brand px-5 font-semibold text-black" onClick={() => {
          writeCartLines([{ id, title: `${service.title} — ${tier.name}`, artist: "BVS Studio Services", type: "service", price: service.startingPriceUsd, quantity: 1, delivery: "Project brief and delivery are handled through BVS." }]);
          router.push("/checkout");
        }}>Book {tier.name} · {tier.price}</button>
        <Link data-offer-action href={`/marketplace/bvs-studio-services?service=${service.id}#service-${service.id}`} className="text-sm text-brand underline">Compare packages</Link>
      </div>
      <div className="mt-5 flex items-center gap-2" aria-label="Featured offers">
        {offers.map((offer, index) => (
          <button
            key={offer.service.id}
            type="button"
            aria-label={`Show ${offer.tier.name} offer`}
            aria-current={index === activeIndex ? "true" : undefined}
            onClick={() => rotation.select(index)}
            className="grid h-11 w-9 place-items-center rounded-full"
          ><span aria-hidden="true" className={`h-2 rounded-full transition-all ${index === activeIndex ? "w-7 bg-brand" : "w-2 bg-white/30"}`} /></button>
        ))}
        <button type="button" onClick={rotation.toggle} aria-label={rotation.paused ? "Resume audio service offers" : "Pause audio service offers"} aria-pressed={rotation.paused} className="ml-auto min-h-11 px-2 text-xs text-text-secondary">{rotation.paused ? "Resume" : "Pause"}</button>
        <span className="ml-1 text-xs text-text-secondary">Offer {activeIndex + 1} of {offers.length}</span>
      </div>
    </section>
  </OfferAnalytics>;
}
