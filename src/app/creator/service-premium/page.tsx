"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase";

type ServicePlan = {
  id: "service_pro" | "studio";
  name: string;
  monthlyUsd: number | null;
  yearlyUsd: number | null;
  badge: string;
  summary: string;
  includes: string[];
  commissionPercent?: number | null;
};

type Status = {
  active: boolean;
  planId: string | null;
  billingInterval: string | null;
  endsAt: string | null;
  cancelAt: string | null;
  provider: string | null;
  plans: ServicePlan[];
  stripeEnabled: boolean;
  paynowEnabled: boolean;
};

function ServicePremiumInner() {
  const params = useSearchParams();
  const [token, setToken] = useState("");
  const [data, setData] = useState<Status | null>(null);
  const [planId, setPlanId] = useState<"service_pro" | "studio">(
    params.get("plan") === "studio" ? "studio" : "service_pro",
  );
  const [interval, setInterval] = useState<"month" | "year">("month");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async (accessToken: string) => {
    const response = await fetch("/api/service/premium", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    const payload = await response.json();
    if (!response.ok)
      throw new Error(payload.error || "Could not load service membership.");
    setData(payload);
    if (payload.planId === "studio" || payload.planId === "service_pro")
      setPlanId(payload.planId);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setError("Account service is unavailable.");
      return;
    }
    void createClient()
      .auth.getSession()
      .then(({ data: session }) => {
        const accessToken = session.session?.access_token || "";
        if (!accessToken) {
          setError("Sign in to manage Service Pro or Studio.");
          return;
        }
        setToken(accessToken);
        void load(accessToken).catch((caught: Error) => setError(caught.message));
      });
  }, [load]);

  useEffect(() => {
    const checkout = params.get("checkout");
    if (checkout === "return" || checkout === "stripe-success") {
      setMessage(
        checkout === "stripe-success"
          ? "Payment returned successfully. Membership activation may take a few seconds."
          : "Returned from Paynow. If payment completed, membership will activate automatically.",
      );
      if (token) void load(token);
    }
  }, [params, token, load]);

  const chosen = useMemo(
    () => data?.plans?.find((plan) => plan.id === planId) || null,
    [data, planId],
  );
  const price =
    interval === "year" ? Number(chosen?.yearlyUsd || 0) : Number(chosen?.monthlyUsd || 0);

  async function subscribe(provider: "stripe" | "paynow") {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        provider === "stripe"
          ? "/api/service/premium/subscribe/stripe"
          : "/api/service/premium/subscribe",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ planId, interval }),
        },
      );
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error || "Could not start checkout.");
      if (!payload.redirectUrl)
        throw new Error("Payment provider did not return a checkout URL.");
      window.location.href = payload.redirectUrl;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Checkout failed.");
      setBusy(false);
    }
  }

  async function cancel(mode: "period_end" | "immediate") {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/service/premium/cancel", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mode }),
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error || "Could not cancel membership.");
      setMessage(payload.message || "Membership updated.");
      await load(token);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Cancel failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-14">
      <Link href="/premium" className="text-sm text-brand">
        ← BVS memberships
      </Link>
      <p className="mt-6 text-xs uppercase tracking-[.2em] text-brand">
        Creator services
      </p>
      <h1 className="mt-2 text-4xl font-semibold">Service Pro &amp; Studio</h1>
      <p className="mt-4 max-w-3xl text-text-secondary">
        Marketplace approval remains editorial and free to earn. Paid service
        memberships unlock more service packages, lower BVS marketplace fees and
        additional business tooling; they never buy approval, reviews or ranking.
      </p>

      {error ? (
        <p className="mt-6 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mt-6 rounded-xl border border-brand/30 bg-brand/10 p-4 text-sm">
          {message}
        </p>
      ) : null}

      <section className="mt-8 rounded-2xl border border-white/10 bg-white/[.03] p-6">
        <h2 className="text-xl font-semibold">Current marketplace access</h2>
        <p className="mt-2 text-sm text-text-secondary">
          {data?.active
            ? `${String(data.planId || "service").replaceAll("_", " ")} active${data.endsAt ? ` until ${new Date(data.endsAt).toLocaleDateString()}` : ""}${data.provider ? ` · ${data.provider}` : ""}`
            : "Service Free applies after Creator Marketplace approval: one service listing, one package and 15% BVS marketplace fee."}
        </p>
        {data?.cancelAt ? (
          <p className="mt-2 text-xs text-amber-100">
            Cancellation scheduled. Existing paid-through access remains until the membership end date.
          </p>
        ) : null}
      </section>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {(data?.plans || []).map((plan) => (
          <button
            key={plan.id}
            type="button"
            onClick={() => setPlanId(plan.id)}
            className={`rounded-2xl border p-6 text-left ${
              planId === plan.id
                ? "border-brand/60 bg-brand/[.07]"
                : "border-white/10 bg-white/[.02]"
            }`}
          >
            <p className="text-xs uppercase tracking-wide text-brand">{plan.badge}</p>
            <div className="mt-2 flex items-start justify-between gap-4">
              <h2 className="text-2xl font-semibold">{plan.name}</h2>
              {plan.commissionPercent != null ? (
                <strong>{plan.commissionPercent}% fee</strong>
              ) : null}
            </div>
            <p className="mt-2 text-sm text-text-secondary">{plan.summary}</p>
            <p className="mt-4 text-2xl font-semibold">
              US${plan.monthlyUsd}
              <span className="text-sm font-normal text-text-secondary">/mo</span>
            </p>
            <p className="text-xs text-text-secondary">or US${plan.yearlyUsd}/year</p>
            <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm text-text-secondary">
              {plan.includes.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </button>
        ))}
      </div>

      {!data?.active ? (
        <section className="mt-8 rounded-2xl border border-white/10 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Choose billing</h2>
              <p className="mt-1 text-sm text-text-secondary">
                {chosen?.name || "Service membership"} · US${price.toFixed(2)} {interval}
              </p>
            </div>
            <div className="flex rounded-full border border-white/15 p-1 text-sm">
              {(["month", "year"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setInterval(value)}
                  className={`rounded-full px-4 py-2 ${
                    interval === value ? "bg-brand text-black" : "text-text-secondary"
                  }`}
                >
                  {value === "month" ? "Monthly" : "Yearly"}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            {data?.stripeEnabled ? (
              <button
                type="button"
                disabled={busy || !token}
                onClick={() => void subscribe("stripe")}
                className="rounded-full bg-brand px-5 py-2.5 font-semibold text-black disabled:opacity-50"
              >
                Pay by card · auto-renew
              </button>
            ) : null}
            {data?.paynowEnabled ? (
              <button
                type="button"
                disabled={busy || !token}
                onClick={() => void subscribe("paynow")}
                className="rounded-full border border-white/20 px-5 py-2.5 disabled:opacity-50"
              >
                Paynow · prepaid
              </button>
            ) : null}
          </div>
          <p className="mt-4 text-xs text-text-secondary">
            Payment processing remains separate from BVS marketplace commission.
          </p>
        </section>
      ) : (
        <section className="mt-8 rounded-2xl border border-white/10 p-6">
          <h2 className="text-xl font-semibold">Membership controls</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => void cancel("period_end")}
              className="rounded-full border border-white/20 px-5 py-2.5 text-sm"
            >
              Cancel at period end
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void cancel("immediate")}
              className="rounded-full border border-red-400/30 px-5 py-2.5 text-sm text-red-200"
            >
              End immediately
            </button>
          </div>
        </section>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/creator/studio#marketplace-desk" className="text-sm text-brand">
          Open Creator Studio →
        </Link>
        <Link href="/marketplace" className="text-sm text-brand">
          View Creator Marketplace →
        </Link>
      </div>
    </main>
  );
}

export default function ServicePremiumPage() {
  return (
    <Suspense fallback={<main className="p-16 text-center text-text-secondary">Loading service membership…</main>}>
      <ServicePremiumInner />
    </Suspense>
  );
}
