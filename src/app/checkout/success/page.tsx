"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { clearCartLines } from "@/lib/cart-client";
import { trackEventOnce } from "@/lib/analytics";

type OrderItem = {
  title: string;
  price: number;
  quantity: number;
  type?: string;
  artist?: string;
};

type OrderInfo = {
  reference: string;
  status: string;
  deliveryStatus?: string;
  delivery_status?: string;
  subtotal?: number;
  taxAmount?: number;
  tax_amount?: number;
  taxLabel?: string;
  tax_label?: string;
  taxCountry?: string;
  tax_country?: string;
  taxNote?: string;
  tax_note?: string;
  total: number;
  currency?: string;
  paymentMethod?: string;
  payment_method?: string;
  items?: OrderItem[];
  customer?: { name?: string; email?: string };
};

function money(n: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
  }).format(Number(n || 0));
}

function statusTone(status: string) {
  const s = status.toLowerCase();
  if (s === "paid" || s === "fulfilled") return "text-emerald-300 bg-emerald-500/15 border-emerald-400/30";
  if (s.includes("pending")) return "text-amber-100 bg-amber-500/15 border-amber-400/30";
  if (s.includes("cancel")) return "text-red-200 bg-red-500/15 border-red-400/30";
  return "text-brand bg-brand/10 border-brand/30";
}

function labelStatus(status: string) {
  return status.replace(/_/g, " ");
}

function SuccessBody() {
  const params = useSearchParams();
  const ref = params.get("ref") || "";
  const [order, setOrder] = useState<OrderInfo | null>(null);
  const [polls, setPolls] = useState(0);
  const [error, setError] = useState("");

  // Clear cart on landing (Paynow/Stripe return path)
  useEffect(() => {
    clearCartLines();
  }, []);

  useEffect(() => {
    if (!ref) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const load = async () => {
      try {
        const r = await fetch(`/api/orders?ref=${encodeURIComponent(ref)}`, { cache: "no-store" });
        if (!r.ok) {
          if (!cancelled) setError("Could not load this order yet.");
          return;
        }
        const data = (await r.json()) as OrderInfo;
        if (cancelled) return;
        setOrder(data);
        setError("");
        const st = String(data.status || "").toLowerCase();
        const paid = st === "paid" || st === "fulfilled";
        // Poll a few times while Paynow webhook catches up
        if (!paid && polls < 12) {
          timer = setTimeout(() => setPolls((p) => p + 1), 2500);
        }
      } catch {
        if (!cancelled) setError("Could not load this order yet.");
      }
    };

    void load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [ref, polls]);

  const paid = useMemo(() => {
    const st = String(order?.status || "").toLowerCase();
    return st === "paid" || st === "fulfilled";
  }, [order?.status]);

  useEffect(() => {
    if (!paid || !order || !ref) return;
    const items = order.items || [];
    trackEventOnce("payment_confirmed", {
      payment_method: String(order.paymentMethod || order.payment_method || "unknown").slice(0, 40),
      item_count: items.length,
      has_beat: items.some((item) => item.type === "beat"),
      total: Number(order.total || 0),
      currency: String(order.currency || "USD").slice(0, 8),
    }, `order:${ref}`, "local");
  }, [order, paid, ref]);

  const currency = order?.currency || "USD";
  const paymentMethod = order?.paymentMethod || order?.payment_method || "—";
  const delivery = order?.deliveryStatus || order?.delivery_status || (paid ? "paid processing" : "awaiting payment");
  const taxAmount = order?.taxAmount ?? order?.tax_amount;
  const taxLabel = order?.taxLabel || order?.tax_label || "Tax";
  const taxCountry = order?.taxCountry || order?.tax_country;
  const taxNote = order?.taxNote || order?.tax_note;

  return (
    <div className="mx-auto max-w-2xl px-6 py-14">
      <div className="text-center">
        <p className="mb-3 text-xs uppercase tracking-[3px] text-brand">BVS checkout</p>
        <h1 className="mb-3 text-4xl font-semibold tracking-tight">
          {paid ? "Payment confirmed" : "Order received"}
        </h1>
        <p className="mx-auto mb-8 max-w-lg text-text-secondary">
          {paid
            ? "Thanks — BVS has marked this order paid. Your cart is cleared."
            : ref
              ? "If you just paid on Paynow, status updates automatically in a few seconds."
              : "Save your confirmation for your records."}
        </p>
      </div>

      {ref && (
        <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-text-secondary">Reference</p>
              <p className="mt-1 font-mono text-lg text-brand">{ref}</p>
            </div>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${statusTone(
                order?.status || "pending_payment",
              )}`}
            >
              {labelStatus(order?.status || "pending payment")}
              {!paid && polls > 0 && polls < 12 ? " · checking…" : ""}
            </span>
          </div>
        </div>
      )}

      {error && !order && (
        <p className="mb-6 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {error}
        </p>
      )}

      {order && (
        <div className="mb-8 overflow-hidden rounded-2xl border border-white/10 bg-bg-card/40 text-left shadow-xl shadow-black/20">
          <div className="border-b border-white/10 px-6 py-5">
            <h2 className="text-lg font-semibold">Receipt</h2>
            <p className="mt-1 text-sm text-text-secondary">
              {order.customer?.name ? `${order.customer.name} · ` : ""}
              {order.customer?.email || "Guest checkout"}
            </p>
          </div>

          <div className="px-6 py-5">
            <ul className="space-y-3">
              {(order.items || []).map((item, idx) => (
                <li
                  key={`${item.title}-${idx}`}
                  className="flex items-start justify-between gap-4 border-b border-white/5 pb-3 last:border-0 last:pb-0"
                >
                  <div>
                    <p className="font-medium text-white">{item.title}</p>
                    <p className="mt-0.5 text-xs text-text-secondary">
                      {[item.artist, item.type, `Qty ${item.quantity || 1}`]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <p className="shrink-0 tabular-nums text-sm">
                    {money(Number(item.price || 0) * Number(item.quantity || 1), currency)}
                  </p>
                </li>
              ))}
            </ul>

            <dl className="mt-6 space-y-2 border-t border-white/10 pt-5 text-sm">
              {typeof order.subtotal === "number" && (
                <div className="flex justify-between gap-4">
                  <dt className="text-text-secondary">Subtotal</dt>
                  <dd className="tabular-nums">{money(order.subtotal, currency)}</dd>
                </div>
              )}
              {typeof taxAmount === "number" && (
                <div className="flex justify-between gap-4">
                  <dt className="text-text-secondary">
                    {taxLabel}
                    {taxCountry ? ` (${taxCountry})` : ""}
                  </dt>
                  <dd className="tabular-nums">{money(Number(taxAmount), currency)}</dd>
                </div>
              )}
              <div className="flex justify-between gap-4 text-base font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums text-brand">{money(Number(order.total), currency)}</dd>
              </div>
              <div className="flex justify-between gap-4 pt-1">
                <dt className="text-text-secondary">Payment</dt>
                <dd className="capitalize">{String(paymentMethod).replace(/_/g, " ")}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-text-secondary">Delivery</dt>
                <dd className="capitalize">{String(delivery).replace(/_/g, " ")}</dd>
              </div>
            </dl>

            {taxNote && <p className="mt-4 text-xs leading-relaxed text-text-secondary">{taxNote}</p>}

            <p className="mt-5 text-sm leading-relaxed text-text-secondary">
              {paid
                ? "Digital downloads unlock on your order page when files are staged. Studio services are confirmed by BVS on WhatsApp or email."
                : "Complete Paynow if the window is still open. This page refreshes status automatically."}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col justify-center gap-3 sm:flex-row">
        {ref && (
          <Link
            href={`/account/orders/${encodeURIComponent(ref)}`}
            className="rounded-full bg-brand px-6 py-3 text-center font-semibold text-black"
          >
            Full receipt
          </Link>
        )}
        <Link
          href="/catalogue"
          className="rounded-full border border-white/20 px-6 py-3 text-center hover:bg-white/5"
        >
          Catalogue
        </Link>
        <Link
          href="/contact"
          className="rounded-full border border-white/20 px-6 py-3 text-center hover:bg-white/5"
        >
          Contact BVS
        </Link>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<div className="p-16 text-center text-text-secondary">Loading receipt…</div>}>
      <SuccessBody />
    </Suspense>
  );
}
