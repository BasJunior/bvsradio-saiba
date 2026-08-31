"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  FAMILY_LABELS,
  PREMIUM_CATALOG,
  PREMIUM_DISTRIBUTION_STORES,
  foundingWindowPublicCopy,
  planHasPaidCheckout,
  premiumPricingCopy,
  type MembershipFamily,
  type CatalogPlan,
} from "@/lib/premium-catalog";

const FAMILIES: MembershipFamily[] = ["artist", "producer", "creator_bundle", "service", "team", "curator", "supporter", "brand"];

function statusClass(status: CatalogPlan["status"]) {
  if (status === "live") return "border-emerald-400/35 bg-emerald-500/10 text-emerald-200";
  if (status === "pilot") return "border-amber-400/35 bg-amber-500/10 text-amber-100";
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
  const plans = useMemo(() => PREMIUM_CATALOG.filter((plan) => plan.family === family), [family]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 px-5 py-7 sm:px-8 sm:py-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(212,175,55,.2),transparent_34%),radial-gradient(circle_at_85%_20%,rgba(212,175,55,.08),transparent_30%),linear-gradient(120deg,rgba(255,255,255,.04),transparent_42%)]" />
        <div className="relative">
          <div className="flex flex-wrap gap-2"><span className="bvs-chip bvs-chip-brand">BVS Premium</span><span className="bvs-chip">Optional paid tools</span></div>
          <h1 className="mt-5 max-w-4xl text-balance text-4xl font-semibold tracking-tight sm:text-6xl">One ecosystem. <span className="text-brand">Different paid outcomes.</span></h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-text-secondary sm:text-lg">{pricing.positioning}</p>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-[1.25fr_.75fr]">
        <div className="bvs-surface rounded-[1.75rem] p-5 sm:p-6">
          <p className="bvs-section-kicker">How BVS works</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">Submit → Publish → Rotate & sell → Premium ships wider</h2>
          <p className="mt-3 text-sm leading-6 text-text-secondary">Listening, editorial publish and BVS rotation stay free. Premium is for distribution, higher commerce capacity and specialised creator tools — never paid editorial approval.</p>
          <div className="mt-5 flex flex-wrap gap-2"><span className="bvs-chip">Listen free</span><span className="bvs-chip">Editorial publish</span><span className="bvs-chip">Sell on BVS</span><span className="bvs-chip bvs-chip-brand">Premium ships wider</span></div>
        </div>
        <div className="bvs-surface rounded-[1.75rem] p-5 sm:p-6">
          <p className="bvs-section-kicker">Artist pricing</p>
          <p className="mt-2 text-3xl font-semibold">{pricing.headline}</p>
          <p className="mt-3 text-sm leading-6 text-text-secondary">Founding <strong className="text-text-primary">US$9/mo · US$90/yr</strong><br />Standard <strong className="text-text-primary">US$12/mo · US$120/yr</strong></p>
          <p className="mt-3 text-xs leading-5 text-text-secondary">{foundingWindow.headline}{foundingWindow.open ? ` · ${foundingWindow.daysRemaining} day${foundingWindow.daysRemaining === 1 ? "" : "s"} left` : ""}</p>
          <Link href="/artist/premium" className="mt-5 inline-flex rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-black shadow-[0_12px_30px_rgba(212,175,55,.2)]">Open Artist Premium</Link>
        </div>
      </section>

      <section className="mt-10" aria-labelledby="premium-family-title">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="bvs-section-kicker">Choose your lane</p><h2 id="premium-family-title" className="mt-2 text-3xl font-semibold tracking-tight">Premium by creator type</h2></div>
          <p className="max-w-xl text-sm text-text-secondary">Only live or pilot products expose checkout. Later products stay clearly labelled rather than pretending to be available.</p>
        </div>
        <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
          {FAMILIES.map((value) => (
            <button key={value} type="button" onClick={() => setFamily(value)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${family === value ? "bg-brand text-black" : "border border-white/15 bg-white/[.025] text-text-secondary hover:border-brand hover:text-text-primary"}`}>{FAMILY_LABELS[value]}</button>
          ))}
        </div>
      </section>

      <section className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {plans.map((plan, index) => (
          <article key={plan.id} className={`bvs-surface bvs-surface-hover flex min-h-[24rem] flex-col rounded-[1.7rem] p-5 ${plan.featured ? "border-brand/50 ring-1 ring-brand/15" : ""}`}>
            <div className="flex items-start justify-between gap-2">
              <span className={`bvs-chip ${plan.featured ? "bvs-chip-brand" : ""}`}>{plan.featured ? "Featured" : `0${index + 1}`}</span>
              <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${statusClass(plan.status)}`}>{plan.status}</span>
            </div>
            <p className="mt-5 text-xs font-semibold uppercase tracking-[.14em] text-text-secondary">{plan.name}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight">{priceLine(plan)}{plan.monthlyUsd != null && plan.monthlyUsd > 0 && <span className="text-sm font-normal text-text-secondary">/mo</span>}</p>
            {plan.yearlyUsd != null && plan.yearlyUsd > 0 && <p className="mt-1 text-xs text-text-secondary">or US${plan.yearlyUsd}/year</p>}
            <p className="mt-2 text-[11px] font-semibold uppercase tracking-[.12em] text-brand">{plan.badge}</p>
            <p className="mt-4 text-sm leading-6 text-text-secondary">{plan.summary}</p>
            <div className="mt-5 space-y-2">
              {plan.includes.slice(0, 4).map((line) => <div key={line} className="bvs-surface-quiet rounded-xl p-3 text-sm text-text-secondary">{line}</div>)}
            </div>
            {plan.commissionPercent != null && <p className="mt-3 text-xs text-amber-100/90">Marketplace fee: {plan.commissionPercent}%</p>}
            <div className="mt-auto pt-6">
              {plan.family === "producer" && (plan.id === "producer_plus" || plan.id === "producer_pro") ? (
                <Link href={`/producer/premium?tier=${plan.id.replace("producer_", "")}`} className="inline-flex rounded-full bg-brand px-4 py-2.5 text-sm font-semibold text-black">Open producer desk</Link>
              ) : planHasPaidCheckout(plan) ? (
                <Link href={`/artist/premium?tier=${plan.id.replace("artist_", "")}`} className="inline-flex rounded-full bg-brand px-4 py-2.5 text-sm font-semibold text-black">Open Premium desk</Link>
              ) : plan.quoteOnly ? (
                <Link href="/contact" className="inline-flex rounded-full border border-white/15 px-4 py-2.5 text-sm">Contact sales</Link>
              ) : plan.monthlyUsd === 0 && plan.status === "live" ? (
                <Link href={plan.family === "producer" ? "/catalogue?type=beat#beatstore" : "/auth/signup"} className="inline-flex rounded-full border border-white/15 px-4 py-2.5 text-sm hover:border-brand">Start free</Link>
              ) : (
                <Link href="/contact" className="inline-flex rounded-full border border-white/15 px-4 py-2.5 text-sm">{plan.status === "later" ? "Not for sale yet" : "Join waitlist"}</Link>
              )}
            </div>
          </article>
        ))}
      </section>

      <section className="mt-10 grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
        <div className="bvs-surface rounded-[1.75rem] p-5 sm:p-6">
          <p className="bvs-section-kicker">Distribution network</p>
          <h2 className="mt-2 text-2xl font-semibold">Where Artist Premium can take approved music</h2>
          <p className="mt-2 text-sm leading-6 text-text-secondary">{pricing.distributionNote} Availability varies by clearance, territory and delivery readiness.</p>
          <div className="mt-5 flex flex-wrap gap-2">{PREMIUM_DISTRIBUTION_STORES.slice(0, 16).map((store) => <span key={store} className="bvs-chip">{store}</span>)}</div>
        </div>
        <div className="bvs-surface-quiet rounded-[1.75rem] p-5 sm:p-6">
          <p className="bvs-section-kicker">What stays free</p>
          <div className="mt-4 space-y-2 text-sm text-text-secondary">
            <p>• BVS Radio continuous listening</p>
            <p>• Editorial submission and approved rotation</p>
            <p>• On-site catalogue and commerce participation</p>
            <p>• No paid approval, chart rank or guaranteed streams</p>
          </div>
          <div className="mt-5 flex flex-wrap gap-2"><Link href="/creator/studio" className="rounded-full border border-white/15 px-4 py-2 text-sm hover:border-brand">Creator Studio</Link><Link href="/upload" className="rounded-full border border-white/15 px-4 py-2 text-sm hover:border-brand">Submit music</Link></div>
        </div>
      </section>
    </main>
  );
}
