"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { readCartLines, writeCartLines } from "@/lib/cart-client";
import { mediaUrlForStoredValue } from "@/lib/media-url";

type Listing = {
  id: string;
  listing_type: string;
  category: string;
  title: string;
  description: string;
  price_usd: number;
  artwork_path?: string;
  licence_summary?: string;
  compatibility?: string;
  turnaround_days?: number;
  revisions_included?: number;
  profiles?: {
    username?: string;
    creator_public_name?: string;
    display_name?: string;
  };
};
type Profile = {
  user_id: string;
  roles: string[];
  headline: string;
  bio: string;
  experience?: string;
  skills: string[];
  equipment?: string[];
  software?: string[];
  accomplishments: Array<{
    title: string;
    detail?: string;
    verification?: string;
  }>;
  profiles?: {
    username?: string;
    creator_public_name?: string;
    display_name?: string;
  };
};

export default function MarketplacePage() {
  const [data, setData] = useState<{
    listings: Listing[];
    profiles: Profile[];
  }>({ listings: [], profiles: [] });
  const [added, setAdded] = useState<string | null>(null);
  useEffect(() => {
    void fetch("/api/marketplace", { cache: "no-store" })
      .then((r) => r.json())
      .then(setData)
      .catch(() => null);
  }, []);
  function addProduct(item: Listing) {
    const current = readCartLines();
    const cartType =
      item.listing_type === "service" ? "creator_service" : "creator_product";
    const existing = current.findIndex(
      (line) => String(line.id) === item.id && line.type === cartType,
    );
    const next = [...current];
    if (existing >= 0) next[existing] = { ...next[existing], quantity: 1 };
    else
      next.push({
        id: item.id,
        title: item.title,
        artist:
          item.profiles?.creator_public_name ||
          item.profiles?.display_name ||
          item.profiles?.username ||
          "BVS creator",
        type: cartType,
        price: Number(item.price_usd),
        quantity: 1,
        delivery:
          item.listing_type === "service"
            ? `${item.turnaround_days || 7} day target · ${item.revisions_included || 0} revision(s)`
            : item.licence_summary ||
              "Private download after confirmed payment",
      });
    writeCartLines(next);
    setAdded(item.id);
  }
  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <p className="text-xs uppercase tracking-[.24em] text-brand">
        BVS Creator Marketplace
      </p>
      <h1 className="mt-3 text-5xl font-semibold">
        Discover creative talent and tools for your next project.
      </h1>
      <p className="mt-5 max-w-3xl text-lg text-text-secondary">
        Explore production assets from BVS creators, find skilled music
        professionals and connect with the people behind the sound.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/catalogue?type=beat#beatstore"
          className="rounded-full bg-brand px-5 py-2 font-semibold text-black"
        >
          Browse beats
        </Link>
        <a
          href="#products"
          className="rounded-full border border-white/20 px-5 py-2"
        >
          Creator products
        </a>
        <Link
          href="/shop"
          className="rounded-full border border-white/20 px-5 py-2"
        >
          Official BVS Studio Services
        </Link>
        <a
          href="#creators"
          className="rounded-full border border-white/20 px-5 py-2"
        >
          Find creators
        </a>
        <Link
          href="/creator/studio#marketplace-desk"
          className="rounded-full border border-brand/50 px-5 py-2 text-brand"
        >
          Sell on BVS
        </Link>
      </div>

      <section id="products" className="mt-16">
        <p className="text-xs uppercase tracking-[.2em] text-brand">
          Creator products &amp; services
        </p>
        <h2 className="mt-2 text-3xl font-semibold">
          Tools and talent for music makers
        </h2>
        {data.listings.length ? (
          <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {data.listings.map((item) => (
              <article
                key={item.id}
                className="overflow-hidden rounded-2xl border border-white/10 bg-white/[.03]"
              >
                {item.artwork_path ? (
                  <img
                    src={mediaUrlForStoredValue(item.artwork_path) || undefined}
                    alt={`${item.title} cover`}
                    className="aspect-square w-full object-cover"
                  />
                ) : null}
                <div className="p-6">
                <div className="flex justify-between gap-4">
                  <span className="text-xs uppercase text-brand">
                    {item.listing_type.replaceAll("_", " ")} ·{" "}
                    {item.category.replaceAll("_", " ")}
                  </span>
                  <strong>${Number(item.price_usd).toFixed(2)}</strong>
                </div>
                <h3 className="mt-3 text-xl font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-text-secondary">
                  {item.description}
                </p>
                <p className="mt-4 text-xs text-text-secondary">
                  by{" "}
                  {item.profiles?.creator_public_name ||
                    item.profiles?.display_name ||
                    item.profiles?.username ||
                    "BVS creator"}
                </p>
                {item.listing_type === "service" ? (
                  <p className="mt-3 rounded-xl border border-white/10 p-3 text-xs text-text-secondary">
                    Target: {item.turnaround_days || 7} days ·{" "}
                    {item.revisions_included || 0} included revision(s)
                  </p>
                ) : item.licence_summary ? (
                  <p className="mt-3 rounded-xl border border-white/10 p-3 text-xs text-text-secondary">
                    Licence: {item.licence_summary}
                  </p>
                ) : null}
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => addProduct(item)}
                    className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-black"
                  >
                    {added === item.id
                      ? "Added to basket"
                      : item.listing_type === "service"
                        ? "Book service"
                        : "Add to basket"}
                  </button>
                  {added === item.id ? (
                    <Link
                      href="/checkout"
                      className="rounded-full border border-white/20 px-4 py-2 text-sm"
                    >
                      Checkout
                    </Link>
                  ) : null}
                </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-white/10 p-8 text-text-secondary">
            New creator products and services are on the way. Browse beats now
            or check back as the collection grows.
          </div>
        )}
      </section>

      <section id="creators" className="mt-16">
        <p className="text-xs uppercase tracking-[.2em] text-brand">
          Creator directory
        </p>
        <h2 className="mt-2 text-3xl font-semibold">Meet BVS creators</h2>
        {data.profiles.length ? (
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            {data.profiles.map((profile) => (
              <article
                key={profile.user_id}
                className="rounded-2xl border border-white/10 p-6"
              >
                <p className="text-xs uppercase text-brand">
                  {profile.roles.join(" · ")}
                </p>
                <h3 className="mt-2 text-xl font-semibold">
                  {profile.profiles?.creator_public_name ||
                    profile.profiles?.display_name ||
                    profile.profiles?.username}
                </h3>
                <p className="mt-2 text-sm text-text-secondary">
                  {profile.headline || profile.bio}
                </p>
                {profile.experience ? (
                  <p className="mt-3 text-xs text-text-secondary">
                    Experience: {profile.experience}
                  </p>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  {profile.skills?.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-full bg-white/5 px-3 py-1 text-xs"
                    >
                      {skill.replaceAll("_", " ")}
                    </span>
                  ))}
                </div>
                {[...(profile.software || []), ...(profile.equipment || [])]
                  .length ? (
                  <p className="mt-3 text-xs text-text-secondary">
                    Tools:{" "}
                    {[
                      ...(profile.software || []),
                      ...(profile.equipment || []),
                    ].join(" · ")}
                  </p>
                ) : null}
                {profile.accomplishments?.slice(0, 3).map((item) => (
                  <p
                    key={item.title}
                    className="mt-3 text-xs text-text-secondary"
                  >
                    • {item.title}{" "}
                    <span className="text-white/40">
                      ·{" "}
                      {item.verification === "verified"
                        ? "BVS verified"
                        : "provided by creator"}
                    </span>
                  </p>
                ))}
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-6 text-text-secondary">
            Creator profiles are coming soon. In the meantime, explore the
            artists and producers already on BVS.
          </p>
        )}
      </section>

      <section className="mt-16 grid gap-5 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 p-6">
          <h3 className="font-semibold">Made by creators</h3>
          <p className="mt-2 text-sm text-text-secondary">
            Find sounds, tools and talent from people working across music and
            audio.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 p-6">
          <h3 className="font-semibold">Clear licences</h3>
          <p className="mt-2 text-sm text-text-secondary">
            Review what each purchase allows before you add it to your project.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 p-6">
          <h3 className="font-semibold">Reviewed by BVS</h3>
          <p className="mt-2 text-sm text-text-secondary">
            Listings are reviewed before publication to support a trusted
            marketplace.
          </p>
        </div>
      </section>
    </main>
  );
}
