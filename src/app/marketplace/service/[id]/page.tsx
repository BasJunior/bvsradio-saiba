"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { readCartLines, writeCartLines } from "@/lib/cart-client";
import { mediaUrlForStoredValue } from "@/lib/media-url";

type ServicePackage = {
  code?: string;
  name?: string;
  description?: string;
  priceUsd?: number;
};

type Addon = {
  name?: string;
  description?: string;
  priceUsd?: number;
};

type Listing = {
  id: string;
  listing_type: string;
  category: string;
  title: string;
  description: string;
  price_usd: number;
  artwork_path?: string;
  turnaround_days?: number;
  revisions_included?: number;
  packages?: ServicePackage[];
  addons?: Addon[];
  profiles?: {
    username?: string;
    creator_public_name?: string;
    display_name?: string;
  };
};

const slug = (value: string, index: number) =>
  `${value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "package"}-${index + 1}`;

export default function CreatorServiceBookingPage({ params }: { params: Promise<{ id: string }> }) {
  const [listing, setListing] = useState<Listing | null>(null);
  const [selectedCode, setSelectedCode] = useState("");
  const [added, setAdded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void Promise.resolve(params).then(async ({ id }) => {
      try {
        const response = await fetch("/api/marketplace", { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Marketplace unavailable.");
        const found = (payload.listings || []).find((item: Listing) => item.id === id && item.listing_type === "service");
        if (!found) throw new Error("This creator service is not available.");
        setListing(found);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not load this service.");
      }
    });
  }, [params]);

  const packages = useMemo(() => {
    if (!listing) return [];
    const supplied = Array.isArray(listing.packages) ? listing.packages : [];
    if (!supplied.length) {
      return [{ code: "standard-1", name: "Standard", description: listing.description, priceUsd: Number(listing.price_usd) }];
    }
    return supplied.map((item, index) => ({
      ...item,
      code: item.code || slug(String(item.name || "Package"), index),
      name: item.name || `Package ${index + 1}`,
      priceUsd: Number(item.priceUsd ?? listing.price_usd),
    }));
  }, [listing]);

  const selected = packages.find((item) => item.code === selectedCode) || packages[0];

  useEffect(() => {
    if (!selectedCode && packages[0]?.code) setSelectedCode(packages[0].code);
  }, [packages, selectedCode]);

  function addToBasket() {
    if (!listing || !selected) return;
    const current = readCartLines();
    const next = current.filter((line) => !(String(line.id) === listing.id && line.type === "creator_service"));
    next.push({
      id: listing.id,
      title: `${listing.title} — ${selected.name}`,
      artist: listing.profiles?.creator_public_name || listing.profiles?.display_name || listing.profiles?.username || "BVS creator",
      type: "creator_service",
      price: Number(selected.priceUsd || listing.price_usd),
      quantity: 1,
      service_package_code: selected.code,
      delivery: `${listing.turnaround_days || 7} day target · ${listing.revisions_included || 0} included revision(s)`,
    });
    writeCartLines(next);
    setAdded(true);
  }

  if (error) return <main className="mx-auto max-w-3xl px-6 py-16"><h1 className="text-3xl font-semibold">Service unavailable</h1><p className="mt-4 text-text-secondary">{error}</p><Link href="/marketplace" className="mt-6 inline-block text-brand">Back to Creator Marketplace →</Link></main>;
  if (!listing) return <main className="p-16 text-center text-text-secondary">Loading creator service…</main>;

  return <main className="mx-auto max-w-5xl px-6 py-12">
    <Link href="/marketplace" className="text-sm text-brand">← Creator Marketplace</Link>
    <div className="mt-8 grid gap-8 lg:grid-cols-[.85fr_1.15fr]">
      <div>
        {listing.artwork_path ? <img src={mediaUrlForStoredValue(listing.artwork_path) || undefined} alt={`${listing.title} artwork`} className="aspect-square w-full rounded-3xl object-cover" /> : <div className="aspect-square rounded-3xl border border-white/10 bg-white/[.03]" />}
      </div>
      <section>
        <p className="text-xs uppercase tracking-[.2em] text-brand">{listing.category.replaceAll("_", " ")} · creator service</p>
        <h1 className="mt-3 text-4xl font-semibold">{listing.title}</h1>
        <p className="mt-3 text-text-secondary">by {listing.profiles?.creator_public_name || listing.profiles?.display_name || listing.profiles?.username || "BVS creator"}</p>
        <p className="mt-6 text-text-secondary">{listing.description}</p>
        <p className="mt-4 text-sm text-text-secondary">Target delivery: {listing.turnaround_days || 7} days · {listing.revisions_included || 0} included revision(s)</p>

        <div className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold">Choose a package</h2>
          {packages.map((item) => <label key={item.code} className={`block cursor-pointer rounded-2xl border p-4 ${selected?.code === item.code ? "border-brand/60 bg-brand/[.06]" : "border-white/10"}`}>
            <div className="flex gap-3">
              <input type="radio" name="service-package" value={item.code} checked={selected?.code === item.code} onChange={() => setSelectedCode(String(item.code))} />
              <div className="flex-1"><div className="flex items-center justify-between gap-4"><strong>{item.name}</strong><strong>${Number(item.priceUsd || listing.price_usd).toFixed(2)}</strong></div>{item.description ? <p className="mt-2 text-sm text-text-secondary">{item.description}</p> : null}</div>
            </div>
          </label>)}
        </div>

        {Array.isArray(listing.addons) && listing.addons.length ? <div className="mt-8 rounded-2xl border border-white/10 p-5"><h2 className="font-semibold">Available add-ons</h2><p className="mt-1 text-xs text-text-secondary">Add-ons are shown for planning; checkout support is enabled only when the seller's plan and listing support them.</p><div className="mt-3 space-y-2">{listing.addons.map((addon, index) => <div key={`${addon.name}-${index}`} className="flex justify-between gap-4 text-sm"><span>{addon.name || "Add-on"}</span><span>{Number(addon.priceUsd || 0) > 0 ? `+$${Number(addon.priceUsd).toFixed(2)}` : "Ask creator"}</span></div>)}</div></div> : null}

        <div className="mt-8 flex flex-wrap gap-3">
          <button type="button" onClick={addToBasket} className="rounded-full bg-brand px-6 py-3 font-semibold text-black">{added ? "Package added" : `Book for $${Number(selected?.priceUsd || listing.price_usd).toFixed(2)}`}</button>
          {added ? <Link href="/checkout" className="rounded-full border border-white/20 px-6 py-3">Continue to checkout</Link> : null}
        </div>
        <p className="mt-4 text-xs text-text-secondary">BVS requires a project brief at checkout. Creator earnings remain held until delivery is accepted; disputes and cancellations stay reviewable.</p>
      </section>
    </div>
  </main>;
}
