"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient, isSupabaseConfigured } from "@/lib/supabase";

type Cohort = {
  source: string;
  campaign: string;
  signups: number;
  activated: number;
  returned: number;
  submitted: number;
  purchased: number;
  activationRate: number;
  returnRate: number;
  submissionRate: number;
  purchaseRate: number;
  roles: Record<string, number>;
};

type Payload = {
  days: number;
  generatedAt: string;
  totals: {
    signups: number;
    activated: number;
    returned: number;
    listened: number;
    saved: number;
    followed: number;
    posted: number;
    submitted: number;
    purchased: number;
    activationRate: number;
    returnRate: number;
    submissionRate: number;
    purchaseRate: number;
  };
  cohorts: Cohort[];
};

function Metric({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[.025] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-text-secondary">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
      {detail ? <p className="mt-1 text-xs text-text-secondary">{detail}</p> : null}
    </div>
  );
}

export default function GrowthDashboardPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (windowDays: number) => {
    setLoading(true);
    setError("");
    try {
      if (!isSupabaseConfigured()) throw new Error("Account service is unavailable.");
      const { data: sessionData } = await createClient().auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sign in with an editorial or admin account.");
      const response = await fetch(`/api/admin/growth?days=${windowDays}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not load growth cohorts.");
      setData(payload as Payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load growth cohorts.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(days); }, [days, load]);

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.22em] text-brand">Growth · acquisition quality</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">From signup to useful member.</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-text-secondary">
            Judge campaigns by activation, return, creator submission and purchase — not registration spikes alone.
          </p>
        </div>
        <div className="flex gap-2">
          {[7, 30, 90].map((value) => (
            <button key={value} type="button" onClick={() => setDays(value)} className={`rounded-full border px-4 py-2 text-sm ${days === value ? "border-brand bg-brand/10 text-brand" : "border-white/10 text-text-secondary"}`}>
              {value}d
            </button>
          ))}
        </div>
      </div>

      {loading ? <p className="mt-8 text-text-secondary">Loading cohort quality…</p> : null}
      {error ? <div className="mt-8 rounded-2xl border border-red-400/30 bg-red-500/10 p-5 text-red-100">{error}</div> : null}

      {data ? (
        <>
          <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Metric label="Signups" value={data.totals.signups} />
            <Metric label="Activated" value={data.totals.activated} detail={`${data.totals.activationRate}% of signups`} />
            <Metric label="Returned" value={data.totals.returned} detail={`${data.totals.returnRate}% of signups`} />
            <Metric label="Submitted" value={data.totals.submitted} detail={`${data.totals.submissionRate}% of signups`} />
            <Metric label="Purchased" value={data.totals.purchased} detail={`${data.totals.purchaseRate}% of signups`} />
          </section>

          <section className="mt-6 grid gap-3 sm:grid-cols-4">
            <Metric label="First listen" value={data.totals.listened} />
            <Metric label="First save" value={data.totals.saved} />
            <Metric label="First follow" value={data.totals.followed} />
            <Metric label="First post" value={data.totals.posted} />
          </section>

          <section className="mt-10 overflow-hidden rounded-2xl border border-white/10">
            <div className="border-b border-white/10 px-5 py-4">
              <h2 className="text-xl font-semibold">Campaign cohorts</h2>
              <p className="mt-1 text-xs text-text-secondary">Source and campaign are first-touch values captured at signup.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[900px] w-full text-left text-sm">
                <thead className="bg-white/[.025] text-xs uppercase tracking-wide text-text-secondary">
                  <tr>
                    <th className="px-4 py-3">Source / campaign</th>
                    <th className="px-4 py-3">Signups</th>
                    <th className="px-4 py-3">Activated</th>
                    <th className="px-4 py-3">Returned</th>
                    <th className="px-4 py-3">Submitted</th>
                    <th className="px-4 py-3">Purchased</th>
                    <th className="px-4 py-3">Roles</th>
                  </tr>
                </thead>
                <tbody>
                  {data.cohorts.map((row) => (
                    <tr key={`${row.source}:${row.campaign}`} className="border-t border-white/[.07]">
                      <td className="px-4 py-4"><p className="font-medium">{row.source}</p><p className="mt-1 max-w-[260px] truncate text-xs text-text-secondary">{row.campaign}</p></td>
                      <td className="px-4 py-4">{row.signups}</td>
                      <td className="px-4 py-4">{row.activated} <span className="text-xs text-text-secondary">({row.activationRate}%)</span></td>
                      <td className="px-4 py-4">{row.returned} <span className="text-xs text-text-secondary">({row.returnRate}%)</span></td>
                      <td className="px-4 py-4">{row.submitted} <span className="text-xs text-text-secondary">({row.submissionRate}%)</span></td>
                      <td className="px-4 py-4">{row.purchased} <span className="text-xs text-text-secondary">({row.purchaseRate}%)</span></td>
                      <td className="px-4 py-4 text-xs text-text-secondary">{Object.entries(row.roles).map(([role, count]) => `${role} ${count}`).join(" · ") || "—"}</td>
                    </tr>
                  ))}
                  {!data.cohorts.length ? <tr><td colSpan={7} className="px-4 py-8 text-center text-text-secondary">No signup cohorts in this window yet.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </section>

          <div className="mt-7 flex flex-wrap gap-3 text-sm">
            <Link href="/editorial" className="rounded-full border border-white/15 px-4 py-2">Editorial</Link>
            <Link href="/account" className="rounded-full border border-white/15 px-4 py-2">Account Centre</Link>
          </div>
        </>
      ) : null}
    </main>
  );
}
