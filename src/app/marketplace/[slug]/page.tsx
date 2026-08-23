"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  marketplaceStorefronts,
  type MarketplaceStorefront,
} from "@/lib/marketplace-storefronts";

type MarketplacePayload = {
  profiles?: Parameters<typeof marketplaceStorefronts>[0];
  listings?: Parameters<typeof marketplaceStorefronts>[1];
};

export default function MarketplaceStorefrontPage() {
  const params = useParams<{ slug: string }>();
  const search = useSearchParams();
  const slug = String(params.slug || "");
  const selectedService = search.get("service") || "";
  const [data, setData] = useState<MarketplacePayload>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/marketplace", { cache: "no-store", signal: controller.signal })
      .then((response) => response.ok ? response.json() as Promise<MarketplacePayload> : Promise.reject(new Error("Marketplace unavailable")))
      .then((payload) => setData(payload))
      .catch(() => null)
      .finally(() => setLoaded(true));
    return () => controller.abort();
  }, []);

  const provider = useMemo<MarketplaceStorefront | null>(() => {
    return marketplaceStorefronts(data.profiles || [], data.listings || []).find((item) => item.slug === slug) || null;
  }, [data, slug]);

  if (!provider && !loaded) {
    return <main className="mx-auto max-w-6xl px-6 py-14"><div className="h-72 animate-pulse rounded-3xl bg-white/[.04]" /></main>;
  }

  if (!provider) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h1 className="text-4xl font-semibold">Provider store not found</h1>
        <p className="mt-4 text-text-secondary">This provider may still be waiting for Marketplace approval.</p>
        <Link href="/marketplace" className="mt-7 inline-flex rounded-full bg-brand px-5 py-2.5 font-semibold text-black">Back to Marketplace</Link>
      </main>
    );
  }

  const wolf = provider.slug === "wolfbridges-studio";

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <Link href="/marketplace" className="text-sm text-brand hover:underline">← Marketplace</Link>

      <section className="mt-6 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[.03]">
        <div className="relative aspect-[16/7] min-h-64 overflow-hidden bg-black/40">
          {provider.heroImage ? (
            <img src={provider.heroImage} alt="" className={`h-full w-full object-cover ${wolf ? "object-top" : "object-center"}`} />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-6 sm:p-9">
            <p className="text-xs font-semibold uppercase tracking-[.2em] text-brand">
              {provider.kind.replaceAll("_", " ")}{provider.official ? " · Official BVS provider" : provider.verified ? " · BVS verified" : ""}
            </p>
            <h1 className="mt-2 text-balance text-4xl font-semibold text-white sm:text-5xl">{provider.name}</h1>
            <p className="mt-2 max-w-2xl text-white/75">{provider.headline}</p>
            {provider.location ? <p className="mt-3 text-sm font-medium text-brand">{provider.location}</p> : null}
          </div>
        </div>
      </section>

      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div>
          <section aria-labelledby="provider-services-title">
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-brand">Services &amp; products</p>
            <h2 id="provider-services-title" className="mt-2 text-3xl font-semibold">What {provider.name} offers</h2>
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              {provider.services.map((service) => {
                const active = selectedService === service.id;
                const bookingHref = `/marketplace/${provider.slug}/book?service=${encodeURIComponent(service.id)}`;
                const enquiryHref = `/contact?subject=${encodeURIComponent(`${provider.name} — ${service.title}`)}`;
                return (
                  <article id={`service-${service.id}`} key={service.id} className={`rounded-2xl border p-5 ${active ? "border-brand/60 bg-brand/[.06]" : "border-white/10 bg-white/[.025]"}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-brand">{service.category}</p>
                        <h3 className="mt-2 text-xl font-semibold">{service.title}</h3>
                      </div>
                      <strong className="shrink-0 text-brand">{service.priceLabel || `$${service.priceUsd.toFixed(2)}`}</strong>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-text-secondary">{service.description}</p>
                    {service.packages?.length ? (
                      <div className="mt-4 space-y-2">
                        {service.packages.map((pkg) => (
                          <div key={pkg.name} className="rounded-xl border border-white/10 p-3 text-sm">
                            <div className="flex justify-between gap-3"><span className="font-medium">{pkg.name}</span><span className="text-brand">${pkg.priceUsd.toFixed(2)}</span></div>
                            {pkg.description ? <p className="mt-1 text-xs text-text-secondary">{pkg.description}</p> : null}
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {service.turnaroundDays ? <p className="mt-3 text-xs text-text-secondary">Target turnaround: {service.turnaroundDays} days</p> : null}
                    <div className="mt-5">
                      {service.bookingMode === "calendar" ? (
                        <Link href={bookingHref} className="inline-flex min-h-11 items-center rounded-full bg-brand px-5 text-sm font-semibold text-black">See availability &amp; book</Link>
                      ) : service.bookingMode === "checkout" && service.listingId ? (
                        <Link href={`/marketplace?listing=${encodeURIComponent(service.listingId)}`} className="inline-flex min-h-11 items-center rounded-full bg-brand px-5 text-sm font-semibold text-black">Open listing</Link>
                      ) : (
                        <Link href={enquiryHref} className="inline-flex min-h-11 items-center rounded-full border border-brand/45 px-5 text-sm font-semibold text-brand">Ask about this offer</Link>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          {provider.policyNotes?.length ? (
            <section className="mt-8 rounded-2xl border border-amber-300/20 bg-amber-300/[.04] p-5" aria-label="Provider policies">
              <p className="text-xs font-semibold uppercase tracking-[.18em] text-amber-200">Provider note</p>
              <ul className="mt-3 space-y-1 text-sm text-text-secondary">
                {provider.policyNotes.map((note) => <li key={note}>• {note}</li>)}
              </ul>
            </section>
          ) : null}
        </div>

        <aside className="h-fit rounded-2xl border border-white/10 bg-white/[.025] p-5 lg:sticky lg:top-24">
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-brand">Provider profile</p>
          <p className="mt-3 text-sm leading-relaxed text-text-secondary">{provider.bio}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {provider.specialties.map((item) => <span key={item} className="rounded-full bg-white/5 px-3 py-1 text-xs">{item.replaceAll("_", " ")}</span>)}
          </div>
          {wolf ? (
            <p className="mt-5 rounded-xl border border-white/10 p-3 text-xs text-text-secondary">
              Pricing is based on the WolfBridges reference supplied to BVS. Booking times appear only after the studio publishes real availability.
            </p>
          ) : null}
          <Link href="/marketplace" className="mt-5 inline-flex text-sm text-brand hover:underline">Compare other providers →</Link>
        </aside>
      </div>
    </main>
  );
}
