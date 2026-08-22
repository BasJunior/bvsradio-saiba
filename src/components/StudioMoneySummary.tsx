"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type SellerSettlement = {
  id?: string;
  order_reference?: string;
  seller_plan_id?: string;
  platform_fee_bps?: number | string;
  gross_product_revenue?: number | string;
  platform_fee_amount?: number | string;
  processor_fee_allocated?: number | string;
  seller_net?: number | string;
  payout_net?: number | string;
  settlement_status?: string;
  created_at?: string;
};

type WalletPayload = {
  balances?: {
    available?: number | string;
    pendingEarnings?: number | string;
  };
  earnings?: {
    lifetimeGrossSales?: number | string;
    bvsPlatformFees?: number | string;
    processorFees?: number | string;
    refundDebits?: number | string;
    netAfterRefunds?: number | string;
    pendingNetEarnings?: number | string;
    settlementCount?: number;
  };
  settings?: {
    payoutMinimumUsd?: number | string;
    currency?: string;
  };
  sellerSettlements?: SellerSettlement[];
};

function usd(value: number | string | undefined) {
  const amount = Number(value) || 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

function statusLabel(value?: string) {
  return String(value || "not settled").replaceAll("_", " ");
}

export default function StudioMoneySummary({ token }: { token: string }) {
  const [data, setData] = useState<WalletPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/artist/wallet", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Could not load seller wallet");
      setData(payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load seller wallet");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const latest = useMemo(() => data?.sellerSettlements?.[0] || null, [data]);

  if (loading) {
    return <p className="py-6 text-sm text-text-secondary">Loading wallet summary…</p>;
  }

  if (error) {
    return (
      <div className="space-y-3 py-2">
        <p className="rounded-xl border border-amber-300/25 bg-amber-300/10 p-4 text-sm text-amber-100">
          {error}
        </p>
        <Link href="/artists" className="inline-flex text-sm font-medium text-brand hover:underline">
          Open full wallet →
        </Link>
      </div>
    );
  }

  if (!data) return null;

  const cards = [
    ["Available", usd(data.balances?.available)],
    ["Pending earnings", usd(data.balances?.pendingEarnings ?? data.earnings?.pendingNetEarnings)],
    ["Lifetime gross sales", usd(data.earnings?.lifetimeGrossSales)],
    ["Net after refunds", usd(data.earnings?.netAfterRefunds)],
  ];
  const bps = latest?.platform_fee_bps == null ? null : Number(latest.platform_fee_bps) || 0;

  return (
    <div className="space-y-6 py-2">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-brand">Seller money</p>
          <h3 className="mt-1 text-xl font-semibold">Wallet & settlement summary</h3>
          <p className="mt-2 max-w-2xl text-sm text-text-secondary">
            Read-only Studio view of the existing seller ledger. Sale economics are frozen on each settlement,
            so a later plan change does not rewrite an older fee snapshot.
          </p>
        </div>
        <Link
          href="/artists"
          className="rounded-full border border-white/20 px-4 py-2 text-sm hover:border-brand"
        >
          Full wallet & payouts
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-white/10 bg-black/20 p-4">
            <p className="text-xs text-text-secondary">{label}</p>
            <p className="mt-1 text-xl font-semibold text-brand">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <div className="rounded-xl border border-white/10 p-4 text-sm">
          <p className="font-semibold">Lifetime deductions</p>
          <dl className="mt-3 space-y-2 text-text-secondary">
            <div className="flex justify-between gap-4"><dt>BVS platform fees</dt><dd>{usd(data.earnings?.bvsPlatformFees)}</dd></div>
            <div className="flex justify-between gap-4"><dt>Processing fees</dt><dd>{usd(data.earnings?.processorFees)}</dd></div>
            <div className="flex justify-between gap-4"><dt>Refund / reversal debits</dt><dd>{usd(data.earnings?.refundDebits)}</dd></div>
            <div className="flex justify-between gap-4 border-t border-white/10 pt-2"><dt>Payout minimum</dt><dd>{usd(data.settings?.payoutMinimumUsd)}</dd></div>
          </dl>
        </div>

        <div className="rounded-xl border border-white/10 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">Latest sale snapshot</p>
            <span className="text-xs capitalize text-brand">{statusLabel(latest?.settlement_status)}</span>
          </div>
          {latest ? (
            <div className="mt-3 space-y-2 text-sm text-text-secondary">
              <p>
                Plan at sale: <span className="text-text-primary">{latest.seller_plan_id || "free / default"}</span>
                {bps != null ? ` · BVS fee ${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 1)}%` : ""}
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-lg bg-white/[.03] p-3"><p className="text-xs">Gross</p><p className="mt-1 text-text-primary">{usd(latest.gross_product_revenue)}</p></div>
                <div className="rounded-lg bg-white/[.03] p-3"><p className="text-xs">BVS + processing</p><p className="mt-1 text-text-primary">{usd((Number(latest.platform_fee_amount) || 0) + (Number(latest.processor_fee_allocated) || 0))}</p></div>
                <div className="rounded-lg bg-white/[.03] p-3"><p className="text-xs">Seller payout net</p><p className="mt-1 text-text-primary">{usd(latest.payout_net ?? latest.seller_net)}</p></div>
              </div>
              {latest.created_at && <p className="text-xs">Snapshot {new Date(latest.created_at).toLocaleString()}</p>}
            </div>
          ) : (
            <p className="mt-3 text-sm text-text-secondary">
              No seller settlement yet. Your first completed marketplace sale will create the snapshot here.
            </p>
          )}
        </div>
      </div>

      <p className="text-xs text-text-secondary">
        Settlements recorded: {Number(data.earnings?.settlementCount || 0)}. Tax is not inferred here; use the full wallet for payout methods, requests, refunds and ledger detail.
      </p>
    </div>
  );
}
