"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  FAMILY_LABELS,
  PREMIUM_CATALOG,
  PREMIUM_DISTRIBUTION_STORES,
  type MembershipFamily,
  type CatalogPlan,
} from "@/lib/premium-catalog";

const FAMILIES: MembershipFamily[] = [
  "artist",
  "producer",
  "creator_bundle",
  "service",
  "team",
  "curator",
  "supporter",
  "brand",
];

type DisplayPlan = CatalogPlan & { priceUnit?: "month" | "release" };

const PREMIUM_INSTANT_PLAN: DisplayPlan = {
  id: "artist_instant",
  family: "artist",
  name: "Premium Instant",
  monthlyUsd: 5.99,
  yearlyUsd: null,
  badge: "One-time",
  status: "live",
  featured: true,
  commissionPercent: 15,
  priceUnit: "release",
  summary: "Pay only when one approved release is ready for wider distribution.",
  includes: [
    "US$5.99 per approved release",
    "One-time release fee — no monthly subscription",
    "Distribution entitlement applies to the selected release only",
    "No duplicate fee once that release is already eligible or moving through delivery",
    "Payment never buys editorial approval, rotation, charts or guaranteed streams",
  ],
};

function statusClass(status: CatalogPlan["status"]) {
  if (status === "live") return "border-emerald-400/40 bg-emerald-500/10 text-emerald-200";
  if (status === "pilot") return "border-amber-400/40 bg-amber-500/10 text-amber-100";
  return "border-violet-400/30 bg-violet-500/10 text-violet-100";
}

function visiblePlansFor(family: MembershipFamily): DisplayPlan[] {
  const base = PREMIUM_CATALOG.filter((plan) => plan.family === family && plan.id !== "artist_founding") as DisplayPlan[];
  return family === "artist" ? [PREMIUM_INSTANT_PLAN, ...base] : base;
}

export default function PremiumEcosystemPage() {
  const [family, setFamily] = useState<MembershipFamily>("artist");
  const plans = useMemo(() => visiblePlansFor(family), [family]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">BVS membership family</p>
      <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
        Pay for the outcome you need. <span className="text-brand">Keep the free foundation.</span>
      </h1>
      <p className="mt-4 max-w-3xl text-lg text-text-secondary">
        BVS Radio listening, editorial submission and approved rotation remain separate from paid distribution. Premium adds wider commercial delivery plus royalty and payout reporting support without buying editorial influence.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-brand/35 bg-brand/[.07] p-6">
          <p className="text-xs uppercase tracking-wider text-brand">Premium Instant</p>
          <p className="mt-2 text-3xl font-semibold">US$5.99 per release</p>
          <p className="mt-2 text-sm text-text-secondary">One-time release fee. No monthly subscription. Best for artists releasing occasionally.</p>
          <Link href="/artist/premium/instant" className="mt-5 inline-flex min-h-11 items-center rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-black">Choose an approved release</Link>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <p className="text-xs uppercase tracking-wider text-text-secondary">Artist Premium</p>
          <p className="mt-2 text-3xl font-semibold">US$12/month</p>
          <p className="mt-2 text-sm text-text-secondary">Or US$120/year. Ongoing distribution access, royalty reporting support and payout readiness for artists releasing regularly.</p>
          <Link href="/artist/premium" className="mt-5 inline-flex min-h-11 items-center rounded-full border border-brand/50 px-5 py-2.5 text-sm font-semibold text-brand">Open Artist Premium</Link>
        </div>
      </div>

      <p className="mt-4 rounded-xl border border-white/10 bg-white/[.02] p-4 text-sm text-text-secondary">
        The Founding Artist Premium offer closed on 27 August 2026. Existing founding members keep their grandfathered plan while continuously eligible; new purchases use Premium Instant or Artist Premium.
      </p>

      <div className="mt-12 flex flex-wrap gap-2">
        {FAMILIES.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setFamily(item)}
            className={`min-h-11 rounded-full px-4 py-2 text-sm font-medium transition ${
              family === item
                ? "bg-brand text-black"
                : "border border-white/15 text-text-secondary hover:border-brand hover:text-text-primary"
            }`}
          >
            {FAMILY_LABELS[item]}
          </button>
        ))}
      </div>

      <section className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {plans.map((plan) => {
          const unit = plan.priceUnit || "month";
          return (
            <article key={plan.id} className={`flex flex-col rounded-2xl border p-5 ${plan.featured ? "border-brand/40 bg-brand/5" : "border-white/10 bg-white/[0.03]"}`}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">{plan.name}</p>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${statusClass(plan.status)}`}>{plan.status}</span>
              </div>
              <p className="mt-3 text-3xl font-semibold tracking-tight">
                {plan.quoteOnly || plan.monthlyUsd == null ? "Quote" : plan.monthlyUsd === 0 ? "US$0" : `US$${plan.monthlyUsd}`}
                {plan.monthlyUsd != null && plan.monthlyUsd > 0 && !plan.quoteOnly && (
                  <span className="text-sm font-normal text-text-secondary">/{unit}</span>
                )}
              </p>
              {plan.yearlyUsd != null && plan.yearlyUsd > 0 && <p className="text-xs text-text-secondary">or US${plan.yearlyUsd}/year</p>}
              <p className="mt-1 text-[11px] uppercase tracking-wide text-brand">{plan.badge}</p>
              <p className="mt-3 text-sm text-text-secondary">{plan.summary}</p>
              {plan.commissionPercent != null && <p className="mt-2 text-xs text-amber-100/90">Marketplace fee: {plan.commissionPercent}%</p>}
              <ul className="mt-4 flex-1 list-disc space-y-1.5 pl-4 text-sm text-text-secondary">
                {plan.includes.map((line) => <li key={line}>{line}</li>)}
              </ul>
              <div className="mt-5">
                {plan.id === "artist_instant" ? (
                  <Link href="/artist/premium/instant" className="inline-flex min-h-11 items-center rounded-full bg-brand px-4 py-2 text-sm font-semibold text-black">Choose a release</Link>
                ) : plan.id === "artist_standard" ? (
                  <Link href="/artist/premium" className="inline-flex min-h-11 items-center rounded-full bg-brand px-4 py-2 text-sm font-semibold text-black">Open desk</Link>
                ) : plan.quoteOnly ? (
                  <Link href="/contact" className="inline-flex min-h-11 items-center rounded-full border border-white/20 px-4 py-2 text-sm">Contact sales</Link>
                ) : plan.status === "live" || plan.status === "pilot" ? (
                  <Link href={plan.family === "producer" ? "/catalogue?type=beat#beatstore" : "/auth/signup"} className="inline-flex min-h-11 items-center rounded-full border border-white/20 px-4 py-2 text-sm hover:border-brand">
                    {plan.monthlyUsd === 0 ? "Start free" : "Open / join"}
                  </Link>
                ) : (
                  <span className="text-xs text-text-secondary">Ships after foundation products are stable</span>
                )}
              </div>
            </article>
          );
        })}
      </section>

      <section className="mt-16">
        <h2 className="text-2xl font-semibold">Where Artist distribution can take your music</h2>
        <p className="mt-2 max-w-3xl text-sm text-text-secondary">
          Both Premium Instant and active Artist Premium use the same approved-release distribution path. Premium also prepares royalty and payout reporting for eligible BVS sales and future partner statements. Store availability varies by clearance, territory and delivery readiness.
        </p>
        <ul className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {PREMIUM_DISTRIBUTION_STORES.map((store) => <li key={store} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">{store}</li>)}
        </ul>
      </section>

      <section className="mt-16 grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 p-6">
          <h2 className="text-xl font-semibold">What stays free</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-text-secondary">
            <li>BVS Radio listening</li>
            <li>Editorial submission and approved BVS rotation</li>
            <li>On-site catalogue and commerce participation</li>
            <li>No paid editorial approval, chart rank or guaranteed streams</li>
          </ul>
        </div>
        <div className="rounded-2xl border border-brand/25 bg-brand/[.04] p-6">
          <h2 className="text-xl font-semibold">Which artist option?</h2>
          <p className="mt-3 text-sm text-text-secondary"><strong className="text-text-primary">Occasional releases:</strong> Premium Instant at US$5.99 per release.</p>
          <p className="mt-3 text-sm text-text-secondary"><strong className="text-text-primary">Regular releases:</strong> Artist Premium at US$12/month or US$120/year.</p>
        </div>
      </section>
    </main>
  );
}
