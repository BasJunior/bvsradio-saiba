"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase";

type Order = {
  reference: string;
  status: string;
  delivery_status?: string;
  total: number | string;
  payment_method?: string;
  items?: Array<{ title?: string; quantity?: number }>;
  created_at: string;
};

export default function AccountOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      setError("Account service is unavailable.");
      return;
    }
    let active = true;
    createClient().auth.getSession().then(async ({ data }) => {
      const token = data.session?.access_token;
      if (!token) {
        if (active) {
          setLoading(false);
          setError("Sign in to see your orders.");
        }
        return;
      }
      const response = await fetch("/api/account", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }).catch(() => null);
      if (!active) return;
      if (!response?.ok) {
        const payload = await response?.json().catch(() => ({}));
        setError(payload?.error || "Could not load orders.");
        setLoading(false);
        return;
      }
      const payload = await response.json();
      setOrders(Array.isArray(payload.orders) ? payload.orders : []);
      setLoading(false);
    }).catch(() => {
      if (active) {
        setError("Could not load orders.");
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, []);

  const summary = useMemo(() => {
    const paid = orders.filter((order) => ["paid", "fulfilled"].includes(order.status)).length;
    const pending = orders.filter((order) => !["paid", "fulfilled", "cancelled", "refunded"].includes(order.status)).length;
    const total = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    return { paid, pending, total };
  }, [orders]);

  if (loading) return <main className="min-h-[60vh] p-20 text-center text-text-secondary">Loading orders…</main>;

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 sm:px-6 sm:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.22em] text-brand">Account</p>
          <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Orders & purchases</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary">Receipts, delivery status and downloadable purchases without scrolling through profile settings first.</p>
        </div>
        <Link href="/library?section=downloads" className="rounded-full border border-brand/30 px-4 py-2.5 text-sm font-semibold text-brand">Open Downloads →</Link>
      </div>

      {error ? <div className="mt-6 rounded-2xl border border-red-400/25 bg-red-500/10 p-5 text-sm text-red-100">{error}{error.startsWith("Sign in") ? <Link href="/auth/login?next=%2Faccount%2Forders" className="ml-2 font-semibold text-brand">Sign in</Link> : null}</div> : null}

      {!error ? <>
        <section className="mt-7 grid grid-cols-3 gap-3">
          <Metric label="Orders" value={orders.length.toString()} />
          <Metric label="Paid" value={summary.paid.toString()} />
          <Metric label="Pending" value={summary.pending.toString()} />
        </section>

        {orders.length ? <section className="mt-7 space-y-3">
          {orders.map((order) => (
            <Link key={order.reference} href={`/account/orders/${encodeURIComponent(order.reference)}`} className="group flex flex-wrap items-center gap-4 rounded-2xl border border-white/10 bg-white/[.02] p-4 transition hover:border-brand/35 hover:bg-brand/[.025]">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-brand">{order.reference}</p>
                  <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] capitalize text-text-secondary">{order.status.replaceAll("_", " ")}</span>
                </div>
                <p className="mt-2 truncate text-sm text-text-primary">{order.items?.map((item) => item.title).filter(Boolean).join(", ") || "BVS order"}</p>
                <p className="mt-1 text-xs text-text-secondary">{new Date(order.created_at).toLocaleDateString()} · Delivery {String(order.delivery_status || "pending").replaceAll("_", " ")}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold">${Number(order.total || 0).toFixed(2)}</p>
                <p className="mt-2 text-xs font-semibold text-brand">Receipt & files →</p>
              </div>
            </Link>
          ))}
        </section> : <div className="mt-7 rounded-2xl border border-dashed border-white/15 p-9 text-center"><h2 className="text-lg font-semibold">No orders yet</h2><p className="mt-2 text-sm text-text-secondary">Purchases made while signed in will appear here.</p><Link href="/catalogue" className="mt-5 inline-flex rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-black">Browse BVS</Link></div>}
      </> : null}
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[.02] p-4 text-center"><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-text-secondary">{label}</p><p className="mt-2 text-2xl font-semibold text-brand">{value}</p></div>;
}
