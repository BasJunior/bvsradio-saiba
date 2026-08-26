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
    <article className="overflow-hidden rounded-3xl border border-white/10 bg-white/[.03]">
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
          <div className="absolute bottom-0 left-0 right-0 p-5">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.16em] text-brand">
              {provider.kind.replaceAll("_", " ")}
              {provider.official ? <span>· Official BVS</span> : provider.verified ? <span>· Verified</span> : null}
            </div>
            <h2 className="mt-1 text-2xl font-semibold text-white">{provider.name}</h2>
            {provider.location ? <p className="mt-1 text-sm text-white/70">{provider.location}</p> : null}
          </div>
        </div>
      </Link>
      <div className="p-5">
        <p className="text-sm text-text-secondary">{provider.headline}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {provider.specialties.slice(0, 5).map((item) => (
            <span key={item} className="rounded-full bg-white/5 px-3 py-1 text-xs text-text-secondary">
              {item.replaceAll("_", " ")}
            </span>
          ))}
        </div>
        <Link
          href={`/marketplace/${provider.slug}`}
          className="mt-5 inline-flex min-h-11 items-center rounded-full bg-brand px-5 text-sm font-semibold text-black"
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
    <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <section className="max-w-4xl">
        <p className="text-xs font-semibold uppercase tracking-[.22em] text-brand">BVS Marketplace</p>
        <h1 className="mt-3 text-balance text-4xl font-semibold sm:text-5xl md:text-6xl">
          Find the studio, engineer or creative service for your next record.
        </h1>
        <p className="mt-5 max-w-3xl text-lg text-text-secondary">
          One marketplace for independent BVS providers and official BVS services. Open a provider store, compare what they offer and book real published studio availability when a calendar is available.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/marketplace/studios" className="rounded-full bg-brand px-5 py-2.5 font-semibold text-black">Book a studio session near you</Link>
          <a href="#providers" className="rounded-full border border-white/20 px-5 py-2.5">Studios &amp; engineers</a>
          <a href="#services" className="rounded-full border border-white/20 px-5 py-2.5">Browse services</a>
          <Link href="/catalogue?type=beat#beatstore" className="rounded-full border border-white/20 px-5 py-2.5">BeatStore</Link>
          <Link href="/creator/marketplace" className="rounded-full border border-brand/45 px-5 py-2.5 text-brand">Open a provider store</Link>
        </div>
      </section>

      <section id="providers" className="mt-16" aria-labelledby="marketplace-providers-title">
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-brand">Provider storefronts</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <h2 id="marketplace-providers-title" className="text-3xl font-semibold sm:text-4xl">Studios, engineers and producers</h2>
          <p className="max-w-lg text-sm text-text-secondary">Each provider keeps their services, prices, policies and availability together in one store.</p>
        </div>
        <div className="mt-7 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {storefronts.map((provider) => <ProviderCard key={provider.slug} provider={provider} />)}
        </div>
      </section>

      <section id="services" className="mt-16" aria-labelledby="marketplace-services-title">
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-brand">Services</p>
        <h2 id="marketplace-services-title" className="mt-2 text-3xl font-semibold sm:text-4xl">Browse what providers offer</h2>
        <div className="mt-7 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {storefronts.flatMap((provider) => provider.services.map((service) => (
            <article key={`${provider.slug}-${service.id}`} className="rounded-2xl border border-white/10 bg-white/[.025] p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-brand">{service.category}</p>
              <h3 className="mt-2 text-xl font-semibold">{service.title}</h3>
              <p className="mt-1 text-sm text-text-secondary">by {provider.name}</p>
              <p className="mt-3 text-sm text-text-secondary">{service.description}</p>
              <div className="mt-5 flex items-center justify-between gap-3">
                <strong>{service.priceLabel || `$${service.priceUsd.toFixed(2)}`}</strong>
                <Link href={`/marketplace/${provider.slug}?service=${encodeURIComponent(service.id)}`} className="rounded-full border border-brand/40 px-4 py-2 text-sm text-brand">
                  View service
                </Link>
              </div>
            </article>
          )))}
        </div>
      </section>

      {state === "error" ? (
        <p className="mt-12 rounded-2xl border border-amber-300/20 bg-amber-300/[.05] p-5 text-sm text-text-secondary">
          Live creator listings could not load. The seeded BVS provider stores remain available while the Marketplace reconnects.
        </p>
      ) : null}

      {state === "loading" ? <div className="mt-12 h-24 animate-pulse rounded-2xl bg-white/[.03]" /> : null}

      {liveProducts.length ? (
        <section className="mt-16" aria-labelledby="marketplace-products-title">
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-brand">Digital products</p>
          <h2 id="marketplace-products-title" className="mt-2 text-3xl font-semibold">Creator tools and downloads</h2>
          <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {liveProducts.map((item) => (
              <article key={item.id} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[.03]">
                {item.artwork_path ? <img src={mediaUrlForStoredValue(item.artwork_path) || undefined} alt="" className="aspect-square w-full object-cover" /> : null}
                <div className="p-5">
                  <p className="text-xs uppercase text-brand">{item.category.replaceAll("_", " ")}</p>
                  <h3 className="mt-2 text-xl font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm text-text-secondary">{item.description}</p>
                  <div className="mt-5 flex items-center justify-between gap-3">
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

      <section className="mt-16 rounded-3xl border border-white/10 bg-white/[.025] p-7 sm:p-9">
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-brand">For providers</p>
        <h2 className="mt-2 text-3xl font-semibold">Your services should live under your name.</h2>
        <p className="mt-3 max-w-3xl text-text-secondary">Approved studios, engineers and producers can publish service listings from the Creator Marketplace desk. BVS groups those listings into the provider storefront automatically instead of creating another services section.</p>
        <Link href="/creator/marketplace" className="mt-6 inline-flex min-h-11 items-center rounded-full border border-brand/45 px-5 font-semibold text-brand">Manage provider store →</Link>
      </section>
    </main>
  );
}
