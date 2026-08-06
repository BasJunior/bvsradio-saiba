"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

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
  profileFlags?: {
    premiumActive: boolean;
    distributionEnabled: boolean;
    beatstoreTier: string;
    supporterActive: boolean;
  };
};

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
    void load();
  }, [load]);

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
      <div className="space-y-4 py-2">
        <p className="text-sm text-text-secondary">{data.message}</p>
        <p className="text-sm text-text-secondary">
          Free path keeps submit → editorial → BVS rotation and on-site sales. Premium unlocks plan-specific
          tools (artist distribution, BeatStore tiers, supporter perks, …).
        </p>
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
