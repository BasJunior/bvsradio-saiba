"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  marketplaceStorefronts,
  type MarketplaceStorefront,
} from "@/lib/marketplace-storefronts";
import { mediaUrlForStoredValue } from "@/lib/media-url";
import { readCartLines, writeCartLines } from "@/lib/cart-client";

type MarketplacePayload = {
  profiles?: Parameters<typeof marketplaceStorefronts>[0];
  listings?: Parameters<typeof marketplaceStorefronts>[1];
};

function ProviderCard({ provider }: { provider: MarketplaceStorefront }) {
  const wolf = provider.slug === "wolfbridges-studio";
  return (
    <article className="bvs-surface bvs-surface-hover overflow-hidden rounded-[1.65rem] sm:rounded-3xl">
      <Link href={`/marketplace/${provider.slug}`} className="group block">
        <div className="relative aspect-[16/9] overflow-hidden bg-black/40">
          {provider.heroImage ? (
            <img
              src={provider.heroImage}
              alt=""
              className={`h-full w-full object-cover transition duration-300 group-hover:scale-[1.02] ${wolf ? "object-top" : "object-center"}`}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-text-secondary">Provider artwork</div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="bvs-chip bvs-chip-brand">{provider.kind.replaceAll("_", " ")}</span>
              {provider.official ? <span className="bvs-chip">Official BVS</span> : provider.verified ? <span className="bvs-chip">Verified</span> : null}
            </div>
            <h2 className="mt-2 text-2xl font-semibold text-white">{provider.name}</h2>
            {provider.location ? <p className="mt-1 text-sm text-white/70">{provider.location}</p> : null}
          </div>
        </div>
      </Link>
      <div className="p-4 sm:p-5">
        <p className="text-sm text-text-secondary">{provider.headline}</p>
        <div className="mt-3 flex flex-wrap gap-2 sm:mt-4">
          {provider.specialties.slice(0, 5).map((item) => (
            <span key={item} className="bvs-chip normal-case tracking-normal">
              {item.replaceAll("_", " ")}
            </span>
          ))}
        </div>
        <Link
          href={`/marketplace/${provider.slug}`}
          className="mt-4 inline-flex min-h-11 items-center rounded-full bg-brand px-5 text-sm font-semibold text-black shadow-[0_10px_28px_rgba(212,175,55,.2)] sm:mt-5"
        >
          {wolf ? "Open Wolf Studio" : `Open ${provider.kind === "official" ? "BVS Studio" : "store"}`}
        </Link>
      </div>
    </article>
  );
}

export default function MarketplacePage() {
  const [data, setData] = useState<MarketplacePayload>({});
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [added, setAdded] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/marketplace", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Marketplace unavailable");
        return response.json() as Promise<MarketplacePayload>;
      })
      .then((payload) => {
        setData(payload);
        setState("ready");
      })
      .catch((error) => {
        if ((error as Error).name !== "AbortError") setState("error");
      });
    return () => controller.abort();
  }, []);

  const storefronts = useMemo(
    () => marketplaceStorefronts(data.profiles || [], data.listings || []),
    [data],
  );

  const liveProducts = (data.listings || []).filter((item) => item.listing_type === "digital_product");

  function addProduct(item: (typeof liveProducts)[number]) {
    const current = readCartLines();
    const existing = current.findIndex((line) => String(line.id) === item.id && line.type === "creator_product");
    const next = [...current];
    if (existing >= 0) next[existing] = { ...next[existing], quantity: 1 };
    else next.push({
      id: item.id,
      title: item.title,
      artist: "BVS creator",
      type: "creator_product",
      price: Number(item.price_usd),
      quantity: 1,
      delivery: "Private download after confirmed payment",
    });
    writeCartLines(next);
    setAdded(item.id);
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
      <section className="max-w-4xl">
        <p className="bvs-section-kicker">BVS Marketplace</p>
        <h1 className="mt-3 text-balance text-4xl font-semibold sm:text-5xl md:text-6xl">
          Find the studio, engineer or creative service for your next record.
        </h1>
        <p className="mt-4 max-w-3xl text-base text-text-secondary sm:mt-5 sm:text-lg">
          One marketplace for independent BVS providers and official BVS services. Open a provider store, compare what they offer and book real published studio availability when a calendar is available.
        </p>
        <div className="mt-6 flex flex-wrap gap-2.5 sm:mt-7 sm:gap-3">
          <a href="#providers" className="rounded-full bg-brand px-5 py-2.5 font-semibold text-black shadow-[0_10px_28px_rgba(212,175,55,.18)]">Studios &amp; engineers</a>
          <a href="#services" className="rounded-full border border-white/15 bg-white/[.03] px-5 py-2.5">Browse services</a>
          <Link href="/catalogue?type=beat#beatstore" className="rounded-full border border-white/15 bg-white/[.03] px-5 py-2.5">BeatStore</Link>
          <Link href="/creator/marketplace" className="rounded-full border border-brand/45 bg-brand/[.06] px-5 py-2.5 text-brand">Open a provider store</Link>
        </div>
      </section>

      <section id="providers" className="mt-10 sm:mt-16" aria-labelledby="marketplace-providers-title">
        <p className="bvs-section-kicker">Provider storefronts</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3 sm:gap-4">
          <h2 id="marketplace-providers-title" className="text-3xl font-semibold sm:text-4xl">Studios, engineers and producers</h2>
          <p className="max-w-lg text-sm text-text-secondary">Each provider keeps their services, prices, policies and availability together in one store.</p>
        </div>
        <div className="mt-5 grid gap-4 sm:mt-7 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
          {storefronts.map((provider) => <ProviderCard key={provider.slug} provider={provider} />)}
        </div>
      </section>

      <section id="services" className="mt-10 sm:mt-16" aria-labelledby="marketplace-services-title">
        <p className="bvs-section-kicker">Services</p>
        <h2 id="marketplace-services-title" className="mt-2 text-3xl font-semibold sm:text-4xl">Browse what providers offer</h2>
        <div className="mt-5 grid gap-3 sm:mt-7 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
          {storefronts.flatMap((provider) => provider.services.map((service) => (
            <article key={`${provider.slug}-${service.id}`} className="bvs-surface bvs-surface-hover rounded-[1.35rem] p-4 sm:rounded-2xl sm:p-5">
              <p className="bvs-chip bvs-chip-brand">{service.category}</p>
              <h3 className="mt-3 text-xl font-semibold">{service.title}</h3>
              <p className="mt-1 text-sm text-text-secondary">by {provider.name}</p>
              <p className="mt-3 text-sm text-text-secondary">{service.description}</p>
              <div className="mt-4 flex items-center justify-between gap-3 sm:mt-5">
                <strong>{service.priceLabel || `$${service.priceUsd.toFixed(2)}`}</strong>
                <Link href={`/marketplace/${provider.slug}?service=${encodeURIComponent(service.id)}`} className="rounded-full border border-brand/40 bg-brand/[.05] px-4 py-2 text-sm text-brand">
                  View service
                </Link>
              </div>
            </article>
          )))}
        </div>
      </section>

      {state === "error" ? (
        <p className="bvs-surface-quiet mt-8 rounded-[1.35rem] border-dashed p-4 text-sm text-text-secondary sm:mt-12 sm:p-5">
          Live creator listings could not load. The seeded BVS provider stores remain available while the Marketplace reconnects.
        </p>
      ) : null}

      {state === "loading" ? <div className="bvs-surface mt-8 h-24 animate-pulse rounded-[1.35rem] sm:mt-12" /> : null}

      {liveProducts.length ? (
        <section className="mt-10 sm:mt-16" aria-labelledby="marketplace-products-title">
          <p className="bvs-section-kicker">Digital products</p>
          <h2 id="marketplace-products-title" className="mt-2 text-3xl font-semibold">Creator tools and downloads</h2>
          <div className="mt-5 grid gap-4 sm:mt-6 sm:gap-5 md:grid-cols-2 lg:grid-cols-3">
            {liveProducts.map((item) => (
              <article key={item.id} className="bvs-surface bvs-surface-hover overflow-hidden rounded-[1.35rem] sm:rounded-2xl">
                {item.artwork_path ? <img src={mediaUrlForStoredValue(item.artwork_path) || undefined} alt="" className="aspect-square w-full object-cover" /> : null}
                <div className="p-4 sm:p-5">
                  <p className="bvs-chip bvs-chip-brand">{item.category.replaceAll("_", " ")}</p>
                  <h3 className="mt-3 text-xl font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm text-text-secondary">{item.description}</p>
                  <div className="mt-4 flex items-center justify-between gap-3 sm:mt-5">
                    <strong>${Number(item.price_usd).toFixed(2)}</strong>
                    <button type="button" onClick={() => addProduct(item)} className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-black">
                      {added === item.id ? "Added" : "Add to basket"}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="bvs-surface mt-10 rounded-[1.65rem] p-5 sm:mt-16 sm:rounded-3xl sm:p-9">
        <p className="bvs-section-kicker">For providers</p>
        <h2 className="mt-2 text-3xl font-semibold">Your services should live under your name.</h2>
        <p className="mt-3 max-w-3xl text-text-secondary">Approved studios, engineers and producers can publish service listings from the Creator Marketplace desk. BVS groups those listings into the provider storefront automatically instead of creating another services section.</p>
        <Link href="/creator/marketplace" className="mt-5 inline-flex min-h-11 items-center rounded-full border border-brand/45 bg-brand/[.05] px-5 font-semibold text-brand sm:mt-6">Manage provider store →</Link>
      </section>
    </main>
  );
}
