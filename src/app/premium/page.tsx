"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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

type DisplayPlan = CatalogPlan & { priceUnit?: "month" | "release" | "year" };
type PremiumAccent = "instant" | MembershipFamily;

function premiumAccentFor(family: MembershipFamily, planId?: string): PremiumAccent {
  return planId === "artist_instant" ? "instant" : family;
}

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
    "One-time release fee — no subscription",
    "Distribution entitlement applies to the selected release only",
    "No duplicate fee once that release is already eligible or moving through delivery",
    "Payment never buys editorial approval, rotation, charts or guaranteed streams",
  ],
};

const ARTIST_ANNUAL_PLAN: DisplayPlan = {
  id: "artist_annual",
  family: "artist",
  name: "Artist Premium Annual",
  monthlyUsd: 29,
  yearlyUsd: 29,
  badge: "Best for regular releases",
  status: "live",
  featured: true,
  commissionPercent: 15,
  priceUnit: "year",
  summary: "One full year of ongoing distribution access for approved releases.",
  includes: [
    "US$29 for one year",
    "Approved-release distribution access throughout the active year",
    "Royalty and payout reporting support",
    "Five Premium Instant releases cost US$29.95 — Annual is cheaper from release five",
    "Existing Founding and Standard subscribers keep their current terms",
    "Payment never buys editorial approval, rotation, charts or guaranteed streams",
  ],
};

function statusClass(status: CatalogPlan["status"]) {
  if (status === "live") return "border-emerald-400/40 bg-emerald-500/10 text-emerald-200";
  if (status === "pilot") return "border-amber-400/40 bg-amber-500/10 text-amber-100";
  return "border-violet-400/30 bg-violet-500/10 text-violet-100";
}

function visiblePlansFor(family: MembershipFamily): DisplayPlan[] {
  const hiddenLegacyArtistPlans = new Set(["artist_founding", "artist_standard", "artist_plus"]);
  const base = PREMIUM_CATALOG.filter(
    (plan) => plan.family === family && !(family === "artist" && hiddenLegacyArtistPlans.has(plan.id)),
  ) as DisplayPlan[];
  return family === "artist" ? [PREMIUM_INSTANT_PLAN, ARTIST_ANNUAL_PLAN, ...base] : base;
}

export default function PremiumEcosystemPage() {
  const [family, setFamily] = useState<MembershipFamily>("artist");
  const plans = useMemo(() => visiblePlansFor(family), [family]);

  useEffect(() => {
    const requestedFamily = new URLSearchParams(window.location.search).get("family") as MembershipFamily | null;
    if (requestedFamily && FAMILIES.includes(requestedFamily)) setFamily(requestedFamily);
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 md:px-6 md:py-14">
      <p data-premium-accent="instant" className="bvs-premium-accent-label text-xs font-semibold uppercase tracking-[0.2em]">BVS membership family</p>
      <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
        Pay for the outcome you need. <span data-premium-accent="instant" className="bvs-premium-accent-label">Keep the free foundation.</span>
      </h1>
      <p className="mt-4 max-w-3xl text-lg text-text-secondary">
        BVS Radio listening, editorial submission and approved rotation remain separate from paid distribution. Premium adds wider commercial delivery plus royalty and payout reporting support without buying editorial influence.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 p-6">
          <p className="text-xs uppercase tracking-wider text-text-secondary">Artist Free</p>
          <p className="mt-2 text-3xl font-semibold">US$0</p>
          <p className="mt-2 text-sm text-text-secondary">Submit, publish, rotate on BVS and keep your artist home base without paying for off-platform distribution.</p>
          <Link href="/auth/signup" className="mt-5 inline-flex min-h-11 items-center rounded-full border border-white/20 px-5 py-2.5 text-sm font-semibold">Start free</Link>
        </div>
        <div data-premium-accent="instant" className="bvs-premium-accent-card rounded-2xl border p-6">
          <p className="bvs-premium-accent-label text-xs uppercase tracking-wider">Premium Instant</p>
          <p className="mt-2 text-3xl font-semibold">US$5.99 per release</p>
          <p className="mt-2 text-sm text-text-secondary">One-time release fee. No subscription. Best for occasional releases.</p>
          <Link href="/artist/premium/instant" className="bvs-premium-accent-button mt-5 inline-flex min-h-11 items-center rounded-full border px-5 py-2.5 text-sm font-semibold">Choose an approved release</Link>
        </div>
        <div data-premium-accent="artist" className="bvs-premium-accent-card rounded-2xl border p-6">
          <p className="bvs-premium-accent-label text-xs uppercase tracking-wider">Artist Premium Annual</p>
          <p className="mt-2 text-3xl font-semibold">US$29/year</p>
          <p className="mt-2 text-sm text-text-secondary">A full year of ongoing approved-release distribution access. Five one-off releases cost US$29.95.</p>
          <Link href="/artist/premium" className="bvs-premium-accent-button mt-5 inline-flex min-h-11 items-center rounded-full border px-5 py-2.5 text-sm font-semibold">Get Annual</Link>
        </div>
      </div>

      <p className="mt-4 rounded-xl border border-white/10 bg-white/[.02] p-4 text-sm text-text-secondary">
        Existing Founding and Standard Artist Premium subscriptions keep their current terms while valid. Those legacy plans are not repriced or converted automatically; new ongoing purchases use Artist Premium Annual at US$29/year.
      </p>

      <div className="mt-10 overflow-x-auto pb-2" aria-label="Membership families">
        <div className="flex min-w-max gap-2">
        {FAMILIES.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setFamily(item)}
            data-premium-accent={item}
            aria-pressed={family === item}
            className="bvs-premium-accent-button min-h-11 rounded-full border px-4 py-2 text-sm font-medium"
          >
            {FAMILY_LABELS[item]}
          </button>
        ))}
        </div>
      </div>

      <section className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {plans.map((plan) => {
          const unit = plan.priceUnit || "month";
          const displayPrice = plan.id === "artist_annual"
            ? "US$29"
            : plan.quoteOnly || plan.monthlyUsd == null
              ? "Quote"
              : plan.monthlyUsd === 0
                ? "US$0"
                : `US$${plan.monthlyUsd}`;
          return (
            <article key={plan.id} data-premium-accent={premiumAccentFor(plan.family, plan.id)} className="bvs-premium-accent-card flex flex-col rounded-2xl border p-5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">{plan.name}</p>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${statusClass(plan.status)}`}>{plan.status}</span>
              </div>
              <p className="mt-3 text-3xl font-semibold tracking-tight">
                {displayPrice}
                {plan.monthlyUsd != null && plan.monthlyUsd > 0 && !plan.quoteOnly && (
                  <span className="text-sm font-normal text-text-secondary">/{unit}</span>
                )}
              </p>
              {plan.yearlyUsd != null && plan.yearlyUsd > 0 && plan.id !== "artist_annual" && <p className="text-xs text-text-secondary">or US${plan.yearlyUsd}/year</p>}
              <p className="bvs-premium-accent-label mt-1 text-[11px] uppercase tracking-wide">{plan.badge}</p>
              <p className="mt-3 text-sm text-text-secondary">{plan.summary}</p>
              {plan.commissionPercent != null && <p className="mt-2 text-xs text-amber-100/90">Marketplace fee: {plan.commissionPercent}%</p>}
              <ul className="mt-4 flex-1 list-disc space-y-1.5 pl-4 text-sm text-text-secondary">
                {plan.includes.map((line) => <li key={line}>{line}</li>)}
              </ul>
              <div className="mt-5">
                {plan.id === "artist_instant" ? (
                  <Link href="/artist/premium/instant" className="bvs-premium-accent-button inline-flex min-h-11 items-center rounded-full border px-4 py-2 text-sm font-semibold">Choose a release</Link>
                ) : plan.id === "artist_annual" ? (
                  <Link href="/artist/premium" className="bvs-premium-accent-button inline-flex min-h-11 items-center rounded-full border px-4 py-2 text-sm font-semibold">Get Annual</Link>
                ) : plan.quoteOnly ? (
                  <Link href="/contact" className="inline-flex min-h-11 items-center rounded-full border border-white/20 px-4 py-2 text-sm">Contact sales</Link>
                ) : plan.status === "live" || plan.status === "pilot" ? (
                  <Link href={plan.family === "producer" ? "/catalogue?type=beat#beatstore" : "/auth/signup"} className="bvs-premium-accent-button inline-flex min-h-11 items-center rounded-full border px-4 py-2 text-sm">
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

      <section data-premium-accent="artist" className="mt-14">
        <h2 className="text-2xl font-semibold">Where Artist distribution can take your music</h2>
        <p className="mt-2 max-w-3xl text-sm text-text-secondary">
          Both Premium Instant and active Artist Premium Annual use the same approved-release distribution path. Store availability varies by clearance, territory and delivery readiness.
        </p>
        <ul className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {PREMIUM_DISTRIBUTION_STORES.map((store) => <li key={store} className="bvs-premium-accent-card rounded-xl border px-3 py-2 text-sm">{store}</li>)}
        </ul>
      </section>

      <section className="mt-14 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 p-6">
          <h2 className="text-xl font-semibold">What stays free</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-text-secondary">
            <li>BVS Radio listening</li>
            <li>Editorial submission and approved BVS rotation</li>
            <li>On-site catalogue and commerce participation</li>
            <li>No paid editorial approval, chart rank or guaranteed streams</li>
          </ul>
        </div>
        <div data-premium-accent="artist" className="bvs-premium-accent-card rounded-2xl border p-6">
          <h2 className="bvs-premium-accent-label text-xl font-semibold">Which artist option?</h2>
          <p className="mt-3 text-sm text-text-secondary"><strong className="text-text-primary">Just BVS:</strong> stay on Artist Free.</p>
          <p className="mt-3 text-sm text-text-secondary"><strong className="text-text-primary">Occasional releases:</strong> Premium Instant at US$5.99 per release.</p>
          <p className="mt-3 text-sm text-text-secondary"><strong className="text-text-primary">Five or more distributed releases/year:</strong> Artist Premium Annual at US$29/year.</p>
        </div>
      </section>
    </main>
  );
}
