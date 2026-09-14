"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  marketplaceStorefronts,
  seededMarketplaceServiceRef,
  type MarketplaceStorefront,
  type StorefrontService,
} from "@/lib/marketplace-storefronts";
import MarketplaceProviderMap from "@/components/MarketplaceProviderMap";
import { readCartLines, writeCartLines } from "@/lib/cart-client";

type MarketplacePayload = {
  profiles?: Parameters<typeof marketplaceStorefronts>[0];
  listings?: Parameters<typeof marketplaceStorefronts>[1];
};

export default function MarketplaceStorefrontPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const search = useSearchParams();
  const slug = String(params.slug || "");
  const selectedService = search.get("service") || "";
  const [data, setData] = useState<MarketplacePayload>({});
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [offerFilter, setOfferFilter] = useState("all");
  const [shareMessage, setShareMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoadError(false);
    setLoaded(false);
    fetch("/api/marketplace", { cache: "no-store", signal: controller.signal })
      .then((response) => response.ok ? response.json() as Promise<MarketplacePayload> : Promise.reject(new Error("Marketplace unavailable")))
      .then((payload) => setData(payload))
      .catch((error) => { if (error.name !== "AbortError") setLoadError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoaded(true); });
    return () => controller.abort();
  }, [retry]);

  const provider = useMemo<MarketplaceStorefront | null>(() => {
    return marketplaceStorefronts(data.profiles || [], data.listings || []).find((item) => item.slug === slug) || null;
  }, [data, slug]);

  if (!provider && !loaded) {
    return <main className="mx-auto max-w-6xl px-6 py-14"><div className="h-72 animate-pulse rounded-3xl bg-white/[.04]" /></main>;
  }

  if (loadError && !provider) {
    return <main className="mx-auto max-w-3xl px-6 py-20 text-center">
      <h1 className="text-3xl font-semibold">Your connection to this store was interrupted</h1>
      <p className="mt-3 text-text-secondary">Try again to load the provider’s latest offers.</p>
      <button onClick={() => setRetry(value => value + 1)} className="mt-6 min-h-11 rounded-full bg-brand px-6 font-semibold text-black">Try again</button>
    </main>;
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

  function checkoutService(service: StorefrontService, packageIndex?: number) {
    if (!provider) return;
    const selectedPackage = typeof packageIndex === "number" ? service.packages?.[packageIndex] : undefined;
    const title = selectedPackage ? `${service.title} — ${selectedPackage.name}` : service.title;
    const price = selectedPackage?.priceUsd ?? service.priceUsd;
    const isCreatorListing = Boolean(service.listingId);
    const type = isCreatorListing
      ? service.listingType === "digital_product" ? "creator_product" : "creator_service"
      : "service";
    const id = isCreatorListing
      ? String(service.listingId)
      : `marketplace:${seededMarketplaceServiceRef(provider.slug, service.id, packageIndex)}`;
    const line = {
      id,
      title,
      artist: provider.name,
      type,
      price,
      quantity: 1,
      delivery: type === "creator_product"
        ? "Private digital delivery after confirmed payment."
        : `${provider.name} service order — project brief and delivery are handled through BVS.`,
    };

    if (type === "creator_product") {
      const current = readCartLines();
      const existing = current.findIndex((item) => String(item.id) === id && item.type === type);
      const next = [...current];
      if (existing >= 0) next[existing] = line;
      else next.push(line);
      writeCartLines(next);
    } else {
      writeCartLines([line]);
    }
    router.push("/checkout");
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/marketplace" className="text-sm text-brand hover:underline">← Marketplace</Link>
        <div className="flex items-center gap-3">
          <span role="status" className="text-xs text-text-secondary">{shareMessage}</span>
          <button type="button" className="min-h-11 rounded-full border border-white/15 px-4 text-sm" onClick={async () => {
            try { await navigator.clipboard.writeText(window.location.href); setShareMessage("Store link copied"); }
            catch { setShareMessage("Copy the link from your address bar to share this store."); }
          }}>Share store</button>
        </div>
      </div>
      {loadError ? <p role="alert" className="mt-4 rounded-xl border border-white/15 p-4 text-sm">Latest creator offers could not load. <button onClick={() => setRetry(value => value + 1)} className="text-brand underline">Try again</button></p> : null}

      <section className="mt-6 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[.03]">
        <div className="marketplace-storefront-hero relative aspect-[16/7] min-h-64 overflow-hidden bg-black/40">
          {provider.heroImage ? (
            <img src={provider.heroImage} alt="" className={`h-full w-full object-cover ${wolf ? "object-top" : "object-center"}`} />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-6 sm:p-9">
            <p className="text-xs font-semibold uppercase tracking-[.2em] text-brand">
              {provider.kind.replaceAll("_", " ")}{provider.official ? " · Official BVS provider" : provider.verified ? " · BVS verified" : ""}
            </p>
            <div className="mt-3 flex items-center gap-4">
              {provider.avatarImage ? <img src={provider.avatarImage} alt="" className="h-16 w-16 shrink-0 rounded-2xl border-2 border-white/30 object-cover sm:h-20 sm:w-20" /> : null}
              <h1 className="text-balance text-3xl font-semibold text-white sm:text-5xl">{provider.name}</h1>
            </div>
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
            <div className="mt-5 flex flex-wrap gap-2" aria-label="Filter offers">
              {[['all', 'All offers'], ['service', 'Services'], ['digital_product', 'Downloads']].map(([value, label]) => <button key={value} type="button" aria-pressed={offerFilter === value} onClick={() => setOfferFilter(value)} className={`min-h-11 rounded-full border px-4 text-sm ${offerFilter === value ? 'border-brand bg-brand/10 text-brand' : 'border-white/10 text-text-secondary'}`}>{label}</button>)}
            </div>
            {!provider.services.some(service => offerFilter === 'all' || (service.listingType || 'service') === offerFilter) ? <div className="mt-6 rounded-2xl border border-dashed border-white/15 p-8 text-center"><h3 className="font-semibold">No {offerFilter === 'digital_product' ? 'downloads' : offerFilter === 'service' ? 'services' : 'offers'} available yet</h3><p className="mt-2 text-sm text-text-secondary">New offers will appear here when this provider publishes them.</p></div> : null}
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              {provider.services.filter(service => offerFilter === 'all' || (service.listingType || 'service') === offerFilter).map((service) => {
                const active = selectedService === service.id;
                const bookingHref = `/marketplace/${provider.slug}/book?service=${encodeURIComponent(service.id)}`;
                const packageCheckout = service.bookingMode === "checkout" && !service.listingId && Boolean(service.packages?.length);
                return (
                  <article id={`service-${service.id}`} key={service.id} className={`rounded-2xl border p-5 ${active ? "border-brand/60 bg-brand/[.06]" : "border-white/10 bg-white/[.025]"}`}>
                    {service.artworkImage ? <img src={service.artworkImage} alt="" loading="lazy" className="mb-4 aspect-[16/10] w-full rounded-xl object-cover" /> : null}
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
                        {service.packages.map((pkg, packageIndex) => (
                          <div key={pkg.name} className="rounded-xl border border-white/10 p-3 text-sm">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <span className="font-medium">{pkg.name}</span>
                                {pkg.description ? <p className="mt-1 text-xs text-text-secondary">{pkg.description}</p> : null}
                              </div>
                              <span className="shrink-0 text-brand">${pkg.priceUsd.toFixed(2)}</span>
                            </div>
                            {packageCheckout ? (
                              <button
                                type="button"
                                onClick={() => checkoutService(service, packageIndex)}
                                className="mt-3 inline-flex min-h-10 items-center rounded-full bg-brand px-4 text-xs font-semibold text-black"
                              >
                                Checkout {pkg.name}
                              </button>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {service.turnaroundDays ? <p className="mt-3 text-xs text-text-secondary">Target turnaround: {service.turnaroundDays} days</p> : null}
                    <div className="mt-5">
                      {service.bookingMode === "calendar" ? (
                        <Link href={bookingHref} className="inline-flex min-h-11 items-center rounded-full bg-brand px-5 text-sm font-semibold text-black">See availability &amp; book</Link>
                      ) : service.bookingMode === "checkout" && !packageCheckout ? (
                        <button type="button" onClick={() => checkoutService(service)} className="inline-flex min-h-11 items-center rounded-full bg-brand px-5 text-sm font-semibold text-black">
                          {service.listingType === "digital_product" ? "Buy now" : "Continue to checkout"}
                        </button>
                      ) : service.bookingMode === "enquiry" ? (
                        <Link href="/marketplace" className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-5 text-sm font-semibold text-text-secondary">Compare providers</Link>
                      ) : null}
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

        <aside className="h-fit space-y-5 lg:sticky lg:top-24">
          <div className="rounded-2xl border border-white/10 bg-white/[.025] p-5">
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-brand">Provider profile</p>
            <p className="mt-3 text-sm leading-relaxed text-text-secondary">{provider.bio}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {provider.specialties.map((item) => <span key={item} className="rounded-full bg-white/5 px-3 py-1 text-xs">{item.replaceAll("_", " ")}</span>)}
            </div>
            {wolf ? (
              <p className="mt-5 rounded-xl border border-white/10 p-3 text-xs text-text-secondary">
                Choose an available time to request a studio session. All times are shown in the studio’s timezone.
              </p>
            ) : null}
            <Link href="/marketplace" className="mt-5 inline-flex text-sm text-brand hover:underline">Compare other providers →</Link>
          </div>
          <MarketplaceProviderMap providers={[provider]} compact />
        </aside>
      </div>
    </main>
  );
}
