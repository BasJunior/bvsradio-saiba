"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { trackEvent } from "@/lib/analytics";

type DeskSection = {
  id: string;
  title: string;
  body: string;
  bullets: string[];
  href?: string;
  cta?: string;
};

type Desk = {
  membershipId: string;
  planId: string;
  family: string;
  status: string;
  planName: string;
  badge: string;
  summary: string;
  monthlyUsd: number | null;
  yearlyUsd: number | null;
  billingInterval: string | null;
  endsAt: string | null;
  foundingSeat: boolean;
  entitlements: Record<string, unknown>;
  includes: string[];
  sections: DeskSection[];
};

type DeskPayload = {
  subscribed: boolean;
  desks: Desk[];
  upgradeHref: string;
  artistDeskHref: string;
  distributionStoreCount: number;
  message: string;
  growth?: {
    recommendation: {
      planId: string;
      planName: string;
      monthlyUsd: number;
      headline: string;
      reason: string;
      href: string;
    };
    value: {
      trackPlays: number;
      profileVisits: number;
      beatPreviews: number;
      saves: number;
      followers: number;
      salesUsd: number;
      serviceEnquiries: number;
      liveBroadcasts: number;
      countries: number;
    };
    commissionSavings: {
      monthlySalesUsd: number;
      freeFeeUsd: number;
      plusFeeAndSubUsd: number;
      proFeeAndSubUsd: number;
      plusSavingsUsd: number;
      proSavingsUsd: number;
      plusBreakEvenUsd: number;
      proBreakEvenVsPlusUsd: number;
    };
    upgradePrompts: Array<{
      id: string;
      title: string;
      body: string;
      href: string;
    }>;
    trials: Array<{ id: string; label: string; status: string }>;
    referral: {
      label: string;
      creditUsd: number;
      trigger: string;
      status: string;
    };
  };
  profileFlags?: {
    premiumActive: boolean;
    distributionEnabled: boolean;
    beatstoreTier: string;
    supporterActive: boolean;
  };
};

function money(value: number) {
  return `US$${value.toFixed(2)}`;
}

function ValueDashboard({ value }: { value: NonNullable<DeskPayload["growth"]>["value"] }) {
  const items = [
    ["Track plays", value.trackPlays],
    ["Profile visits", value.profileVisits],
    ["BeatStore previews", value.beatPreviews],
    ["Saves", value.saves],
    ["Followers", value.followers],
    ["Sales", money(value.salesUsd)],
    ["Service enquiries", value.serviceEnquiries],
    ["Live broadcasts", value.liveBroadcasts],
    ["Countries", value.countries],
  ];
  return (
    <section className="rounded-xl border border-white/10 bg-white/[.03] p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
        Your month on BVS
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map(([label, valueText]) => (
          <div key={label} className="rounded-lg border border-white/10 p-3">
            <p className="text-2xl font-semibold">{valueText}</p>
            <p className="mt-1 text-xs text-text-secondary">{label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function GrowthPanel({ growth }: { growth: NonNullable<DeskPayload["growth"]> }) {
  const savings = growth.commissionSavings;
  return (
    <div className="space-y-4">
      <article className="rounded-xl border border-brand/30 bg-brand/[.06] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
          Recommended plan
        </p>
        <h3 className="mt-2 text-xl font-semibold">{growth.recommendation.headline}</h3>
        <p className="mt-2 text-sm text-text-secondary">{growth.recommendation.reason}</p>
        <Link
          href={growth.recommendation.href}
          onClick={() =>
            trackEvent("plan_recommended", {
              plan: growth.recommendation.planId,
              source: "creator_studio",
            })
          }
          className="mt-4 inline-flex rounded-full bg-brand px-5 py-2 text-sm font-semibold text-black"
        >
          View {growth.recommendation.planName}
        </Link>
      </article>

      <article className="rounded-xl border border-white/10 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
          Producer fee calculator
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <p className="text-xs text-text-secondary">You sold</p>
            <p className="mt-1 text-2xl font-semibold">{money(savings.monthlySalesUsd)}</p>
          </div>
          <div>
            <p className="text-xs text-text-secondary">Free plan fees</p>
            <p className="mt-1 text-2xl font-semibold">{money(savings.freeFeeUsd)}</p>
          </div>
          <div>
            <p className="text-xs text-text-secondary">Plus fee + sub</p>
            <p className="mt-1 text-2xl font-semibold">{money(savings.plusFeeAndSubUsd)}</p>
          </div>
        </div>
        <p className="mt-4 text-sm text-text-secondary">
          {savings.plusSavingsUsd > 0
            ? `Producer Plus would save about ${money(savings.plusSavingsUsd)} per month at this sales level.`
            : `Producer Plus breaks even around ${money(savings.plusBreakEvenUsd)} in monthly BeatStore sales.`}
        </p>
      </article>

      {growth.upgradePrompts.length ? (
        <section className="grid gap-3 md:grid-cols-2">
          {growth.upgradePrompts.map((prompt) => (
            <Link
              key={prompt.id}
              href={prompt.href}
              onClick={() =>
                trackEvent("upgrade_prompt_seen", {
                  trigger: prompt.id,
                  source: "creator_studio",
                })
              }
              className="rounded-xl border border-white/10 p-4 hover:border-brand/50"
            >
              <h3 className="font-semibold">{prompt.title}</h3>
              <p className="mt-1 text-sm text-text-secondary">{prompt.body}</p>
            </Link>
          ))}
        </section>
      ) : null}

      <section className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-white/10 p-4">
          <h3 className="font-semibold">Trials</h3>
          <ul className="mt-3 space-y-2 text-sm text-text-secondary">
            {growth.trials.map((trial) => (
              <li key={trial.id}>{trial.label}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-white/10 p-4">
          <h3 className="font-semibold">Referral credits</h3>
          <p className="mt-2 text-sm text-text-secondary">
            {growth.referral.label}: {money(growth.referral.creditUsd)} credit,
            {` ${growth.referral.trigger}.`}
          </p>
        </div>
      </section>
    </div>
  );
}

export default function StudioPremiumDesk({ token }: { token: string }) {
  const [data, setData] = useState<DeskPayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/creator/premium-desk", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Could not load Premium desk");
      setData(payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load Premium desk");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  useEffect(() => {
    if (data?.growth?.recommendation) {
      trackEvent("premium_viewed", {
        source: "creator_studio",
        plan: data.growth.recommendation.planId,
        subscribed: data.subscribed,
      });
    }
  }, [data?.growth?.recommendation, data?.subscribed]);

  if (loading) {
    return <p className="py-6 text-sm text-text-secondary">Loading Premium desk…</p>;
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">
        {error}
      </div>
    );
  }

  if (!data) return null;

  // Not subscribed: compact upsell, not a full desk
  if (!data.subscribed) {
    return (
      <div className="space-y-5 py-2">
        <p className="text-sm text-text-secondary">{data.message}</p>
        <p className="text-sm text-text-secondary">
          Free path keeps submit → editorial → BVS rotation and on-site sales. Premium unlocks plan-specific
          tools (artist distribution, BeatStore tiers, supporter perks, …).
        </p>
        {data.growth ? (
          <>
            <ValueDashboard value={data.growth.value} />
            <GrowthPanel growth={data.growth} />
          </>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Link
            href={data.upgradeHref}
            className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-black"
          >
            View membership family
          </Link>
          <Link
            href={data.artistDeskHref}
            className="rounded-full border border-white/20 px-5 py-2 text-sm hover:border-brand"
          >
            Artist Premium shell
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 py-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Your Premium desk</p>
          <p className="mt-1 text-sm text-text-secondary">{data.message}</p>
        </div>
        <Link href={data.upgradeHref} className="text-sm text-brand underline-offset-2 hover:underline">
          Full catalogue
        </Link>
      </div>

      {data.growth ? (
        <>
          <ValueDashboard value={data.growth.value} />
          <GrowthPanel growth={data.growth} />
        </>
      ) : null}

      {data.desks.map((desk) => (
        <article
          key={desk.membershipId}
          className="rounded-2xl border border-brand/25 bg-brand/[0.06] p-5 md:p-6"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-brand">{desk.badge}</p>
              <h3 className="mt-1 text-xl font-semibold text-text-primary">{desk.planName}</h3>
              <p className="mt-1 text-sm text-text-secondary">{desk.summary}</p>
            </div>
            <div className="text-right text-sm">
              <p className="capitalize text-text-secondary">
                {desk.family.replaceAll("_", " ")} · {desk.status}
              </p>
              {desk.monthlyUsd != null && desk.monthlyUsd > 0 && (
                <p className="mt-1 font-semibold">
                  US${desk.monthlyUsd}
                  <span className="text-xs font-normal text-text-secondary">/mo</span>
                </p>
              )}
              {desk.endsAt && (
                <p className="mt-1 text-xs text-text-secondary">
                  Through {new Date(desk.endsAt).toLocaleDateString()}
                </p>
              )}
              {desk.foundingSeat && (
                <p className="mt-1 text-xs font-medium text-amber-100">Founding seat</p>
              )}
            </div>
          </div>

          {desk.includes.length > 0 && (
            <ul className="mt-4 grid gap-1.5 text-sm text-text-secondary sm:grid-cols-2">
              {desk.includes.slice(0, 8).map((line) => (
                <li key={line} className="flex gap-2">
                  <span className="text-brand">✓</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {desk.sections.map((sec) => (
              <div key={sec.id} className="rounded-xl border border-white/10 bg-black/25 p-4">
                <h4 className="font-semibold text-text-primary">{sec.title}</h4>
                <p className="mt-1 text-xs text-text-secondary">{sec.body}</p>
                <ul className="mt-3 list-disc space-y-1 pl-4 text-sm text-text-secondary">
                  {sec.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
                {sec.href && sec.cta && (
                  <Link
                    href={sec.href}
                    className="mt-3 inline-flex text-sm font-medium text-brand hover:underline"
                  >
                    {sec.cta} →
                  </Link>
                )}
              </div>
            ))}
          </div>

          {desk.family === "artist" && (
            <p className="mt-4 text-xs text-text-secondary">
              Distribution destinations catalogue: {data.distributionStoreCount}+ stores. Partner delivery and
              billing still gate live DSP hand-off.
            </p>
          )}
        </article>
      ))}

      <div className="flex flex-wrap gap-2 border-t border-white/10 pt-4">
        <Link
          href={data.artistDeskHref}
          className="rounded-full border border-white/20 px-4 py-2 text-sm hover:border-brand"
        >
          Artist Premium controls
        </Link>
        <Link href="/upload" className="rounded-full border border-white/20 px-4 py-2 text-sm hover:border-brand">
          Upload / submit
        </Link>
        <Link href="/premium" className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-black">
          Change plan
        </Link>
      </div>
    </div>
  );
}
