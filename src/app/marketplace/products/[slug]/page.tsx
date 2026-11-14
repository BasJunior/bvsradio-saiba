"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ProductPreviewButton from "@/components/ProductPreviewButton";
import { trackEvent } from "@/lib/analytics";
import { addShelfProductToCart, shelfPrice, type ShelfProduct as ShelfProductData } from "@/lib/product-shelf";

export default function ShelfProductPage() {
  const params = useParams<{ slug: string }>();
  const slug = String(params.slug || "");
  // Remount per product so one product's state never shows on another.
  return <ShelfProduct key={slug} slug={slug} />;
}

function ShelfProduct({ slug }: { slug: string }) {
  const router = useRouter();
  const [product, setProduct] = useState<ShelfProductData | null>(null);
  const [others, setOthers] = useState<ShelfProductData[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [added, setAdded] = useState(false);
  const [retry, setRetry] = useState(0);
  const viewedSlug = useRef("");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/marketplace/products?slug=${encodeURIComponent(slug)}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (response.status === 404) {
          setState("missing");
          return;
        }
        if (!response.ok) throw new Error("Product unavailable");
        const payload = (await response.json()) as { product?: ShelfProductData };
        if (!payload.product) {
          setState("missing");
          return;
        }
        setProduct(payload.product);
        setState("ready");
        if (viewedSlug.current !== slug) {
          viewedSlug.current = slug;
          trackEvent("product_view", { product_id: payload.product.id, category: payload.product.category, price: payload.product.priceUsd });
        }
      })
      .catch((error) => {
        if ((error as Error).name !== "AbortError") setState("error");
      });
    // Related products are optional; the page works without them.
    fetch("/api/marketplace/products", { cache: "no-store", signal: controller.signal })
      .then((response) => (response.ok ? (response.json() as Promise<{ products?: ShelfProductData[] }>) : { products: [] }))
      .then((payload) => setOthers((payload.products || []).filter((item) => item.slug !== slug).slice(0, 3)))
      .catch(() => undefined);
    return () => controller.abort();
  }, [slug, retry]);

  function add(goToCheckout: boolean) {
    if (!product || product.fixture) return;
    addShelfProductToCart(product);
    setAdded(true);
    trackEvent("product_add_to_cart", { product_id: product.id, category: product.category, price: product.priceUsd, source: goToCheckout ? "detail_buy_now" : "detail" });
    if (goToCheckout) router.push("/checkout");
  }

  if (state === "loading") {
    return <main className="mx-auto max-w-5xl px-4 py-14 sm:px-6"><div className="h-96 animate-pulse rounded-3xl bg-white/[.04]" aria-hidden="true" /></main>;
  }
  if (state === "error") {
    return (
      <main className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h1 className="text-3xl font-semibold">This product could not be loaded</h1>
        <p className="mt-3 text-text-secondary">Check your connection and try again.</p>
        <button type="button" onClick={() => { setState("loading"); setRetry((value) => value + 1); }} className="mt-6 min-h-11 rounded-full bg-brand px-6 font-semibold text-black">Try again</button>
      </main>
    );
  }
  if (state === "missing" || !product) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h1 className="text-3xl font-semibold">Product not found</h1>
        <p className="mt-3 text-text-secondary">It may have been removed from sale.</p>
        <Link href="/marketplace/products" className="mt-6 inline-flex min-h-11 items-center rounded-full bg-brand px-6 font-semibold text-black">Back to the shelf</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <Link href="/marketplace/products" className="text-sm text-brand hover:underline">← Sound shelf</Link>
      <div className="mt-6 grid gap-8 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div>
          {product.artworkUrl ? (
            <img src={product.artworkUrl} alt={`${product.title} cover`} className="aspect-square w-full rounded-[1.35rem] object-cover" />
          ) : (
            <div className="flex aspect-square w-full items-center justify-center rounded-[1.35rem] bg-white/[.04] text-text-secondary">{product.categoryLabel}</div>
          )}
        </div>
        <div>
          <p className="bvs-chip bvs-chip-brand inline-block">{product.categoryLabel}</p>
          <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">{product.title}</h1>
          <p className="mt-2 text-text-secondary">
            by <Link href={`/marketplace/${product.storefrontSlug}`} className="text-brand hover:underline">{product.sellerName}</Link>
          </p>
          <p className="mt-5 text-3xl font-semibold">{shelfPrice(product.priceUsd)}</p>
          {product.previewUrl ? (
            <ProductPreviewButton productId={product.id} category={product.category} src={product.previewUrl} title={product.title} source="detail" className="mt-5" />
          ) : null}
          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" disabled={product.fixture} onClick={() => add(true)} className="min-h-12 rounded-full bg-brand px-6 font-semibold text-black disabled:opacity-50">
              {product.fixture ? "Fixture only" : "Buy now"}
            </button>
            {added ? (
              <Link href="/checkout" className="inline-flex min-h-12 items-center rounded-full border border-brand px-6 font-semibold text-brand">In your cart · Checkout →</Link>
            ) : (
              <button type="button" disabled={product.fixture} onClick={() => add(false)} className="min-h-12 rounded-full border border-white/15 px-6 font-semibold disabled:opacity-50">Add to cart</button>
            )}
          </div>
          <p role="status" className="sr-only">{added ? "Product added to your cart." : ""}</p>
          <ul className="mt-6 space-y-2 text-sm text-text-secondary">
            <li>Pay by card or EcoCash. Your private download unlocks on your order page once payment is confirmed.</li>
            <li>Reviewed by BVS before going on sale. The seller has confirmed they control the rights to everything in this product.</li>
          </ul>
        </div>
      </div>

      <div className="mt-10 grid gap-5 md:grid-cols-2">
        <section className="bvs-surface rounded-[1.35rem] p-5 sm:p-6" aria-labelledby="product-about-title">
          <h2 id="product-about-title" className="text-xl font-semibold">What you get</h2>
          <p className="mt-3 whitespace-pre-line text-sm text-text-secondary">{product.description || "The seller has not added a description yet."}</p>
          {product.compatibility ? (
            <p className="mt-4 text-sm"><span className="font-semibold">Works with:</span> {product.compatibility}</p>
          ) : null}
        </section>
        <section className="bvs-surface rounded-[1.35rem] p-5 sm:p-6" aria-labelledby="product-licence-title">
          <h2 id="product-licence-title" className="text-xl font-semibold">Licence and usage</h2>
          <p className="mt-3 whitespace-pre-line text-sm text-text-secondary">{product.licenceSummary || "Licence terms are recorded on your order at purchase."}</p>
          {product.licenceTerms && product.licenceTerms !== product.licenceSummary ? (
            <details className="mt-4 text-sm">
              <summary className="cursor-pointer font-semibold text-brand">Read the full terms</summary>
              <p className="mt-3 whitespace-pre-line text-text-secondary">{product.licenceTerms}</p>
            </details>
          ) : null}
          <p className="mt-4 text-xs text-text-secondary">The terms shown here are saved with your order, so you keep a record of what you bought.</p>
        </section>
      </div>

      <section className="mt-10" aria-labelledby="product-more-title">
        <h2 id="product-more-title" className="text-2xl font-semibold">Keep building</h2>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link href={`/marketplace/${product.storefrontSlug}`} className="rounded-full border border-white/15 bg-white/[.03] px-5 py-2.5">More from {product.sellerName}</Link>
          <Link href="/catalogue?type=beat#beatstore" className="rounded-full border border-white/15 bg-white/[.03] px-5 py-2.5">Find a beat</Link>
          <Link href="/marketplace#services" className="rounded-full border border-white/15 bg-white/[.03] px-5 py-2.5">Book mixing or mastering</Link>
        </div>
        {others.length ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {others.map((item) => (
              <Link key={item.id} href={`/marketplace/products/${item.slug}`} className="bvs-surface bvs-surface-hover block overflow-hidden rounded-[1.35rem]">
                {item.artworkUrl ? <img src={item.artworkUrl} alt="" loading="lazy" className="aspect-square w-full object-cover" /> : null}
                <div className="p-4">
                  <p className="text-xs uppercase tracking-[.14em] text-brand">{item.categoryLabel}</p>
                  <p className="mt-1 font-semibold">{item.title}</p>
                  <p className="mt-1 text-sm text-text-secondary">{shelfPrice(item.priceUsd)}</p>
                </div>
              </Link>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}
