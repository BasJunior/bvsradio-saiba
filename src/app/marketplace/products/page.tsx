"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import ProductPreviewButton from "@/components/ProductPreviewButton";
import { trackEvent } from "@/lib/analytics";
import {
  SHELF_CATEGORIES,
  addShelfProductToCart,
  plannedProductsToShow,
  shelfCategoryLabel,
  shelfPrice,
  type ShelfProduct,
} from "@/lib/product-shelf";

export default function ProductShelfPage() {
  const [products, setProducts] = useState<ShelfProduct[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [added, setAdded] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const impressionSent = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/marketplace/products", { cache: "no-store", signal: controller.signal })
      .then((response) => (response.ok ? (response.json() as Promise<{ products?: ShelfProduct[] }>) : Promise.reject(new Error("Shelf unavailable"))))
      .then((payload) => {
        const loaded = payload.products || [];
        setProducts(loaded);
        setState("ready");
        if (!impressionSent.current) {
          impressionSent.current = true;
          trackEvent("product_shelf_view", { product_count: loaded.length });
        }
      })
      .catch((error) => {
        if ((error as Error).name !== "AbortError") setState("error");
      });
    return () => controller.abort();
  }, [retry]);

  const liveCategories = useMemo(
    () => SHELF_CATEGORIES.filter((item) => products.some((product) => product.category === item.id)),
    [products],
  );
  const needle = query.trim().toLowerCase();
  const visible = products.filter(
    (product) =>
      (category === "all" || product.category === category) &&
      `${product.title} ${product.sellerName} ${product.categoryLabel} ${product.description}`.toLowerCase().includes(needle),
  );
  const planned = state === "ready" ? plannedProductsToShow(products) : [];

  function add(product: ShelfProduct) {
    if (product.fixture) return;
    addShelfProductToCart(product);
    setAdded(product.id);
    trackEvent("product_add_to_cart", { product_id: product.id, category: product.category, price: product.priceUsd, source: "shelf" });
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <Link href="/marketplace" className="text-sm text-brand hover:underline">← Marketplace</Link>
      <header className="mt-5">
        <p className="bvs-section-kicker">BVS sound shelf</p>
        <h1 className="mt-2 text-4xl font-semibold sm:text-5xl">Sounds and tools from BVS creators</h1>
        <p className="mt-4 max-w-2xl text-text-secondary">
          Drum kits, loops, MIDI and templates made by Zimbabwean and African producers. Every product is reviewed by BVS before it goes on sale, and your download unlocks as soon as payment is confirmed.
        </p>
        <div className="mt-6 flex flex-wrap gap-3 text-sm">
          <Link href="/catalogue?type=beat#beatstore" className="rounded-full border border-white/15 bg-white/[.03] px-5 py-2.5">BeatStore</Link>
          <Link href="/marketplace#services" className="rounded-full border border-white/15 bg-white/[.03] px-5 py-2.5">Mixing, mastering &amp; services</Link>
          <Link href="/creator/marketplace" className="rounded-full border border-brand/45 bg-brand/[.06] px-5 py-2.5 text-brand">Sell your own pack</Link>
        </div>
      </header>

      {state === "ready" && products.length ? (
        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter products by type">
            {[{ id: "all", label: "All" }, ...liveCategories].map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={category === item.id}
                onClick={() => setCategory(item.id)}
                className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${category === item.id ? "border-brand bg-brand text-black" : "border-white/15 bg-white/[.03]"}`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="sm:w-72">
            <label htmlFor="shelf-search" className="sr-only">Search products</label>
            <input
              id="shelf-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search kits, loops, producers…"
              className="min-h-12 w-full rounded-xl border border-white/15 bg-white/[.03] px-4 text-base"
            />
          </div>
        </div>
      ) : null}

      {state === "loading" ? <div className="bvs-surface mt-8 h-64 animate-pulse rounded-[1.35rem]" aria-hidden="true" /> : null}
      {state === "error" ? (
        <div className="bvs-surface mt-8 rounded-[1.35rem] p-8 text-center">
          <h2 className="text-xl font-semibold">The shelf could not be loaded</h2>
          <p className="mt-2 text-sm text-text-secondary">Check your connection and try again.</p>
          <button type="button" onClick={() => { setState("loading"); setRetry((value) => value + 1); }} className="mt-5 min-h-11 rounded-full bg-brand px-6 font-semibold text-black">Try again</button>
        </div>
      ) : null}

      <p role="status" className="sr-only">{added ? "Product added to your cart." : ""}</p>

      {state === "ready" && products.length ? (
        <section className="mt-8" aria-labelledby="shelf-products-title">
          <h2 id="shelf-products-title" className="sr-only">Products for sale</h2>
          {visible.length ? (
            <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
              {visible.map((product) => (
                <article key={product.id} className="bvs-surface bvs-surface-hover flex flex-col overflow-hidden rounded-[1.35rem]">
                  <Link href={`/marketplace/products/${product.slug}`} className="block">
                    {product.artworkUrl ? (
                      <img src={product.artworkUrl} alt="" loading="lazy" className="aspect-square w-full object-cover" />
                    ) : (
                      <div className="flex aspect-square w-full items-center justify-center bg-white/[.04] text-sm text-text-secondary">{product.categoryLabel}</div>
                    )}
                  </Link>
                  <div className="flex flex-1 flex-col p-4 sm:p-5">
                    <p className="bvs-chip bvs-chip-brand self-start">{product.categoryLabel}</p>
                    <h3 className="mt-3 text-xl font-semibold">
                      <Link href={`/marketplace/products/${product.slug}`} className="hover:underline">{product.title}</Link>
                    </h3>
                    <p className="mt-1 text-sm text-text-secondary">
                      by <Link href={`/marketplace/${product.storefrontSlug}`} className="text-brand hover:underline">{product.sellerName}</Link>
                    </p>
                    {product.previewUrl ? (
                      <ProductPreviewButton productId={product.id} category={product.category} src={product.previewUrl} title={product.title} source="shelf" className="mt-4 self-start" />
                    ) : null}
                    <div className="mt-auto flex items-center justify-between gap-3 pt-5">
                      <strong className="text-lg">{shelfPrice(product.priceUsd)}</strong>
                      {added === product.id ? (
                        <Link href="/checkout" className="inline-flex min-h-11 items-center rounded-full border border-brand px-4 text-sm font-semibold text-brand">Go to checkout →</Link>
                      ) : (
                        <button type="button" disabled={product.fixture} onClick={() => add(product)} className="min-h-11 rounded-full bg-brand px-4 text-sm font-semibold text-black disabled:opacity-50">
                          {product.fixture ? "Fixture only" : "Add to cart"}
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="bvs-surface rounded-[1.35rem] p-8 text-center text-text-secondary">No products match that search yet.</p>
          )}
        </section>
      ) : null}

      {planned.length ? (
        <section className="mt-12" aria-labelledby="shelf-planned-title">
          <p className="bvs-section-kicker">Coming to the shelf</p>
          <h2 id="shelf-planned-title" className="mt-2 text-3xl font-semibold">
            {products.length ? "Next on the shelf" : "The first BVS packs are being made"}
          </h2>
          <p className="mt-3 max-w-2xl text-sm text-text-secondary">
            These are not on sale yet. Each one is published only after BVS has checked the files and the rights behind them.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
            {planned.map((item) => (
              <article key={item.key} className="bvs-surface rounded-[1.35rem] p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="bvs-chip">{shelfCategoryLabel(item.category)}</p>
                  <p className="bvs-chip bvs-chip-brand">Coming soon</p>
                </div>
                <h3 className="mt-3 text-xl font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-text-secondary">{item.pitch}</p>
                <p className="mt-3 text-sm">{item.contents}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="bvs-surface mt-12 rounded-[1.35rem] p-6 sm:p-8" aria-labelledby="shelf-sell-title">
        <h2 id="shelf-sell-title" className="text-2xl font-semibold">Producers: put your sounds on the BVS shelf</h2>
        <p className="mt-2 max-w-2xl text-sm text-text-secondary">
          Upload a kit, loop pack, MIDI pack or template you made yourself. Set your price, add a preview, and BVS reviews it before it goes live. Buyers can pay by card or EcoCash.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/creator/marketplace" className="inline-flex min-h-11 items-center rounded-full bg-brand px-5 font-semibold text-black">Open my marketplace workspace</Link>
          <Link href="/catalogue?type=beat#beatstore" className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-5 font-semibold">Browse beats</Link>
        </div>
      </section>
    </main>
  );
}
