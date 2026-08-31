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
  { id: "producer_free", name: "Free", month: 0, year: 0, limit: "25 live beats", fee: "15%", copy: "A safe starting point for building a public BeatStore catalogue." },
  { id: "producer_plus", name: "Plus", month: 5, year: 50, limit: "150 live beats", fee: "8%", copy: "More catalogue capacity and a lower platform fee for active producers." },
  { id: "producer_pro", name: "Pro", month: 10, year: 100, limit: "Unlimited · fair use", fee: "3%", copy: "For producers running BeatStore as a serious part of their business." },
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
      const response = await fetch("/api/beats?scope=mine", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
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
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 px-5 py-7 sm:px-8 sm:py-9">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(212,175,55,.18),transparent_34%),linear-gradient(120deg,rgba(255,255,255,.04),transparent_42%)]" />
        <div className="relative">
          <div className="flex flex-wrap gap-2"><span className="bvs-chip bvs-chip-brand">Producer Premium</span><span className="bvs-chip">BeatStore</span><span className="bvs-chip">Beta · Stripe test</span></div>
          <h1 className="mt-5 max-w-4xl text-balance text-4xl font-semibold tracking-tight sm:text-5xl">Plans that grow with your BeatStore.</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-text-secondary sm:text-base">Your plan controls live catalogue capacity and the fee frozen into each new sale. It never buys editorial approval, radio rotation or guaranteed sales.</p>
          <Link href="/creator/studio" className="mt-5 inline-flex text-sm font-semibold text-brand">← Back to Studio</Link>
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-[.8fr_1.2fr]">
        <div className="bvs-surface rounded-[1.6rem] p-5 sm:p-6">
          <p className="bvs-section-kicker">Current plan</p>
          <h2 className="mt-2 text-2xl font-semibold">{activePlan.replace("producer_", "Producer ")}</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="bvs-chip bvs-chip-brand">{entitlements?.liveCount || 0} live beats</span>
            <span className="bvs-chip">{(Number(entitlements?.marketplaceCommissionBps || 1500) / 100).toFixed(0)}% fee</span>
          </div>
          <p className="mt-4 text-sm leading-6 text-text-secondary">Paid access changes capacity and commission on new sales. If paid access ends, your live beats are not deleted.</p>
        </div>
        <div className="bvs-surface rounded-[1.6rem] p-5 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div><p className="bvs-section-kicker">Billing</p><h2 className="mt-2 text-2xl font-semibold">Choose monthly or yearly.</h2></div>
            <div className="flex gap-2">
              {(["month", "year"] as Interval[]).map((value) => (
                <button key={value} type="button" onClick={() => setInterval(value)} className={`rounded-full px-4 py-2 text-sm ${interval === value ? "bg-brand text-black" : "border border-white/15"}`}>{value === "month" ? "Monthly" : "Yearly"}</button>
              ))}
            </div>
          </div>
          <p className="mt-4 text-sm text-text-secondary">Yearly pricing lowers the effective monthly cost while keeping the same BeatStore entitlements.</p>
        </div>
      </section>

      {error && <p className="mt-5 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-red-200" role="alert">{error}</p>}

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        {plans.map((plan, index) => {
          const current = activePlan === plan.id;
          const price = interval === "year" ? plan.year : plan.month;
          const featured = plan.id === "producer_plus";
          return (
            <article key={plan.id} className={`bvs-surface bvs-surface-hover flex min-h-[22rem] flex-col rounded-[1.7rem] p-5 sm:p-6 ${current ? "border-brand/55 ring-1 ring-brand/20" : ""}`}>
              <div className="flex items-center justify-between gap-3">
                <span className={`bvs-chip ${featured ? "bvs-chip-brand" : ""}`}>{featured ? "Best fit" : `0${index + 1}`}</span>
                {current && <span className="bvs-chip bvs-chip-brand">Current</span>}
              </div>
              <p className="mt-5 text-xs font-semibold uppercase tracking-[.18em] text-text-secondary">Producer {plan.name}</p>
              <p className="mt-2 text-4xl font-semibold">US${price}<span className="text-sm font-normal text-text-secondary">/{interval === "year" ? "yr" : "mo"}</span></p>
              <p className="mt-3 text-sm leading-6 text-text-secondary">{plan.copy}</p>
              <div className="mt-5 space-y-2 text-sm text-text-secondary">
                <div className="bvs-surface-quiet rounded-xl p-3">{plan.limit}</div>
                <div className="bvs-surface-quiet rounded-xl p-3">{plan.fee} platform fee on new sales</div>
                <div className="bvs-surface-quiet rounded-xl p-3">Processing shown separately</div>
              </div>
              <div className="mt-auto pt-6">
                {current ? (
                  <span className="inline-flex rounded-full border border-brand/40 px-4 py-2 text-sm text-brand">Current plan</span>
                ) : plan.id === "producer_free" ? (
                  <p className="text-sm text-text-secondary">Safe fallback after paid access ends.</p>
                ) : (
                  <button type="button" disabled={Boolean(busy)} onClick={() => void checkout(plan.id)} className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-black shadow-[0_12px_30px_rgba(212,175,55,.2)] disabled:opacity-60">{busy === plan.id ? "Opening Stripe test…" : `Choose ${plan.name}`}</button>
                )}
              </div>
            </article>
          );
        })}
      </section>

      <section className="bvs-surface-quiet mt-7 rounded-[1.5rem] p-5 text-sm leading-6 text-text-secondary">
        Beta checkout refuses to start unless the staging-only flag and Stripe test credentials are active. Premium changes commerce capacity; editorial decisions stay independent.
      </section>
    </main>
  );
}
