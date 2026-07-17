"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { trackEvent } from "@/lib/analytics";

interface CartItem {
  id: string | number;
  title: string;
  artist?: string;
  type?: string;
  price?: number;
  quantity?: number;
  src?: string;
  delivery?: string;
  artwork?: string;
}

interface Customer {
  name: string;
  email: string;
  whatsapp: string;
}

interface OrderResult {
  reference: string;
  status: string;
  persistenceMessage: string;
  nextSteps: string[];
  checkoutUrl?: string;
  paymentMode?: string;
  whatsappLink?: string | null;
  stripeReady?: boolean;
}

const paymentMethodsBase = [
  {
    id: "paynow",
    label: "Paynow (EcoCash, cards, OneMoney)",
    detail: "Zimbabwe Paynow checkout — EcoCash and more on their secure page.",
    needsPaynow: true,
  },
  {
    id: "ecocash",
    label: "EcoCash push (ZW number)",
    detail: "Enter a Zimbabwe EcoCash number in WhatsApp field — Paynow sends a phone prompt.",
    needsPaynow: true,
  },
  {
    id: "card",
    label: "International card (Stripe)",
    detail: "Visa / Mastercard when Stripe is connected.",
    needsStripe: true,
  },
  {
    id: "mobile_money",
    label: "EcoCash / mobile money (manual)",
    detail: "Place order, pay, WhatsApp proof with your reference to BVS.",
    needsStripe: false,
  },
  {
    id: "manual_bank",
    label: "Bank transfer",
    detail: "Larger service orders. BVS confirms details on WhatsApp.",
    needsStripe: false,
  },
  {
    id: "paypal",
    label: "PayPal",
    detail: "International. Confirm address with BVS on WhatsApp.",
    needsStripe: false,
  },
];

function priceFor(item: CartItem) {
  if (typeof item.price === "number" && Number.isFinite(item.price)) return item.price;
  if (item.price !== undefined && Number.isFinite(Number(item.price))) return Number(item.price);
  if (item.type === "beat") return 29;
  if (item.type === "mix") return 4;
  if (item.type === "service") return 69;
  return 2;
}

function normalizeItem(item: CartItem): CartItem {
  return {
    ...item,
    type: item.type || "single",
    price: priceFor(item),
    quantity: item.quantity || 1,
    delivery:
      item.delivery ||
      (item.type === "service"
        ? "BVS contacts you for stems/brief, then delivers masters."
        : "Download / license released after payment is confirmed."),
  };
}

function serviceFromQuery() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const item = params.get("item");
  if (!item) return null;
  const price = Number(params.get("price") || 69);
  return normalizeItem({
    id: `service-${item.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    title: item,
    artist: "BVS Engineering",
    type: "service",
    price: Number.isFinite(price) ? price : 69,
    quantity: 1,
    delivery: "Service order — upload stems after payment confirm.",
  });
}

export default function CheckoutPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [customer, setCustomer] = useState<Customer>({ name: "", email: "", whatsapp: "" });
  const [projectNotes, setProjectNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("mobile_money");
  const [stripeReady, setStripeReady] = useState(false);
  const [paynowReady, setPaynowReady] = useState(false);
  const [whatsapp, setWhatsapp] = useState<string | null>("+4917664006205");
  const [orderEmail, setOrderEmail] = useState("abiaschivayo3@gmail.com");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<OrderResult | null>(null);
  const [error, setError] = useState("");
  const [cancelled, setCancelled] = useState(false);

  useEffect(() => {
    const queryItem = serviceFromQuery();
    const savedCart = window.localStorage.getItem("bvs_cart");
    let initial: CartItem[] = [];
    if (savedCart) {
      try {
        initial = JSON.parse(savedCart).map(normalizeItem);
      } catch {
        initial = [];
      }
    }
    if (queryItem && !initial.some((i) => i.id === queryItem.id)) {
      initial = [...initial, queryItem];
    } else if (!savedCart && queryItem) {
      initial = [queryItem];
    }
    // Hydrate browser-owned cart state after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(initial);
    setCancelled(new URLSearchParams(window.location.search).has("cancelled"));
    setHydrated(true);

    fetch("/api/checkout/config")
      .then((r) => r.json())
      .then((cfg) => {
        setStripeReady(Boolean(cfg.stripeEnabled));
        setPaynowReady(Boolean(cfg.paynowEnabled));
        if (cfg.whatsapp) setWhatsapp(cfg.whatsapp);
        if (cfg.orderEmail) setOrderEmail(cfg.orderEmail);
        if (cfg.paynowEnabled) setPaymentMethod("paynow");
        else if (cfg.stripeEnabled) setPaymentMethod("card");
      })
      .catch(() => null);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem("bvs_cart", JSON.stringify(items));
  }, [items, hydrated]);

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + priceFor(item) * (item.quantity || 1), 0),
    [items],
  );
  const total = subtotal;

  const methods = paymentMethodsBase.filter((m) => {
    if ("needsPaynow" in m && m.needsPaynow) return paynowReady;
    if ("needsStripe" in m && m.needsStripe) return stripeReady;
    return true;
  });

  const removeItem = (id: string | number) => setItems(items.filter((i) => i.id !== id));

  const submitOrder = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setResult(null);
    if (items.length === 0) {
      setError("Add at least one item — music from Catalogue or a service from Shop.");
      return;
    }
    setIsSubmitting(true);
    trackEvent("checkout_started", { payment_method: paymentMethod, item_count: items.length, total });
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer,
          items: items.map((item) => ({
            id: item.id,
            title: item.title,
            artist: item.artist,
            type: item.type || "single",
            price: priceFor(item),
            quantity: item.quantity || 1,
            delivery: item.delivery,
            sourceUrl: item.src,
          })),
          paymentMethod,
          projectNotes,
          subtotal,
          total,
          createStripeSession: paymentMethod === "card",
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Checkout failed.");

      if (data.checkoutUrl) {
        trackEvent("checkout_redirect", { payment_method: data.paymentMode || paymentMethod, item_count: items.length, total });
        window.localStorage.setItem("bvs_last_order", JSON.stringify(data));
        window.location.href = data.checkoutUrl as string;
        return;
      }

      setResult(data);
      trackEvent("checkout_complete", { payment_method: data.paymentMode || paymentMethod, item_count: items.length, total, status: data.status || "pending_payment" });
      window.localStorage.setItem("bvs_last_order", JSON.stringify(data));
      window.localStorage.removeItem("bvs_cart");
      setItems([]);
    } catch (caught) {
      trackEvent("payment_error", { payment_method: paymentMethod, stage: "order_creation" });
      setError(caught instanceof Error ? caught.message : "Checkout failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!hydrated) {
    return <div className="p-16 text-center text-text-secondary">Loading checkout…</div>;
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <section className="mb-10">
        <p className="mb-3 text-xs uppercase tracking-[3px] text-brand">Buy from BVS</p>
        <h1 className="mb-3 text-4xl font-semibold sm:text-5xl">Checkout</h1>
        <p className="max-w-2xl text-lg text-text-secondary">
          Beats, tracks, and pro services (mix / master). No ads during playback — you pay for what you buy.
        </p>
        {cancelled && (
          <p className="mt-4 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            Card payment was cancelled. Your cart is still here — try again or choose EcoCash / bank.
          </p>
        )}
        <ol className="mt-8 grid grid-cols-3 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]" aria-label="Checkout progress">
          {["Review cart", "Your details", "Payment"].map((step, index) => (
            <li key={step} className={`flex items-center gap-3 px-3 py-4 sm:px-5 ${index === 0 ? "bg-brand/10" : "border-l border-white/10"}`}>
              <span className={`grid h-7 w-7 flex-shrink-0 place-items-center rounded-full text-xs font-bold ${index === 0 ? "bg-brand text-black" : "bg-white/10 text-text-secondary"}`}>{index + 1}</span>
              <span className={`hidden text-sm font-medium sm:block ${index === 0 ? "text-white" : "text-text-secondary"}`}>{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <div className="grid gap-8 lg:grid-cols-[1fr_0.85fr]">
        <form onSubmit={submitOrder} className="space-y-6">
          <section className="rounded-2xl border border-white/10 bg-bg-card/35 p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">Your cart</h2>
              <div className="flex gap-2 text-sm">
                <Link href="/catalogue" className="rounded-full border border-white/15 px-4 py-2 hover:bg-white/5">
                  + Music
                </Link>
                <Link href="/shop" className="rounded-full border border-white/15 px-4 py-2 hover:bg-white/5">
                  + Services
                </Link>
              </div>
            </div>

            {items.length > 0 ? (
              <div className="space-y-3">
                {items.map((item) => (
                  <div
                    key={String(item.id)}
                    className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-white/10 bg-black/20 p-4"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg border border-white/10 bg-white/5">
                        {item.artwork ? (
                          <Image src={item.artwork} alt="" fill className="object-cover" />
                        ) : (
                          <span className="grid h-full place-items-center text-lg text-brand">♪</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{item.title}</div>
                        <div className="text-sm capitalize text-text-secondary">
                          {item.artist || "BVS"} · {item.type === "beat" ? "Beat licence" : item.type === "service" ? "Studio service" : "Digital download"}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-brand">${priceFor(item).toFixed(2)}</div>
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="text-xs text-red-300 hover:text-red-200"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-white/15 px-5 py-10 text-center text-text-secondary">
                Cart is empty.{" "}
                <Link href="/catalogue" className="text-brand underline">
                  Browse catalogue
                </Link>{" "}
                or{" "}
                <Link href="/shop" className="text-brand underline">
                  order a mix/master
                </Link>
                .
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-white/10 bg-bg-card/35 p-6">
            <h2 className="mb-4 text-xl font-semibold">Your details</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm sm:col-span-1">
                <span className="mb-1.5 block text-text-secondary">Name</span>
                <input
                  required
                  value={customer.name}
                  onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-bg-primary px-4 py-3 outline-none focus:border-brand"
                  placeholder="Your name"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block text-text-secondary">Email</span>
                <input
                  required
                  type="email"
                  value={customer.email}
                  onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-bg-primary px-4 py-3 outline-none focus:border-brand"
                  placeholder="you@email.com"
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1.5 block text-text-secondary">WhatsApp (recommended)</span>
                <input
                  value={customer.whatsapp}
                  onChange={(e) => setCustomer({ ...customer, whatsapp: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-bg-primary px-4 py-3 outline-none focus:border-brand"
                  placeholder="+263…"
                />
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-bg-card/35 p-6">
            <h2 className="mb-2 text-xl font-semibold">Pay how you want</h2>
            <p className="mb-4 text-sm text-text-secondary">
              {paynowReady
                ? "Paynow is live for EcoCash and local methods. International card optional via Stripe."
                : stripeReady
                  ? "Card is live. EcoCash manual still available until Paynow API keys are set."
                  : "Order now — EcoCash/bank/PayPal manual. Add Paynow Integration ID+Key for automatic EcoCash."}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {methods.map((method) => (
                <label
                  key={method.id}
                  className={`cursor-pointer rounded-xl border p-4 ${
                    paymentMethod === method.id ? "border-brand bg-brand/10" : "border-white/10 bg-black/20"
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    className="sr-only"
                    checked={paymentMethod === method.id}
                    onChange={() => setPaymentMethod(method.id)}
                  />
                  <span className="block font-semibold">{method.label}</span>
                  <span className="mt-1 block text-xs text-text-secondary">{method.detail}</span>
                </label>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-bg-card/35 p-6">
            <h2 className="mb-2 text-xl font-semibold">Project notes</h2>
            <textarea
              value={projectNotes}
              onChange={(e) => setProjectNotes(e.target.value)}
              rows={4}
              className="w-full resize-y rounded-xl border border-white/10 bg-bg-primary px-4 py-3 outline-none focus:border-brand"
              placeholder="References, deadlines, license type, Dropbox/Drive link to stems…"
            />
          </section>

          {error && (
            <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || items.length === 0}
            className="w-full rounded-full bg-brand px-8 py-4 text-lg font-semibold text-black hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting
              ? "Working…"
              : (paymentMethod === "card" && stripeReady) ||
                  (paymentMethod === "paynow" && paynowReady)
                ? `Pay $${total.toFixed(2)} securely`
                : paymentMethod === "ecocash" && paynowReady
                  ? `Send EcoCash prompt · $${total.toFixed(2)}`
                  : `Place order · $${total.toFixed(2)}`}
          </button>
        </form>

        <aside className="space-y-6">
          <section className="sticky top-24 rounded-2xl border border-white/10 bg-bg-card/45 p-6">
            <h2 className="mb-4 text-xl font-semibold">Summary</h2>
            {items.length > 0 && (
              <div className="mb-4 space-y-2 border-b border-white/10 pb-4">
                {items.map((item) => (
                  <div key={`summary-${item.id}`} className="flex justify-between gap-4 text-sm">
                    <span className="min-w-0 truncate text-text-secondary">{item.title}</span>
                    <span className="flex-shrink-0">${(priceFor(item) * (item.quantity || 1)).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-text-secondary">
                <span>Items</span>
                <span>{items.length}</span>
              </div>
              <div className="flex justify-between border-t border-white/10 pt-3 text-xl font-semibold">
                <span>Total</span>
                <span className="text-brand">${total.toFixed(2)} USD</span>
              </div>
            </div>
            <ul className="mt-6 space-y-2 text-xs text-text-secondary">
              <li>✓ Beats & tracks from catalogue</li>
              <li>✓ Mix / master services from shop</li>
              <li>✓ No in-stream ads for buyers</li>
              <li>✓ Digital delivery after payment confirmed</li>
            </ul>
          </section>

          {result && (
            <section className="rounded-2xl border border-brand/30 bg-brand/10 p-6">
              <p className="text-xs uppercase tracking-[3px] text-brand">Order created</p>
              <h2 className="mt-2 font-mono text-2xl font-semibold">{result.reference}</h2>
              <p className="mt-3 text-sm text-text-secondary">{result.persistenceMessage}</p>
              <div className="mt-4 space-y-2 text-sm">
                {result.nextSteps?.map((step) => (
                  <div key={step} className="rounded-lg bg-black/20 px-3 py-2">
                    {step}
                  </div>
                ))}
              </div>
              {result.whatsappLink && (
                <a
                  href={result.whatsappLink}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-brand px-5 py-3 text-sm font-semibold text-black"
                >
                  WhatsApp BVS with this order
                </a>
              )}
              <Link
                href={`/checkout/success?ref=${encodeURIComponent(result.reference)}`}
                className="mt-3 inline-flex w-full items-center justify-center rounded-full border border-white/20 px-5 py-3 text-sm"
              >
                View confirmation
              </Link>
            </section>
          )}

          {!result && (
            <p className="text-center text-xs text-text-secondary">
              Questions? WhatsApp{" "}
              <a className="text-brand" href={`https://wa.me/${(whatsapp || "").replace(/\D/g, "")}`}>
                {whatsapp}
              </a>
              {" · "}
              <a className="text-brand" href={`mailto:${orderEmail}`}>
                {orderEmail}
              </a>
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
