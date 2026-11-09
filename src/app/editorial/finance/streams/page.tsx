"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";
import { MAX_DAILY_PLAYS_PER_SONG, MIN_LISTENERS_FOR_POT, type ExcludedCounts, type PotStatus, type StreamPayLine, type StreamPaySettings } from "@/lib/stream-pay";

type Run = { id: string; month: string; status: string; review_until: string; total_paid_usd: number | string; pot_funded_usd: number | string; pot_paid_usd: number | string; pot_rollover_usd: number | string; counted_listens: number; artist_count: number; credited_at?: string };
type RunLine = { artist_user_id: string; artist_name?: string; listens: number; listeners: number; pot_listens: number; pot_status: PotStatus; base_usd: number | string; pot_usd: number | string; total_usd: number | string };
type Funding = { id: string; source: string; amount_usd: number | string; note?: string };
type Payload = {
  serverTime: string; month: string; currentMonth: string; monthEnded: boolean; canManage: boolean; paidToDate: number; run: Run | null; runLines: RunLine[]; history: Run[];
  preview: { lines: StreamPayLine[]; excluded: ExcludedCounts; countedListens: number; totalListens: number; potUsd: number; potPaidUsd: number; potRolloverUsd: number; totalPaidUsd: number; funding: Funding[]; settings: StreamPaySettings; configured: boolean };
};

const usd = (value: unknown) => `$${Number(value || 0).toFixed(2)}`;
const POT_LABEL: Record<PotStatus, string> = { sharing: "Shares the pot", staff: "Staff: base rate only", too_few_listeners: `Under ${MIN_LISTENERS_FOR_POT} listeners`, not_confirmed: "Music not confirmed" };
const EXCLUDED: Array<[keyof ExcludedCounts, string]> = [["staff_listener", "Staff listening"], ["own_music", "Own music"], ["repeat_limit", `Over ${MAX_DAILY_PLAYS_PER_SONG} plays a day`], ["no_artist_account", "No artist account"]];
const SOURCE: Record<string, string> = { bvs: "Extra from BVS", sponsor: "Sponsor", advertising: "Advertising", rollover: "Rolled over" };
const monthLabel = (value: string) => new Date(`${value.slice(0, 7)}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

async function token() {
  const { data } = await createClient().auth.getSession();
  return data.session?.access_token || "";
}

function monthsBack(current: string, count: number) {
  const [year, month] = current.split("-").map(Number);
  return Array.from({ length: count }, (_, index) => new Date(Date.UTC(year, month - 1 - index, 1)).toISOString().slice(0, 7));
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return <div className="rounded-2xl border border-white/10 p-4"><p className="text-xs text-text-secondary">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p>{note ? <p className="mt-1 text-xs text-text-secondary">{note}</p> : null}</div>;
}

export default function StreamPayPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [month, setMonth] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [funding, setFunding] = useState({ source: "sponsor", amountUsd: "", note: "" });
  const [form, setForm] = useState<Record<string, string> | null>(null);

  const load = useCallback(async (next = "") => {
    setError("");
    try {
      const response = await fetch(`/api/admin/editorial/finance/stream-pay${next ? `?month=${next}` : ""}`, { headers: { Authorization: `Bearer ${await token()}` }, cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Stream pay could not load.");
      setData(payload);
      setMonth(payload.month);
      setForm({ baseRateUsd: String(payload.preview.settings.baseRateUsd), monthlyPotUsd: String(payload.preview.settings.monthlyPotUsd), capPercent: String(Math.round(payload.preview.settings.maxArtistPotShare * 100)), reviewDays: String(payload.preview.settings.reviewDays) });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Stream pay could not load.");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const act = async (payload: Record<string, unknown>, done: string) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/editorial/finance/stream-pay", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token()}` }, body: JSON.stringify(payload) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "That couldn’t be saved.");
      setNotice(done);
      setConfirming(false);
      await load(month);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That couldn’t be saved.");
    } finally {
      setBusy(false);
    }
  };

  const months = useMemo(() => (data ? monthsBack(data.currentMonth, 6) : []), [data]);
  const run = data?.run || null;
  const reviewDone = run && data ? new Date(data.serverTime).getTime() >= new Date(run.review_until).getTime() : false;
  const rows = useMemo(() => {
    if (!data) return [];
    if (run) return data.runLines.map((line) => ({ id: line.artist_user_id, name: line.artist_name || "Unknown artist", listens: line.listens, listeners: line.listeners, status: line.pot_status, base: Number(line.base_usd), pot: Number(line.pot_usd), total: Number(line.total_usd) }));
    return data.preview.lines.map((line) => ({ id: line.artistUserId, name: line.artistName, listens: line.listens, listeners: line.listeners, status: line.potStatus, base: line.baseUsd, pot: line.potUsd, total: line.totalUsd }));
  }, [data, run]);
  const excludedTotal = data ? EXCLUDED.reduce((sum, [key]) => sum + data.preview.excluded[key], 0) : 0;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Link href="/editorial/finance" className="inline-flex min-h-11 items-center text-sm text-brand">← Editorial Finance</Link>
      <p className="mt-3 text-xs uppercase tracking-[.2em] text-brand">Stream pay</p>
      <h1 className="mt-2 text-4xl font-semibold">Monthly artist stream pay</h1>
      <p className="mt-2 max-w-3xl text-text-secondary">Artists earn a base rate per counted listen plus a share of the monthly pot. Each month is reviewed and approved here before any wallet is credited.</p>

      {error ? <div role="alert" className="mt-6 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm">{error}</div> : null}
      {notice ? <p role="status" className="mt-6 rounded-xl border border-brand/30 bg-brand/10 p-4 text-sm">{notice}</p> : null}
      {!data && !error ? <p role="status" className="mt-8 text-sm text-text-secondary">Loading…</p> : null}

      {data ? (
        <>
          {!data.preview.configured ? <p role="status" className="mt-6 rounded-xl border border-amber-300/30 p-4 text-sm text-amber-100">Stream pay tables aren’t set up yet. These are estimates using the default settings, and no run can be saved until the migration is applied.</p> : null}

          <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Month">
            {months.map((value) => <button key={value} type="button" aria-pressed={month === value} onClick={() => void load(value)} className={`min-h-11 rounded-full border px-4 text-sm ${month === value ? "border-brand bg-brand/10 text-brand" : "border-white/10 text-text-secondary"}`}>{monthLabel(value)}</button>)}
          </div>

          <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label={run ? (run.status === "credited" ? "Paid to artists" : "To pay after review") : data.monthEnded ? "Would pay" : "Estimate so far"} value={usd(run ? run.total_paid_usd : data.preview.totalPaidUsd)} note={`${run ? run.artist_count : data.preview.lines.length} artists`} />
            <Stat label="Pot this month" value={usd(run ? run.pot_funded_usd : data.preview.potUsd)} note={`${usd(run ? run.pot_rollover_usd : data.preview.potRolloverUsd)} rolls to next month`} />
            <Stat label="Counted listens" value={String(run ? run.counted_listens : data.preview.countedListens)} note={`${excludedTotal} left out`} />
            <Stat label="Paid out so far" value={usd(data.paidToDate)} note="All approved months" />
          </section>

          <section className="mt-6 rounded-2xl border border-brand/30 p-5" aria-labelledby="run-heading">
            <h2 id="run-heading" className="text-xl font-semibold">{monthLabel(month)}</h2>
            {run?.status === "credited" ? <p className="mt-2 text-sm text-brand">Credited to wallets on {new Date(run.credited_at || "").toLocaleDateString("en-GB")}.</p> : null}
            {run?.status === "in_review" ? <p className="mt-2 text-sm text-text-secondary">In review until {new Date(run.review_until).toLocaleDateString("en-GB")}. These amounts are frozen and no wallet has been credited.</p> : null}
            {!run && !data.monthEnded ? <p className="mt-2 text-sm text-text-secondary">This month is still running, so this is an estimate. A run can be created once it ends.</p> : null}
            {!run && data.monthEnded ? <p className="mt-2 text-sm text-text-secondary">Create the run to freeze these amounts and start the {data.preview.settings.reviewDays}-day review. No money moves yet.</p> : null}
            {data.canManage ? (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {!run && data.monthEnded ? <button type="button" disabled={busy || !data.preview.configured} onClick={() => void act({ action: "create_run", month }, "Run created and in review. No wallet has been credited.")} className="min-h-11 rounded-full bg-brand px-5 text-sm font-semibold text-black disabled:opacity-40">Create run for review</button> : null}
                {run?.status === "in_review" && !confirming ? <button type="button" disabled={busy || !reviewDone} onClick={() => setConfirming(true)} className="min-h-11 rounded-full bg-brand px-5 text-sm font-semibold text-black disabled:opacity-40">{reviewDone ? "Approve and credit wallets" : "Waiting for review period"}</button> : null}
                {confirming && run ? <><span className="text-sm">Credit {usd(run.total_paid_usd)} to {run.artist_count} artists? This can’t be undone.</span><button type="button" disabled={busy} onClick={() => void act({ action: "credit_run", runId: run.id }, "Wallets credited.")} className="min-h-11 rounded-full bg-brand px-5 text-sm font-semibold text-black">Yes, credit wallets</button><button type="button" onClick={() => setConfirming(false)} className="min-h-11 rounded-full border border-white/15 px-5 text-sm">Go back</button></> : null}
                {run?.status === "in_review" && !confirming ? <button type="button" disabled={busy} onClick={() => void act({ action: "void_run", runId: run.id }, "Run cancelled.")} className="min-h-11 rounded-full border border-white/15 px-5 text-sm">Cancel run</button> : null}
              </div>
            ) : <p className="mt-3 text-xs text-text-secondary">Only staff with wallet permission can run or approve stream pay.</p>}
          </section>

          <section className="mt-6">
            <h2 className="text-xl font-semibold">Artists</h2>
            <div className="mt-3 overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full min-w-[680px] text-sm">
                <thead><tr className="text-left text-xs text-text-secondary"><th className="p-3 font-medium">Artist</th><th className="p-3 text-right font-medium">Listens</th><th className="p-3 text-right font-medium">Listeners</th><th className="p-3 font-medium">Pot</th><th className="p-3 text-right font-medium">Base</th><th className="p-3 text-right font-medium">Pot share</th><th className="p-3 text-right font-medium">Earned</th></tr></thead>
                <tbody>{rows.map((row) => <tr key={row.id} className="border-t border-white/10"><td className="p-3">{row.name}</td><td className="p-3 text-right">{row.listens}</td><td className="p-3 text-right">{row.listeners}</td><td className="p-3 text-xs text-text-secondary">{POT_LABEL[row.status]}</td><td className="p-3 text-right">{`$${row.base.toFixed(4)}`}</td><td className="p-3 text-right">{usd(row.pot)}</td><td className="p-3 text-right font-semibold">{usd(row.total)}</td></tr>)}</tbody>
              </table>
              {!rows.length ? <p className="p-5 text-sm text-text-secondary">No counted listens for this month.</p> : null}
            </div>
          </section>

          <section className="mt-6 grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-white/10 p-5">
              <h2 className="font-semibold">Left out of pay</h2>
              <ul className="mt-2 space-y-1 text-sm">{EXCLUDED.map(([key, label]) => <li key={key} className="flex justify-between"><span className="text-text-secondary">{label}</span><span>{data.preview.excluded[key]}</span></li>)}</ul>
              <p className="mt-3 text-xs text-text-secondary">Guests with no device ID count as one listener, so their plays are limited heavily.</p>
            </div>
            <div className="rounded-2xl border border-white/10 p-5">
              <h2 className="font-semibold">Pot funding</h2>
              <ul className="mt-2 space-y-1 text-sm"><li className="flex justify-between"><span className="text-text-secondary">BVS monthly pot</span><span>{usd(data.preview.settings.monthlyPotUsd)}</span></li>{data.preview.funding.map((row) => <li key={row.id} className="flex justify-between gap-3"><span className="text-text-secondary">{SOURCE[row.source] || row.source}{row.note ? ` · ${row.note}` : ""}</span><span>{usd(row.amount_usd)}</span></li>)}</ul>
              {data.canManage && !run ? <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
                <select aria-label="Funding source" value={funding.source} onChange={(event) => setFunding({ ...funding, source: event.target.value })} className="min-h-11 w-full rounded-xl border border-white/15 bg-black/30 px-3 text-sm"><option value="sponsor">Sponsor</option><option value="advertising">Advertising</option><option value="bvs">Extra from BVS</option></select>
                <input aria-label="Amount in dollars" type="number" min="0" step="0.01" inputMode="decimal" value={funding.amountUsd} onChange={(event) => setFunding({ ...funding, amountUsd: event.target.value })} placeholder="Amount after costs (USD)" className="min-h-11 w-full rounded-xl border border-white/15 bg-black/30 px-3 text-base sm:text-sm" />
                <input aria-label="Note" value={funding.note} maxLength={200} onChange={(event) => setFunding({ ...funding, note: event.target.value })} placeholder="Note" className="min-h-11 w-full rounded-xl border border-white/15 bg-black/30 px-3 text-base sm:text-sm" />
                <button type="button" disabled={busy || !(Number(funding.amountUsd) > 0)} onClick={() => void act({ action: "add_funding", month, ...funding }, "Added to the pot.").then(() => setFunding({ source: "sponsor", amountUsd: "", note: "" }))} className="min-h-11 rounded-full border border-brand px-5 text-sm text-brand disabled:opacity-40">Add to pot</button>
              </div> : null}
            </div>
            <div className="rounded-2xl border border-white/10 p-5">
              <h2 className="font-semibold">Settings</h2>
              {form ? <div className="mt-2 space-y-2 text-sm">
                {([["baseRateUsd", "Base rate per listen ($)"], ["monthlyPotUsd", "BVS monthly pot ($)"], ["capPercent", "Most one artist can take (%)"], ["reviewDays", "Review days"]] as const).map(([key, label]) => <label key={key} className="block text-text-secondary">{label}<input type="number" min="0" step="any" inputMode="decimal" disabled={!data.canManage} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className="mt-1 min-h-11 w-full rounded-xl border border-white/15 bg-black/30 px-3 text-base text-text-primary sm:text-sm" /></label>)}
                {data.canManage ? <button type="button" disabled={busy || !data.preview.configured} onClick={() => void act({ action: "save_settings", baseRateUsd: Number(form.baseRateUsd), monthlyPotUsd: Number(form.monthlyPotUsd), maxArtistPotShare: Number(form.capPercent) / 100, reviewDays: Number(form.reviewDays) }, "Settings saved.")} className="min-h-11 rounded-full border border-brand px-5 text-sm text-brand disabled:opacity-40">Save settings</button> : null}
              </div> : null}
            </div>
          </section>

          {data.history.length ? <section className="mt-6"><h2 className="text-xl font-semibold">History</h2><ul className="mt-2">{data.history.map((row) => <li key={row.id} className="flex justify-between gap-3 border-t border-white/10 py-3 text-sm"><span>{monthLabel(row.month)}</span><span className="text-text-secondary">{row.status === "credited" ? "Credited" : "In review"}</span><span className="font-semibold">{usd(row.total_paid_usd)}</span></li>)}</ul></section> : null}
        </>
      ) : null}
    </main>
  );
}
