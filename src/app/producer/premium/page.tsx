"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase";

type Interval = "month" | "year";
type Entitlements = {
  planId?: string;
  tier?: string;
  beatLiveLimit?: number | null;
  liveCount?: number;
  marketplaceCommissionBps?: number;
};

const plans = [
  { id: "producer_free", name: "Free", month: 0, year: 0, limit: "25 live beats", fee: "15%" },
  { id: "producer_plus", name: "Plus", month: 5, year: 50, limit: "150 live beats", fee: "8%" },
  { id: "producer_pro", name: "Pro", month: 10, year: 100, limit: "Unlimited · fair use", fee: "3%" },
] as const;

export default function ProducerPremiumPage() {
  const [token, setToken] = useState("");
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  const [interval, setInterval] = useState<Interval>("month");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    createClient().auth.getSession().then(async ({ data }) => {
      const accessToken = data.session?.access_token || "";
      setToken(accessToken);
      if (!accessToken) return;
      const response = await fetch("/api/beats?scope=mine", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok) setEntitlements(payload.entitlements || null);
    });
  }, []);

  async function checkout(planId: "producer_plus" | "producer_pro") {
    if (!token) {
      window.location.href = "/auth/login?next=/producer/premium";
      return;
    }
    setBusy(planId);
    setError("");
    try {
      const response = await fetch("/api/producer/premium/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ planId, interval }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.redirectUrl) throw new Error(payload.error || "Could not start checkout.");
      window.location.href = payload.redirectUrl;
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Could not start checkout.");
      setBusy("");
    }
  }

  const activePlan = entitlements?.planId || "producer_free";

  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <Link href="/creator/studio#beatstore" className="text-sm text-brand hover:underline">← Back to Creator Studio</Link>
      <p className="mt-8 text-xs font-semibold uppercase tracking-[.22em] text-brand">Beta · Stripe test mode</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">Producer plans that match your BeatStore.</h1>
      <p className="mt-4 max-w-3xl text-text-secondary">
        Your plan controls live catalogue capacity and the fee frozen into each new sale. It never buys editorial approval, radio rotation, or guaranteed sales.
      </p>

      <div className="mt-6 flex gap-2">
        {(["month", "year"] as Interval[]).map((value) => (
          <button key={value} type="button" onClick={() => setInterval(value)} className={`rounded-full px-4 py-2 text-sm ${interval === value ? "bg-brand text-black" : "border border-white/15"}`}>
            {value === "month" ? "Monthly" : "Yearly"}
          </button>
        ))}
      </div>

      {entitlements && (
        <div className="mt-6 rounded-2xl border border-brand/30 bg-brand/10 p-5 text-sm">
          Current: <strong>{activePlan.replace("producer_", "Producer ")}</strong> · {entitlements.liveCount || 0} live · {(Number(entitlements.marketplaceCommissionBps || 1500) / 100).toFixed(0)}% fee
        </div>
      )}
      {error && <p className="mt-5 rounded-xl bg-red-500/10 p-4 text-red-200" role="alert">{error}</p>}

      <section className="mt-8 grid gap-5 md:grid-cols-3">
        {plans.map((plan) => {
          const current = activePlan === plan.id;
          const price = interval === "year" ? plan.year : plan.month;
          return (
            <article key={plan.id} className={`rounded-2xl border p-6 ${current ? "border-brand bg-brand/10" : "border-white/10 bg-white/[.03]"}`}>
              <p className="text-xs uppercase tracking-[.18em] text-text-secondary">Producer {plan.name}</p>
              <p className="mt-3 text-4xl font-semibold">US${price}<span className="text-sm font-normal text-text-secondary">/{interval === "year" ? "yr" : "mo"}</span></p>
              <ul className="mt-5 space-y-2 text-sm text-text-secondary">
                <li>{plan.limit}</li>
                <li>{plan.fee} platform fee on new sales</li>
                <li>Processing shown separately</li>
              </ul>
              <div className="mt-6">
                {current ? (
                  <span className="inline-flex rounded-full border border-brand/40 px-4 py-2 text-sm text-brand">Current plan</span>
                ) : plan.id === "producer_free" ? (
                  <p className="text-sm text-text-secondary">Safe fallback after paid access ends; live beats are not deleted.</p>
                ) : (
                  <button type="button" disabled={Boolean(busy)} onClick={() => void checkout(plan.id)} className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-black disabled:opacity-60">
                    {busy === plan.id ? "Opening Stripe test…" : `Choose ${plan.name}`}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </section>

      <p className="mt-8 text-sm text-text-secondary">Beta checkout refuses to start unless the staging-only flag and Stripe test credentials are active.</p>
    </main>
  );
}
