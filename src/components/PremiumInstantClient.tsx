"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase";

type ReleaseOption = {
  id: string;
  title: string;
  releaseType: string;
  editorialStatus: string;
  isPublic: boolean;
  distributionStatus: string | null;
  canPurchase: boolean;
  reason: string;
};

type Payload = {
  priceUsd: number;
  label: string;
  note: string;
  releases: ReleaseOption[];
  stripeEnabled: boolean;
  paynowEnabled: boolean;
};

export default function PremiumInstantClient() {
  const searchParams = useSearchParams();
  const [token, setToken] = useState("");
  const [data, setData] = useState<Payload | null>(null);
  const [releaseId, setReleaseId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState(() => {
    const state = searchParams.get("checkout");
    const ref = searchParams.get("ref");
    if (state === "stripe-success") return `Payment received${ref ? ` (${ref})` : ""}. Distribution eligibility will appear after the verified webhook completes.`;
    if (state === "paynow-return") return `Returned from Paynow${ref ? ` (${ref})` : ""}. If payment completed, eligibility updates after verification.`;
    if (state === "stripe-cancelled") return "Checkout cancelled. Nothing was charged by BVS.";
    return "";
  });

  const load = useCallback(async (accessToken: string) => {
    const response = await fetch("/api/artist/premium/instant", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Could not load Premium Instant.");
    setData(payload);
    const first = (payload.releases || []).find((item: ReleaseOption) => item.canPurchase);
    if (first) setReleaseId((current) => current || first.id);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setError("Account service is not configured.");
      return;
    }
    void createClient().auth.getSession().then(async ({ data: sessionData }) => {
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        setError("Sign in with your artist account.");
        return;
      }
      setToken(accessToken);
      await load(accessToken);
    }).catch((caught) => setError(caught instanceof Error ? caught.message : "Could not open Premium Instant."));
  }, [load]);

  const selected = useMemo(() => data?.releases.find((release) => release.id === releaseId) || null, [data, releaseId]);

  const checkout = async (provider: "stripe" | "paynow") => {
    if (!token || !releaseId) return;
    setBusy(true);
    setError("");
    setInfo("");
    try {
      const response = await fetch("/api/artist/premium/instant", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ releaseId, provider }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not start checkout.");
      if (!payload.redirectUrl) throw new Error("Payment provider did not return a checkout URL.");
      window.location.href = payload.redirectUrl as string;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Checkout failed.");
      setBusy(false);
    }
  };

  if (error && !data) {
    return (
      <div className="rounded-2xl border border-red-400/25 bg-red-500/10 p-5 text-sm text-red-200">
        <p>{error}</p>
        <Link href="/auth/login?next=/artist/premium/instant" className="mt-4 inline-flex min-h-11 items-center rounded-full border border-red-200/30 px-4 py-2">
          Sign in
        </Link>
      </div>
    );
  }

  if (!data) return <p className="text-sm text-text-secondary">Opening Premium Instant…</p>;

  const purchasable = data.releases.filter((release) => release.canPurchase);

  return (
    <section className="space-y-6 rounded-3xl border border-brand/30 bg-brand/[.04] p-5 sm:p-6">
      {info && <p className="rounded-xl border border-brand/25 bg-brand/10 p-4 text-sm">{info}</p>}
      {error && <p className="rounded-xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-200">{error}</p>}

      <div>
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-brand">Premium Instant</p>
        <h2 className="mt-2 text-3xl font-semibold">US$5.99 per release</h2>
        <p className="mt-2 text-sm text-text-secondary">One-time release fee. No monthly subscription.</p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <label className="text-sm font-medium" htmlFor="premium-instant-release">Approved release</label>
        <select
          id="premium-instant-release"
          value={releaseId}
          onChange={(event) => setReleaseId(event.target.value)}
          className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-bg-primary px-4 py-3 text-base outline-none focus:border-brand"
        >
          <option value="">Choose a release</option>
          {data.releases.map((release) => (
            <option key={release.id} value={release.id} disabled={!release.canPurchase}>
              {release.title} · {release.releaseType}{release.canPurchase ? "" : ` · ${release.reason}`}
            </option>
          ))}
        </select>
        {selected && <p className="mt-2 text-xs text-text-secondary">{selected.reason}</p>}
      </div>

      {purchasable.length > 0 ? (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy || !releaseId || !selected?.canPurchase || !data.stripeEnabled}
            onClick={() => void checkout("stripe")}
            className="min-h-11 rounded-full bg-brand px-6 py-3 font-semibold text-black disabled:opacity-40"
          >
            {busy ? "Starting checkout…" : "Distribute this release — US$5.99"}
          </button>
          <button
            type="button"
            disabled={busy || !releaseId || !selected?.canPurchase || !data.paynowEnabled}
            onClick={() => void checkout("paynow")}
            className="min-h-11 rounded-full border border-white/20 px-6 py-3 text-sm disabled:opacity-40"
          >
            Pay with Paynow
          </button>
        </div>
      ) : (
        <p className="rounded-xl border border-white/10 p-4 text-sm text-text-secondary">
          No release is ready for a new Instant purchase yet. Submit music and wait for BVS editorial approval; releases already eligible or moving through distribution do not need another fee.
        </p>
      )}

      <p className="text-xs leading-5 text-text-secondary">
        Premium Instant pays for distribution eligibility and royalty-reporting readiness for the selected approved release only. It does not buy editorial approval, BVS rotation, chart placement, guaranteed streams, or guaranteed royalty earnings.
      </p>
    </section>
  );
}
