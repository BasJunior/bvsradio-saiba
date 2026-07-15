"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

type OrderInfo = {
  reference: string;
  status: string;
  total: number;
  paymentMethod: string;
  items: Array<{ title: string; price: number; quantity: number }>;
};

function SuccessBody() {
  const params = useSearchParams();
  const ref = params.get("ref") || "";
  const [order, setOrder] = useState<OrderInfo | null>(null);

  useEffect(() => {
    if (!ref) return;
    fetch(`/api/orders?ref=${encodeURIComponent(ref)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setOrder(data))
      .catch(() => null);
  }, [ref]);

  return (
    <div className="mx-auto max-w-2xl px-6 py-16 text-center">
      <p className="mb-3 text-xs uppercase tracking-[3px] text-brand">Payment / order</p>
      <h1 className="mb-4 text-4xl font-semibold">Thank you — BVS has your order</h1>
      <p className="mb-8 text-text-secondary">
        {ref ? (
          <>
            Reference <span className="font-mono text-brand">{ref}</span>
          </>
        ) : (
          "Save any confirmation email or screenshot for your records."
        )}
      </p>

      {order && (
        <div className="mb-8 rounded-2xl border border-white/10 bg-bg-card/40 p-6 text-left text-sm">
          <div className="mb-3 flex justify-between">
            <span className="text-text-secondary">Status</span>
            <span className="font-semibold capitalize text-brand">{order.status.replace(/_/g, " ")}</span>
          </div>
          <div className="mb-3 flex justify-between">
            <span className="text-text-secondary">Total</span>
            <span>${Number(order.total).toFixed(2)}</span>
          </div>
          <ul className="space-y-2 border-t border-white/10 pt-3">
            {order.items?.map((item) => (
              <li key={item.title} className="flex justify-between gap-4">
                <span>
                  {item.title} × {item.quantity}
                </span>
                <span>${item.price.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-3 text-sm text-text-secondary">
        <p>Card payments: confirmed automatically when Stripe is active.</p>
        <p>EcoCash / bank: send payment proof with your reference — delivery starts after BVS confirms.</p>
      </div>

      <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
        <Link href="/catalogue" className="rounded-full bg-brand px-6 py-3 font-semibold text-black">
          Back to catalogue
        </Link>
        <Link href="/shop" className="rounded-full border border-white/20 px-6 py-3">
          Services
        </Link>
        <Link href="/contact" className="rounded-full border border-white/20 px-6 py-3">
          Contact BVS
        </Link>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<div className="p-16 text-center text-text-secondary">Loading…</div>}>
      <SuccessBody />
    </Suspense>
  );
}
