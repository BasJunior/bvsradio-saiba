import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Premium Artist | BVS Radio",
  description:
    "BVS Premium Artist — monthly path for multi-platform distribution when partners are configured. Listen and BVS rotation stay open after editorial publish.",
  openGraph: {
    title: "Premium Artist | BVS Radio",
    description:
      "Unlock distribution eligibility for your approved releases. Rotation on BVS does not require Premium.",
    url: "https://bvsradio.com/premium",
  },
};

function monthlyPriceLabel() {
  const n = Number(process.env.BVS_PREMIUM_MONTHLY_USD || "");
  if (Number.isFinite(n) && n > 0) return `$${n}/month`;
  return "Price publishing soon";
}

const includes = [
  {
    title: "Distribution eligibility",
    body: "When a BVS distribution partner is connected, Premium turns on the multi-platform queue for approved releases (Spotify and other DSPs via partner — partner TBD).",
  },
  {
    title: "Release packaging support",
    body: "Priority help getting album-shaped packs (cover, order, credits, rights) ready for editorial and off-platform hand-off.",
  },
  {
    title: "Still free on BVS",
    body: "Submit → editorial → publish → continuous rotation on BVS Radio stays available without Premium. Premium is for off-platform distribution, not for listening.",
  },
];

const steps = [
  { n: "1", title: "Create artist account", href: "/auth/signup", cta: "Join BVS" },
  { n: "2", title: "Submit a release", href: "/upload", cta: "Upload music" },
  { n: "3", title: "Enable Premium", href: "/artist/premium", cta: "Artist Premium desk" },
  { n: "4", title: "Distribution when partner live", href: "/contact", cta: "Ask about distribution" },
];

export default function PremiumLandingPage() {
  const price = monthlyPriceLabel();
  const priceSet = price.startsWith("$");

  return (
    <main className="mx-auto max-w-4xl px-6 py-14">
      <p className="text-xs uppercase tracking-[0.2em] text-brand">Artists · Subscription</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">BVS Premium Artist</h1>
      <p className="mt-4 max-w-2xl text-lg text-text-secondary">
        Monthly subscription for creators who want the <strong className="text-text-primary">distribution path</strong>{" "}
        when licences and a partner are ready. Fans keep listening free on{" "}
        <Link href="/radio" className="text-brand hover:underline">
          Live Radio
        </Link>
        .
      </p>

      <div className="mt-8 flex flex-wrap items-end gap-4 rounded-2xl border border-brand/30 bg-brand/10 p-6">
        <div>
          <p className="text-xs uppercase tracking-wider text-brand">Monthly</p>
          <p className="text-3xl font-semibold text-text-primary">{price}</p>
          {!priceSet && (
            <p className="mt-1 max-w-md text-sm text-text-secondary">
              Exact fee follows licence, tax, and distributor costs. We will not invent a number — set{" "}
              <code className="text-brand">BVS_PREMIUM_MONTHLY_USD</code> when you decide.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-3 md:ml-auto">
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

      <section className="mt-12 grid gap-6 md:grid-cols-3">
        {includes.map((item) => (
          <article key={item.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-lg font-semibold text-text-primary">{item.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">{item.body}</p>
          </article>
        ))}
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
                <div>
                  <p className="font-medium text-text-primary">{s.title}</p>
                </div>
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
        </ul>
        <p className="mt-4 text-sm text-text-secondary">
          Product vision:{" "}
          <span className="text-text-primary">Submit → Publish → Rotation → Premium distribution</span>. Billing
          (Stripe / Paynow) attaches when the monthly fee is set.
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
