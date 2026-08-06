import type { Metadata } from "next";
import Link from "next/link";
import {
  PREMIUM_DISTRIBUTION_STORES,
  PREMIUM_TIERS,
  premiumPricingCopy,
} from "@/lib/premium-tiers";

export const metadata: Metadata = {
  title: "Premium Artist | BVS Radio",
  description:
    "BVS Premium Artist — Founding from US$9/month or US$90/year; Standard US$12/month or US$120/year. Distribution path when partners are ready; BVS rotation does not require Premium.",
  openGraph: {
    title: "Premium Artist | BVS Radio",
    description:
      "Founding Premium US$9/mo · Standard US$12/mo. Unlock distribution eligibility for approved releases.",
    url: "https://bvsradio.com/premium",
  },
};

const steps = [
  { n: "1", title: "Create artist account", href: "/auth/signup", cta: "Join BVS" },
  { n: "2", title: "Submit a release", href: "/upload", cta: "Upload music" },
  { n: "3", title: "Choose Premium", href: "/artist/premium", cta: "Artist Premium desk" },
  { n: "4", title: "Distribution when partner live", href: "/contact", cta: "Ask about distribution" },
];

export default function PremiumLandingPage() {
  const pricing = premiumPricingCopy();

  return (
    <main className="mx-auto max-w-4xl px-6 py-14">
      <p className="text-xs uppercase tracking-[0.2em] text-brand">Artists · Subscription</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">BVS Premium Artist</h1>
      <p className="mt-4 max-w-2xl text-lg text-text-secondary">
        Monthly (or yearly) subscription for creators who want the{" "}
        <strong className="text-text-primary">distribution path</strong> when licences and a partner are
        ready. Fans keep listening free on{" "}
        <Link href="/radio" className="text-brand hover:underline">
          Live Radio
        </Link>
        .
      </p>

      <div className="mt-8 rounded-2xl border border-brand/30 bg-brand/10 p-6">
        <p className="text-xs uppercase tracking-wider text-brand">Published rates</p>
        <p className="mt-1 text-3xl font-semibold text-text-primary">{pricing.headline}</p>
        <p className="mt-2 max-w-2xl text-sm text-text-secondary">
          From the BVS compliance & pricing plan (28 Jul 2026): Founding first, then Standard.{" "}
          {pricing.distributionNote}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/artist/premium"
            className="rounded-full bg-brand px-6 py-3 text-sm font-semibold text-black hover:bg-brand-dark"
          >
            Open Premium desk
          </Link>
          <Link
            href="/auth/signup"
            className="rounded-full border border-white/20 px-6 py-3 text-sm text-text-primary hover:border-brand"
          >
            Create account
          </Link>
        </div>
      </div>

      <section className="mt-12 grid gap-6 md:grid-cols-2">
        {PREMIUM_TIERS.map((tier) => (
          <article
            key={tier.id}
            className={`rounded-2xl border p-6 ${
              tier.featured ? "border-brand/40 bg-brand/5" : "border-white/10 bg-white/[0.03]"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xl font-semibold text-text-primary">{tier.name}</h2>
              <span className="rounded-full border border-white/15 px-2.5 py-0.5 text-[11px] uppercase tracking-wide text-brand">
                {tier.badge}
              </span>
            </div>
            <p className="mt-4 text-3xl font-semibold text-text-primary">
              US${tier.monthlyUsd}
              <span className="text-base font-normal text-text-secondary">/month</span>
            </p>
            <p className="mt-1 text-sm text-text-secondary">
              or <strong className="text-text-primary">US${tier.yearlyUsd}/year</strong> (2 months free)
            </p>
            <p className="mt-3 text-sm text-text-secondary">{tier.summary}</p>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-text-secondary">
              {tier.notes.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <Link
              href={`/artist/premium?tier=${tier.id}`}
              className={`mt-6 inline-flex rounded-full px-5 py-2.5 text-sm font-semibold ${
                tier.featured
                  ? "bg-brand text-black hover:bg-brand-dark"
                  : "border border-white/20 text-text-primary hover:border-brand"
              }`}
            >
              Select {tier.name}
            </Link>
          </article>
        ))}
      </section>

      <section className="mt-14">
        <h2 className="text-2xl font-semibold">Where Premium can take your music</h2>
        <p className="mt-2 max-w-2xl text-sm text-text-secondary">
          With Premium, approved releases enter BVS's multi-platform distribution path — targeting the major
          stores artists expect worldwide ({pricing.storeCount}+ destinations). Exact live stores depend on
          clearance, territory, and our delivery pipeline when each release ships. No aggregator brand is required
          on your side; BVS coordinates the hand-off after editorial publish + Premium entitlement.
        </p>
        <ul className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {PREMIUM_DISTRIBUTION_STORES.map((store) => (
            <li
              key={store}
              className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-text-primary"
            >
              {store}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-text-secondary">
          Highlights: Spotify, Apple Music & iTunes, YouTube Music + Content ID, TikTok, Instagram / Meta,
          Amazon Music, Deezer, TIDAL, Boomplay, Anghami, and more regional platforms.
        </p>
      </section>

      <section className="mt-14">
        <h2 className="text-2xl font-semibold">How it works</h2>
        <ol className="mt-6 space-y-4">
          {steps.map((s) => (
            <li
              key={s.n}
              className="flex flex-col gap-3 rounded-xl border border-white/10 bg-bg-secondary/40 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-start gap-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/20 text-sm font-bold text-brand">
                  {s.n}
                </span>
                <p className="font-medium text-text-primary">{s.title}</p>
              </div>
              <Link href={s.href} className="text-sm font-medium text-brand hover:underline sm:shrink-0">
                {s.cta} →
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-14 rounded-2xl border border-white/10 p-6">
        <h2 className="text-xl font-semibold">What Premium is not</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-text-secondary">
          <li>Not required to stream on BVS Radio after editorial publish</li>
          <li>Not a guarantee of a named DSP until the partner is contracted</li>
          <li>Not automatic publish of unapproved or rights-uncleared material</li>
          <li>Not inclusive of third-party distributor pass-through fees</li>
        </ul>
        <p className="mt-4 text-sm text-text-secondary">
          Product path:{" "}
          <span className="text-text-primary">Submit → Publish → Rotation → Premium distribution</span>. Card /
          EcoCash checkout for subscriptions attaches next; desk toggle is the entitlement shell today.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/upload" className="rounded-full border border-white/20 px-5 py-2.5 text-sm hover:border-brand">
            Submit music
          </Link>
          <Link href="/artists" className="rounded-full border border-white/20 px-5 py-2.5 text-sm hover:border-brand">
            Artist access
          </Link>
          <Link href="/contact" className="rounded-full border border-white/20 px-5 py-2.5 text-sm hover:border-brand">
            Contact
          </Link>
        </div>
      </section>
    </main>
  );
}
