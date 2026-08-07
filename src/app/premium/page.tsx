"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  FAMILY_LABELS,
  FOUNDING_WINDOW_LABEL,
  PREMIUM_CATALOG,
  PREMIUM_DISTRIBUTION_STORES,
  foundingWindowPublicCopy,
  premiumPricingCopy,
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

function statusClass(status: CatalogPlan["status"]) {
  if (status === "live") return "border-emerald-400/40 bg-emerald-500/10 text-emerald-200";
  if (status === "pilot") return "border-amber-400/40 bg-amber-500/10 text-amber-100";
  return "border-violet-400/30 bg-violet-500/10 text-violet-100";
}

function priceLine(plan: CatalogPlan) {
  if (plan.quoteOnly || plan.monthlyUsd == null) return "Quote";
  if (plan.monthlyUsd === 0) return "US$0";
  return `US$${plan.monthlyUsd}`;
}

export default function PremiumEcosystemPage() {
  const [family, setFamily] = useState<MembershipFamily>("artist");
  const pricing = premiumPricingCopy();
  const foundingWindow = useMemo(() => foundingWindowPublicCopy(), []);
  const plans = useMemo(() => PREMIUM_CATALOG.filter((p) => p.family === family), [family]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">BVS membership family</p>
      <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
        One ecosystem. <span className="text-brand">Different paid outcomes.</span>
      </h1>
      <p className="mt-4 max-w-3xl text-lg text-text-secondary">{pricing.positioning}</p>

      <div className="mt-8 grid gap-4 md:grid-cols-[1.4fr_.9fr]">
        <div className="rounded-2xl border border-brand/30 bg-brand/10 p-6">
          <p className="text-xs uppercase tracking-wider text-brand">Pipeline</p>
          <p className="mt-2 text-xl font-semibold text-text-primary">
            Submit → Publish → Rotate & sell → Premium ships wider
          </p>
          <p className="mt-2 text-sm text-text-secondary">
            Listening, editorial publish, and BVS rotation stay free. Artist Premium is the commercial switch for
            multi-platform distribution of <strong className="text-text-primary">approved</strong> releases.
            Producer, Supporter, Team, and service plans are separate products — not one giant locked feature pile.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-text-secondary">
            <span className="rounded-full border border-white/15 px-3 py-1">Listen free</span>
            <span className="rounded-full border border-white/15 px-3 py-1">Publish through editorial</span>
            <span className="rounded-full border border-white/15 px-3 py-1">Sell on BVS</span>
            <span className="rounded-full border border-white/15 px-3 py-1">Premium ships wider</span>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <p className="text-xs uppercase tracking-wider text-text-secondary">Artist list prices (locked)</p>
          <p className="mt-2 text-3xl font-semibold">{pricing.headline}</p>
          <p className="mt-2 text-sm text-text-secondary">
            Founding <strong className="text-text-primary">US$9/mo · US$90/yr</strong>
            <br />
            <span className="text-text-primary">{foundingWindow.headline}</span>
            {foundingWindow.open ? " · first 50 seats (date + seat gate)" : " · Standard pricing applies"}
            <br />
            Standard <strong className="text-text-primary">US$12/mo · US$120/yr</strong>
            {!foundingWindow.open && (
              <>
                {" "}
                (after {FOUNDING_WINDOW_LABEL})
              </>
            )}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href="/artist/premium"
              className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-black hover:bg-brand-dark"
            >
              Artist Premium desk
            </Link>
            <Link
              href="/auth/signup"
              className="rounded-full border border-white/20 px-5 py-2.5 text-sm hover:border-brand"
            >
              Create account
            </Link>
          </div>
        </div>
      </div>

      {/* Role tabs */}
      <div className="mt-12 flex flex-wrap gap-2">
        {FAMILIES.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFamily(f)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              family === f
                ? "bg-brand text-black"
                : "border border-white/15 text-text-secondary hover:border-brand hover:text-text-primary"
            }`}
          >
            {FAMILY_LABELS[f]}
          </button>
        ))}
      </div>

      <section className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {plans.map((plan) => (
          <article
            key={plan.id}
            className={`flex flex-col rounded-2xl border p-5 ${
              plan.featured ? "border-brand/40 bg-brand/5" : "border-white/10 bg-white/[0.03]"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">{plan.name}</p>
              <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${statusClass(plan.status)}`}>
                {plan.status}
              </span>
            </div>
            <p className="mt-3 text-3xl font-semibold tracking-tight">
              {priceLine(plan)}
              {plan.monthlyUsd != null && plan.monthlyUsd > 0 && (
                <span className="text-sm font-normal text-text-secondary">/mo</span>
              )}
            </p>
            {plan.yearlyUsd != null && plan.yearlyUsd > 0 && (
              <p className="text-xs text-text-secondary">or US${plan.yearlyUsd}/year</p>
            )}
            <p className="mt-1 text-[11px] uppercase tracking-wide text-brand">{plan.badge}</p>
            <p className="mt-3 text-sm text-text-secondary">{plan.summary}</p>
            {plan.commissionPercent != null && (
              <p className="mt-2 text-xs text-amber-100/90">Marketplace fee: {plan.commissionPercent}%</p>
            )}
            <ul className="mt-4 flex-1 list-disc space-y-1.5 pl-4 text-sm text-text-secondary">
              {plan.includes.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <div className="mt-5">
              {plan.family === "artist" && plan.id !== "artist_free" && plan.status === "live" ? (
                <Link
                  href={`/artist/premium?tier=${plan.id.replace("artist_", "")}`}
                  className="inline-flex rounded-full bg-brand px-4 py-2 text-sm font-semibold text-black"
                >
                  Open desk
                </Link>
              ) : plan.quoteOnly ? (
                <Link href="/contact" className="inline-flex rounded-full border border-white/20 px-4 py-2 text-sm">
                  Contact sales
                </Link>
              ) : plan.status === "live" || plan.status === "pilot" ? (
                <Link
                  href={plan.family === "producer" ? "/catalogue?type=beat#beatstore" : "/auth/signup"}
                  className="inline-flex rounded-full border border-white/20 px-4 py-2 text-sm hover:border-brand"
                >
                  {plan.monthlyUsd === 0 ? "Start free" : "Join waitlist / desk"}
                </Link>
              ) : (
                <span className="text-xs text-text-secondary">Ships after foundation products are stable</span>
              )}
            </div>
          </article>
        ))}
      </section>

      <section className="mt-16">
        <h2 className="text-2xl font-semibold">Where Artist Premium can take your music</h2>
        <p className="mt-2 max-w-3xl text-sm text-text-secondary">
          {pricing.distributionNote} Store list is destination-facing — no middleman brands in public copy.
          Availability varies by clearance, territory, and delivery readiness ({pricing.storeCount}+ targets).
        </p>
        <ul className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {PREMIUM_DISTRIBUTION_STORES.map((store) => (
            <li key={store} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">
              {store}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-16 grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 p-6">
          <h2 className="text-xl font-semibold">What stays free</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-text-secondary">
            <li>BVS Radio continuous listening</li>
            <li>Editorial submission and approved rotation</li>
            <li>On-site catalogue and commerce participation</li>
            <li>No paid editorial approval, chart rank, or guaranteed streams</li>
          </ul>
        </div>
        <div className="rounded-2xl border border-amber-400/25 bg-amber-500/5 p-6">
          <h2 className="text-xl font-semibold">Status labels</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-text-secondary">
            <li>
              <strong className="text-emerald-200">Live</strong> — Artist Free / Founding / Standard with Paynow
              checkout, founding date+seat gate, and distribution entitlement flags
            </li>
            <li>
              <strong className="text-amber-100">Pilot</strong> — Producer / Supporter bands published; catalogue
              limits and commission rules are active while we harden analytics UX
            </li>
            <li>
              <strong className="text-violet-100">Later</strong> — Team, Service Pro, Curator Pro, brands — after
              partner economics and multi-seat ops are locked
            </li>
          </ul>
        </div>
      </section>

      <section className="mt-14 rounded-2xl border border-white/10 bg-gradient-to-br from-brand/10 to-cyan-500/5 p-6 md:p-8">
        <h2 className="text-2xl font-semibold">Shipped now · next milestones</h2>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-200">Live today</p>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-text-secondary">
              <li>Artist Premium desk + Paynow subscription billing</li>
              <li>Founding eligibility: through {FOUNDING_WINDOW_LABEL} and first 50 seats</li>
              <li>Distribution entitlement on paid Artist Premium for approved releases</li>
              <li>Producer BeatStore free/plus/pro limits and marketplace fee bands</li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-brand">Next up</p>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-text-secondary">
              <li>Deeper release-status tracking in the artist desk as delivery ops scale</li>
              <li>Supporter-only archive and community events (never buys editorial)</li>
              <li>Team / Service / Curator / Brand products after partner cost validation</li>
            </ul>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/upload" className="rounded-full border border-white/20 px-5 py-2.5 text-sm hover:border-brand">
            Submit music
          </Link>
          <Link href="/shop" className="rounded-full border border-white/20 px-5 py-2.5 text-sm hover:border-brand">
            Services shop
          </Link>
          <Link href="/contact" className="rounded-full border border-white/20 px-5 py-2.5 text-sm hover:border-brand">
            Partnerships
          </Link>
        </div>
      </section>
    </main>
  );
}
